<template>
  <div class="neutral-import-action">
    <input
      ref="fileInput"
      type="file"
      class="sr-file-input"
      accept=".csv,text/csv"
      aria-label="選擇 Canonical Trade CSV"
      @change="handleFileChange"
    >

    <button
      type="button"
      class="neutral-import-button"
      :disabled="importing"
      title="預覽並安全匯入 Canonical Trade CSV"
      aria-label="預覽並匯入通用交易 CSV"
      @click="openPicker"
    >
      <span aria-hidden="true">⇧</span>
      <span>通用 CSV</span>
    </button>

    <Teleport to="body">
      <div
        v-if="dialogOpen"
        class="neutral-import-overlay"
        role="presentation"
        @click.self="closeDialog"
      >
        <section
          class="neutral-import-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="neutral-import-title"
        >
          <header class="dialog-header">
            <div>
              <p class="eyebrow">Broker-Neutral Import</p>
              <h2 id="neutral-import-title">通用交易 CSV</h2>
              <p v-if="fileName" class="file-name">{{ fileName }}</p>
            </div>
            <button
              type="button"
              class="icon-close"
              :disabled="importing"
              aria-label="關閉通用 CSV 匯入"
              @click="closeDialog"
            >×</button>
          </header>

          <div class="dialog-body">
            <div class="safety-banner">
              <strong>先預覽、後寫入</strong>
              <span>只有全部資料列通過 Canonical Trade CSV v1 檢查，且你明確確認後才會建立交易。</span>
            </div>

            <div class="contract-card">
              <p>
                第一版不猜券商欄位、幣別、日期格式、交易方向或「看起來相同」的交易。
              </p>
              <div class="contract-row">
                <span class="contract-label">必要欄位</span>
                <code>{{ requiredHeaders.join(', ') }}</code>
              </div>
              <div class="contract-row">
                <span class="contract-label">選填欄位</span>
                <code>{{ optionalHeaders.join(', ') }}</code>
              </div>
              <p class="contract-note">
                txn_type 僅接受 BUY / SELL；日期固定 YYYY-MM-DD；currency 不由 symbol 推測。
              </p>
            </div>

            <div v-if="reading" class="dialog-state" role="status">正在讀取並檢查檔案…</div>

            <div v-if="errorMessage" class="error-panel" role="alert">
              <strong>無法建立安全預覽</strong>
              <span>{{ errorMessage }}</span>
            </div>

            <template v-if="preview">
              <div class="preview-summary" aria-label="CSV 預覽摘要">
                <div class="summary-item">
                  <span>來源列</span>
                  <strong>{{ preview.counts.rows }}</strong>
                </div>
                <div class="summary-item ready">
                  <span>可匯入</span>
                  <strong>{{ preview.counts.ready }}</strong>
                </div>
                <div class="summary-item blocked">
                  <span>阻擋</span>
                  <strong>{{ preview.counts.blocked }}</strong>
                </div>
                <div class="summary-item warning">
                  <span>提醒</span>
                  <strong>{{ preview.counts.warnings }}</strong>
                </div>
              </div>

              <div class="source-profile-card">
                <label for="canonical-source-profile"><strong>匯入來源設定檔</strong></label>
                <input
                  id="canonical-source-profile"
                  v-model="sourceProfile"
                  type="text"
                  maxlength="64"
                  autocomplete="off"
                  :disabled="importing"
                  placeholder="例如：富途主帳戶、Schwab 主帳戶"
                >
                <p>
                  同一設定檔＋同一份 CSV 會使用相同防重複識別，可安全重新匯入續傳。
                  修改、重排或改用其他設定檔的檔案視為新來源；系統不會用交易欄位相似度猜測重複。
                </p>
              </div>

              <div v-if="preview.file_issues.length" class="schema-issues" role="alert">
                <strong>檔案契約尚未通過</strong>
                <ul>
                  <li v-for="issue in preview.file_issues" :key="issue.code">{{ issue.message }}</li>
                </ul>
              </div>

              <div v-if="preview.status === 'partial'" class="schema-issues" role="alert">
                <strong>不執行部分匯入</strong>
                <span>目前檔案仍有被阻擋的資料列。請先修正整份 CSV，再重新預覽。</span>
              </div>

              <div v-if="preview.counts.duplicate_rows > 0" class="duplicate-note">
                偵測到 {{ preview.counts.duplicate_rows }} 列具有相同交易欄位，仍保留為獨立來源列；不會內容去重。
              </div>

              <div class="preview-table-wrap">
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th>列</th>
                      <th>狀態</th>
                      <th>日期</th>
                      <th>代碼</th>
                      <th>類型</th>
                      <th class="num">股數</th>
                      <th class="num">價格</th>
                      <th>幣別</th>
                      <th>檢查結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="visibleRows.length === 0">
                      <td colspan="9" class="empty-preview">檔案沒有交易資料列。</td>
                    </tr>
                    <tr v-for="row in visibleRows" :key="row.row_number">
                      <td>{{ row.row_number }}</td>
                      <td>
                        <span class="row-status" :class="row.status">
                          {{ row.status === 'ready' ? '可匯入' : '阻擋' }}
                        </span>
                      </td>
                      <td>{{ row.payload.txn_date || '—' }}</td>
                      <td><strong>{{ row.payload.symbol || '—' }}</strong></td>
                      <td>{{ row.payload.txn_type || '—' }}</td>
                      <td class="num">{{ displayNumber(row.payload.qty) }}</td>
                      <td class="num">{{ displayNumber(row.payload.price) }}</td>
                      <td>{{ row.payload.currency || '—' }}</td>
                      <td class="row-feedback">
                        <span v-if="row.issues.length === 0 && row.warnings.length === 0">通過</span>
                        <span
                          v-for="issue in row.issues"
                          :key="`i-${row.row_number}-${issue.code}-${issue.field}`"
                          class="issue-text"
                        >{{ issue.message }}</span>
                        <span
                          v-for="warning in row.warnings"
                          :key="`w-${row.row_number}-${warning.code}-${warning.field}`"
                          class="warning-text"
                        >{{ warning.message }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p v-if="preview.rows.length > visibleRows.length" class="row-limit-note">
                畫面僅顯示前 {{ visibleRows.length }} 列；匯入與摘要仍涵蓋全部 {{ preview.rows.length }} 列。
              </p>
            </template>

            <div v-if="importing" class="progress-panel" role="status" aria-live="polite">
              <strong>正在安全匯入 {{ progress.current }}/{{ progress.total }}</strong>
              <span>逐筆使用穩定 idempotency key 提交；整批完成或停止後只做一次權威 readback 與重算。</span>
            </div>

            <div v-if="result" class="result-panel" :class="resultTone" role="status" aria-live="polite">
              <strong>{{ resultTitle }}</strong>
              <span>{{ resultMessage }}</span>
            </div>
            <ImportReconciliationReceipt :result="result" />
          </div>

          <footer class="dialog-footer">
            <span class="write-state">
              {{ preview?.status === 'ready' ? '全部通過後可明確確認寫入' : '目前不允許寫入' }}
            </span>
            <div class="footer-actions">
              <button
                type="button"
                class="btn-secondary"
                :disabled="importing"
                @click="openPicker"
              >重新選擇</button>
              <button
                v-if="!result"
                type="button"
                class="btn-primary"
                :disabled="!canImport"
                @click="confirmImport"
              >
                {{ importing ? `匯入中 ${progress.current}/${progress.total}` : `確認匯入 ${preview?.counts?.rows || 0} 筆` }}
              </button>
              <button
                v-else
                type="button"
                class="btn-primary"
                :disabled="importing"
                @click="closeDialog"
              >完成</button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { CONFIG } from '../config.js';
import { useToast } from '../composables/useToast';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import ImportReconciliationReceipt from './ImportReconciliationReceipt.vue';
import {
  MAX_CANONICAL_CSV_BYTES,
  OPTIONAL_CANONICAL_HEADERS,
  REQUIRED_CANONICAL_HEADERS,
  buildCanonicalTradeCsvPreview,
} from '../services/brokerNeutralImportPreview.js';
import { prepareCanonicalTradeImport } from '../services/brokerNeutralImportExecution.js';
import { createBrokerNeutralRecord } from '../services/brokerNeutralRecordCreate.js';
import { runRecordImportBatch } from '../services/recordImportBatch.js';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const fileInput = ref(null);
const dialogOpen = ref(false);
const reading = ref(false);
const importing = ref(false);
const fileName = ref('');
const sourceText = ref('');
const sourceFileSize = ref(null);
const sourceProfile = ref('');
const preview = ref(null);
const errorMessage = ref('');
const result = ref(null);
const progress = ref({ current: 0, total: 0 });

const requiredHeaders = REQUIRED_CANONICAL_HEADERS;
const optionalHeaders = OPTIONAL_CANONICAL_HEADERS;
const visibleRows = computed(() => preview.value?.rows?.slice(0, 20) || []);
const canImport = computed(() => (
  !reading.value
  && !importing.value
  && !result.value
  && preview.value?.status === 'ready'
  && preview.value?.counts?.rows > 0
  && preview.value?.counts?.blocked === 0
  && sourceProfile.value.trim().length > 0
));

const resultTone = computed(() => {
  const status = result.value?.status;
  if (status === 'committed' || status === 'replayed') return 'success';
  if (status === 'failed') return 'error';
  return 'warning';
});

const resultTitle = computed(() => {
  const status = result.value?.status;
  if (status === 'committed') return '匯入完成';
  if (status === 'replayed') return '沒有重複新增';
  if (status === 'committed_with_sync_warning') return '交易已保存，後續同步需留意';
  if (status === 'replayed_with_sync_warning') return '交易已存在，後續同步需留意';
  if (status === 'partial_failure') return '部分交易已處理';
  return '匯入未完成';
});

const resultMessage = computed(() => {
  if (!result.value) return '';
  const base = `已處理 ${result.value.processed}/${result.value.total} 筆；新增 ${result.value.created} 筆，已存在 ${result.value.replayed} 筆。`;
  if (result.value.status === 'partial_failure') {
    const retry = result.value.failure?.outcomeAmbiguous
      ? '最後一筆回應不確定。請保留相同來源設定檔並重新匯入同一檔案，已確認項目會安全重播。'
      : '後續寫入已停止。修正問題後，以相同來源設定檔重新匯入同一檔案即可安全續傳。';
    return `${base} ${retry}`;
  }
  if (result.value.status === 'committed_with_sync_warning') {
    return `${base} 交易寫入已確認，不需要重複匯入；權威 readback 或重算將由既有恢復流程繼續處理。`;
  }
  if (result.value.status === 'replayed_with_sync_warning') {
    return `${base} 交易已存在，不需要重複匯入；稍後重新整理即可。`;
  }
  if (result.value.status === 'failed') {
    return `${base} 沒有足夠證據宣告新的寫入成功。`;
  }
  return base;
});

const openPicker = () => {
  if (importing.value) return;
  dialogOpen.value = true;
  fileInput.value?.click();
};

const closeDialog = () => {
  if (importing.value) return;
  dialogOpen.value = false;
  reading.value = false;
  fileName.value = '';
  sourceText.value = '';
  sourceFileSize.value = null;
  sourceProfile.value = '';
  preview.value = null;
  errorMessage.value = '';
  result.value = null;
  progress.value = { current: 0, total: 0 };
};

const handleFileChange = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  dialogOpen.value = true;
  reading.value = true;
  fileName.value = file.name || 'Canonical Trade CSV';
  sourceText.value = '';
  sourceFileSize.value = file.size;
  preview.value = null;
  errorMessage.value = '';
  result.value = null;
  progress.value = { current: 0, total: 0 };

  if (file.size > MAX_CANONICAL_CSV_BYTES) {
    reading.value = false;
    errorMessage.value = 'CSV 超過 2 MiB 上限。';
    return;
  }

  try {
    const text = await file.text();
    sourceText.value = text;
    preview.value = buildCanonicalTradeCsvPreview(text, { fileSizeBytes: file.size });
  } catch (error) {
    errorMessage.value = error?.message || 'CSV 格式無法確認。';
  } finally {
    reading.value = false;
  }
};

const confirmImport = async () => {
  if (!canImport.value) return;

  let prepared;
  try {
    prepared = await prepareCanonicalTradeImport(sourceText.value, sourceProfile.value, {
      fileSizeBytes: sourceFileSize.value,
    });
  } catch (error) {
    errorMessage.value = error?.message || 'CSV 尚未達到安全匯入條件。';
    return;
  }

  const confirmation = [
    `確認匯入 ${prepared.entries.length} 筆 Canonical Trade CSV 交易？`,
    `來源設定檔：${prepared.source_profile}`,
    '同一設定檔＋同一檔案可安全重播。',
    '修改、重排或改用不同設定檔的檔案會視為新來源；系統不以欄位相似度猜測重複交易。',
  ].join('\n');
  if (!window.confirm(confirmation)) return;

  const owner = authStore.user?.email || '';
  if (!owner || !authStore.token) {
    addToast('請先登入再執行通用 CSV 匯入', 'error');
    return;
  }

  importing.value = true;
  errorMessage.value = '';
  result.value = null;
  progress.value = { current: 0, total: prepared.entries.length };

  try {
    result.value = await runRecordImportBatch(prepared.entries, {
      createRecord: async (entry) => {
        try {
          return await createBrokerNeutralRecord(entry, {
            storage: window.localStorage,
            owner,
            getToken: () => authStore.token,
            refreshToken: () => authStore.refreshToken(),
            apiBaseUrl: CONFIG.API_BASE_URL,
          });
        } finally {
          progress.value = {
            current: Math.min(progress.value.current + 1, progress.value.total),
            total: progress.value.total,
          };
        }
      },
      refreshRecords: () => portfolioStore.fetchRecords(),
      requestUpdate: () => portfolioStore.triggerUpdate(
        portfolioStore.selectedBenchmark,
        { automatic: true },
      ),
    });

    const type = resultTone.value === 'success'
      ? 'success'
      : resultTone.value === 'error'
        ? 'error'
        : 'warning';
    addToast(
      `${resultTitle.value}：新增 ${result.value.created}、已存在 ${result.value.replayed}`,
      type,
    );
  } catch (error) {
    result.value = {
      status: 'failed',
      total: prepared.entries.length,
      processed: 0,
      created: 0,
      replayed: 0,
      failure: { outcomeAmbiguous: error?.outcomeAmbiguous === true },
      sync: {},
    };
    addToast('通用 CSV 匯入未完成，沒有足夠證據宣告寫入成功', 'error');
  } finally {
    importing.value = false;
  }
};

const displayNumber = (value) => (
  Number.isFinite(value) ? String(value) : '—'
);
</script>

<style scoped>
.neutral-import-action { display: inline-flex; flex: 0 0 auto; }
.sr-file-input { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.neutral-import-button,
.btn-primary,
.btn-secondary {
  min-height: 36px;
  border-radius: 8px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.neutral-import-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  white-space: nowrap;
}
.neutral-import-button:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
button:disabled { cursor: not-allowed; opacity: 0.58; }
.neutral-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(15 23 42 / 55%);
}
.neutral-import-dialog {
  display: flex;
  flex-direction: column;
  width: min(1120px, 96vw);
  max-height: min(88vh, 920px);
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  box-shadow: 0 24px 64px rgb(15 23 42 / 22%);
}
.dialog-header,
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}
.dialog-header { border-bottom: 1px solid var(--border-color); }
.dialog-footer { border-top: 1px solid var(--border-color); }
.dialog-header h2,
.dialog-header p { margin: 0; }
.file-name { margin-top: 3px !important; color: var(--text-muted); }
.eyebrow {
  margin-bottom: 3px !important;
  color: var(--text-muted);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.icon-close {
  min-width: 36px;
  min-height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.icon-close:hover:not(:disabled) { background: var(--bg-secondary); }
.dialog-body { display: grid; gap: 14px; overflow: auto; padding: 16px 18px; }
.dialog-state { padding: 24px; text-align: center; color: var(--text-muted); }
.safety-banner,
.contract-card,
.source-profile-card,
.error-panel,
.schema-issues,
.duplicate-note,
.progress-panel,
.result-panel {
  border-radius: 10px;
  padding: 12px 14px;
}
.safety-banner {
  display: flex;
  gap: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
.contract-card,
.source-profile-card { display: grid; gap: 8px; border: 1px solid var(--border-color); }
.contract-card p,
.source-profile-card p { margin: 0; }
.contract-row { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 10px; }
.contract-label { color: var(--text-muted); font-weight: 700; }
.contract-row code { overflow-wrap: anywhere; }
.contract-note,
.source-profile-card p,
.row-limit-note,
.write-state { color: var(--text-muted); }
.source-profile-card input {
  min-height: 38px;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card, #fff);
  color: inherit;
  font: inherit;
}
.error-panel,
.schema-issues {
  display: grid;
  gap: 6px;
  border: 1px solid var(--danger, #dc2626);
  background: color-mix(in srgb, var(--danger, #dc2626) 8%, transparent);
}
.schema-issues ul { margin: 0; padding-left: 20px; }
.duplicate-note {
  border: 1px solid var(--warning, #d97706);
  background: color-mix(in srgb, var(--warning, #d97706) 8%, transparent);
}
.progress-panel { display: grid; gap: 4px; border: 1px solid var(--primary); background: var(--bg-secondary); }
.result-panel { display: grid; gap: 5px; }
.result-panel.success { background: rgb(22 163 74 / 10%); }
.result-panel.warning { background: rgb(245 158 11 / 12%); }
.result-panel.error { background: rgb(220 38 38 / 10%); }
.preview-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.summary-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.summary-item span { color: var(--text-muted); }
.preview-table-wrap { overflow: auto; border: 1px solid var(--border-color); border-radius: 10px; }
.preview-table { width: 100%; min-width: 960px; border-collapse: collapse; }
.preview-table th,
.preview-table td { padding: 8px 10px; border-bottom: 1px solid var(--border-color); text-align: left; }
.preview-table th { color: var(--text-muted); background: var(--bg-secondary); }
.preview-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.row-status {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
}
.row-status.ready { color: var(--success); background: rgb(16 185 129 / 10%); }
.row-status.blocked { color: var(--danger, #dc2626); background: rgb(220 38 38 / 10%); }
.row-feedback { display: grid; gap: 3px; min-width: 220px; }
.issue-text { color: var(--danger, #dc2626); }
.warning-text { color: var(--warning, #d97706); }
.empty-preview { text-align: center !important; color: var(--text-muted); }
.row-limit-note { margin: -4px 0 0; }
.footer-actions { display: flex; gap: 8px; align-items: center; }
.btn-primary,
.btn-secondary { padding: 0.5rem 0.85rem; border: 1px solid var(--border-color); }
.btn-secondary { background: var(--bg-card, #fff); color: inherit; }
.btn-primary { border-color: var(--primary); background: var(--primary); color: #fff; }

@media (max-width: 700px) {
  .neutral-import-overlay { padding: 0; align-items: end; }
  .neutral-import-dialog { width: 100%; max-height: 94vh; border-radius: 14px 14px 0 0; }
  .dialog-header,
  .dialog-footer { padding: 14px; }
  .dialog-body { padding: 14px; }
  .preview-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .contract-row { grid-template-columns: 1fr; gap: 3px; }
  .dialog-footer { align-items: flex-start; flex-direction: column; }
  .footer-actions { width: 100%; }
  .footer-actions button { flex: 1; }
  .safety-banner { flex-direction: column; gap: 4px; }
}
</style>
