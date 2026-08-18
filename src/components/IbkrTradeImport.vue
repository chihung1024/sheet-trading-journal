<template>
  <div class="ibkr-import">
    <input
      ref="fileInput"
      class="file-input"
      type="file"
      accept=".csv,text/csv"
      @change="handleFileChange"
    >
    <button
      type="button"
      class="import-button"
      :disabled="importing || retrying"
      title="從 IBKR Activity / Flex CSV 匯入股票成交"
      @click="chooseFile"
    >
      <span aria-hidden="true">⇩</span>
      <span>匯入 IBKR</span>
    </button>

    <Teleport to="body">
      <div v-if="showDialog" class="dialog-backdrop" @click.self="closeDialog">
        <section
          class="import-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ibkr-import-title"
        >
          <header class="dialog-header">
            <div>
              <h3 id="ibkr-import-title">IBKR 股票成交匯入</h3>
              <p v-if="fileName" class="file-name">{{ fileName }}</p>
            </div>
            <button
              type="button"
              class="close-button"
              :disabled="importing || retrying"
              aria-label="關閉 IBKR 匯入"
              @click="closeDialog"
            >✕</button>
          </header>

          <div v-if="reading" class="dialog-state" role="status">正在讀取並檢查檔案…</div>

          <template v-else-if="preview">
            <div class="summary-grid">
              <div class="summary-item">
                <span>CSV 明細</span>
                <strong>{{ preview.summary.rows }}</strong>
              </div>
              <div class="summary-item good">
                <span>可匯入訂單</span>
                <strong>{{ preview.summary.importable }}</strong>
              </div>
              <div class="summary-item" :class="{ warning: preview.warnings.length > 0 }">
                <span>檢查提醒</span>
                <strong>{{ preview.warnings.length }}</strong>
              </div>
            </div>

            <div class="profile-section">
              <div class="profile-copy">
                <label for="ibkr-import-profile"><strong>匯入設定檔（選填）</strong></label>
                <p>
                  如果來源沒有 IBKR Account ID，請輸入一個你固定使用的設定檔名稱，例如「IBKR 主帳戶」。
                  同一帳戶之後改用 Flex CSV 時請使用相同名稱，才能沿用同一組防重複識別。
                </p>
              </div>
              <div class="profile-controls">
                <input
                  id="ibkr-import-profile"
                  v-model="profileName"
                  type="text"
                  maxlength="64"
                  autocomplete="off"
                  :disabled="reading || importing || retrying"
                  placeholder="例如：IBKR 主帳戶"
                  @input="markProfileDirty"
                >
                <button
                  type="button"
                  class="secondary-button profile-apply"
                  :disabled="reading || importing || retrying || !fileContents || !profileDirty"
                  @click="rebuildPreview"
                >重新檢查</button>
              </div>
              <p v-if="profileError" class="profile-error" role="alert">{{ profileError }}</p>
              <p v-else-if="profileDirty" class="profile-dirty" role="status">
                設定檔已變更；請先重新檢查，確認預覽後才能匯入。
              </p>
              <p v-else-if="activeProfileName" class="profile-active">
                目前使用設定檔：<strong>{{ activeProfileName }}</strong>。名稱只存在本次畫面記憶體，不寫入交易備註或 Account ID 欄位。
              </p>
            </div>

            <div class="safety-note">
              目前只匯入可安全辨識的 <strong>STK BUY / SELL</strong> 成交；同一 Order 的多個 fills 會合併。
              無法確認帳戶或設定檔 scope、代碼、幣別或成交完整性的資料不會寫入。
              單一設定檔不能覆蓋含多個不同 Account ID 的檔案。
            </div>

            <div v-if="preview.entries.length > 0" class="preview-section">
              <h4>寫入前預覽</h4>
              <div class="preview-table-wrap">
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>帳戶 / 設定檔</th>
                      <th>代碼</th>
                      <th>類型</th>
                      <th class="number">股數</th>
                      <th class="number">均價</th>
                      <th class="number">費稅</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="entry in preview.entries.slice(0, 50)" :key="entry.idempotencyKey">
                      <td>{{ entry.record.txn_date }}</td>
                      <td>{{ scopeDisplay(entry) }}</td>
                      <td><strong>{{ entry.record.symbol }}</strong></td>
                      <td>{{ entry.record.txn_type === 'BUY' ? '買入' : '賣出' }}</td>
                      <td class="number">{{ formatNumber(entry.record.qty, 4) }}</td>
                      <td class="number">{{ formatNumber(entry.record.price, 4) }}</td>
                      <td class="number">{{ formatNumber(entry.record.fee + entry.record.tax, 4) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="preview.entries.length > 50" class="more-note">
                另有 {{ preview.entries.length - 50 }} 筆可匯入訂單未展開顯示。
              </p>
            </div>

            <div v-if="preview.warnings.length > 0" class="warning-section">
              <h4>未匯入 / 檢查提醒</h4>
              <ul>
                <li v-for="(item, index) in preview.warnings.slice(0, 12)" :key="`${item.code}-${item.rowNumber}-${index}`">
                  <span v-if="item.rowNumber">第 {{ item.rowNumber }} 列：</span>{{ item.message }}
                </li>
              </ul>
              <p v-if="preview.warnings.length > 12" class="more-note">
                另有 {{ preview.warnings.length - 12 }} 項提醒未展開。
              </p>
            </div>

            <div v-if="result" class="result-box" :class="resultTone" role="status" aria-live="polite">
              <strong>{{ resultTitle }}</strong>
              <p>{{ resultMessage }}</p>
            </div>
            <ImportReconciliationReceipt
              :result="result"
              :retry-available="canRetryAmbiguous"
              :retrying="retrying"
              @retry="retryAmbiguousImport"
            />
          </template>

          <footer class="dialog-actions">
            <button type="button" class="secondary-button" :disabled="importing || retrying" @click="closeDialog">
              {{ result ? '關閉' : '取消' }}
            </button>
            <button
              v-if="preview && !result"
              type="button"
              class="primary-button"
              :disabled="importing || profileDirty || preview.entries.length === 0"
              @click="confirmImport"
            >
              {{ importing ? `匯入中 ${progressText}` : `確認匯入 ${preview.entries.length} 筆` }}
            </button>
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
import { deriveIbkrImportProfile } from '../services/ibkrImportProfile.js';
import { createIbkrRecord } from '../services/ibkrRecordCreate.js';
import { parseIbkrTradeCsv } from '../services/ibkrTradeImport.js';
import { runIbkrTradeImportBatch } from '../services/ibkrTradeImportBatch.js';
import {
  IMPORT_AMBIGUOUS_RETRY_REASON,
  isAmbiguousImportRetryCandidate,
  prepareAmbiguousImportRetry,
} from '../services/importAmbiguousRetry.js';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const fileInput = ref(null);
const showDialog = ref(false);
const reading = ref(false);
const importing = ref(false);
const retrying = ref(false);
const fileName = ref('');
const fileContents = ref('');
const profileName = ref('');
const activeProfileName = ref('');
const profileDirty = ref(false);
const profileError = ref('');
const preview = ref(null);
const result = ref(null);
const progress = ref({ current: 0, total: 0 });

const progressText = computed(() => (
  progress.value.total > 0 ? `${progress.value.current}/${progress.value.total}` : ''
));
const canRetryAmbiguous = computed(() => (
  !reading.value
  && !importing.value
  && !retrying.value
  && !profileDirty.value
  && fileContents.value.length > 0
  && preview.value?.entries?.length > 0
  && isAmbiguousImportRetryCandidate(result.value)
));

const resultTone = computed(() => {
  if (!result.value) return '';
  if (result.value.status === 'committed' || result.value.status === 'replayed') return 'success';
  if (result.value.status === 'failed') return 'error';
  return 'warning';
});

const resultTitle = computed(() => {
  const status = result.value?.status;
  if (status === 'committed') return '匯入完成';
  if (status === 'replayed') return '沒有重複新增';
  if (status === 'committed_with_sync_warning') return '交易已保存，部分後續資訊需留意';
  if (status === 'replayed_with_sync_warning') return '交易已存在，部分來源資訊需留意';
  if (status === 'partial_failure') return '部分交易已處理';
  return '匯入未完成';
});

const resultMessage = computed(() => {
  if (!result.value) return '';
  const metadataUpdated = Number(result.value.metadataUpdated || 0);
  const metadataWarnings = result.value.sync?.metadataWarnings?.length || 0;
  const metadataSummary = metadataUpdated > 0 ? `成交來源資訊已補充 ${metadataUpdated} 筆。` : '';
  const metadataWarning = metadataWarnings > 0
    ? `有 ${metadataWarnings} 筆成交來源資訊尚未補齊；交易本身已保存或確認存在，不會因此重複新增。重新匯入同一檔案可安全重試來源資訊補充。`
    : '';
  const base = `已處理 ${result.value.processed}/${result.value.total} 筆；新增 ${result.value.created} 筆，已存在 ${result.value.replayed} 筆。`;
  const withMetadata = suffix => [base, metadataSummary, metadataWarning, suffix].filter(Boolean).join(' ');
  if (result.value.status === 'partial_failure') {
    const ambiguity = result.value.failure?.outcomeAmbiguous === true
      ? '最後一筆回應不確定。可使用逐筆結果中的「安全續傳」先確認既有未定結果，再以相同來源識別續跑；已成功項目不會重複新增。'
      : '後續寫入已停止。修正問題後可重新匯入同一檔案；已成功項目不會重複新增。';
    return withMetadata(ambiguity);
  }
  if (result.value.status === 'committed_with_sync_warning') {
    const ledgerSyncWarning = (
      result.value.sync?.readbackError
      || result.value.sync?.updateError
      || result.value.sync?.recoveryWarnings?.length > 0
    ) ? '帳本寫入已確認，不需要重新匯入；稍後重新整理或使用「立即更新」即可繼續同步。' : '';
    return withMetadata(ledgerSyncWarning);
  }
  if (result.value.status === 'replayed_with_sync_warning') {
    const readbackWarning = result.value.sync?.readbackError
      ? '交易已存在，不需要重新匯入；稍後重新整理即可。'
      : '';
    return withMetadata(readbackWarning);
  }
  if (result.value.status === 'failed') {
    return withMetadata('沒有已確認的新寫入。請依提示修正後再試。');
  }
  return withMetadata('');
});

const chooseFile = () => {
  if (importing.value || retrying.value) return;
  fileInput.value?.click();
};

const resetState = () => {
  reading.value = false;
  importing.value = false;
  retrying.value = false;
  fileName.value = '';
  fileContents.value = '';
  profileName.value = '';
  activeProfileName.value = '';
  profileDirty.value = false;
  profileError.value = '';
  preview.value = null;
  result.value = null;
  progress.value = { current: 0, total: 0 };
};

const closeDialog = () => {
  if (importing.value || retrying.value) return;
  showDialog.value = false;
  resetState();
};

const markProfileDirty = () => {
  profileDirty.value = true;
  profileError.value = '';
  result.value = null;
};

const rebuildPreview = async ({ notifyIfEmpty = true } = {}) => {
  if (!fileContents.value || importing.value || retrying.value) return;
  reading.value = true;
  result.value = null;
  profileError.value = '';
  try {
    const profile = await deriveIbkrImportProfile(profileName.value);
    preview.value = parseIbkrTradeCsv(fileContents.value, { accountScope: profile.scopeId });
    activeProfileName.value = profile.displayName;
    profileDirty.value = false;
    if (notifyIfEmpty && preview.value.entries.length === 0) {
      addToast('這份 IBKR 檔案沒有可安全匯入的股票成交', 'warning');
    }
  } catch (error) {
    activeProfileName.value = '';
    profileError.value = error?.message || '匯入設定檔無法套用';
    profileDirty.value = true;
  } finally {
    reading.value = false;
  }
};

const handleFileChange = async (event) => {
  const file = event.target?.files?.[0];
  if (fileInput.value) fileInput.value.value = '';
  if (!file || retrying.value) return;

  resetState();
  showDialog.value = true;
  fileName.value = file.name || 'IBKR CSV';
  try {
    fileContents.value = await file.text();
    await rebuildPreview({ notifyIfEmpty: true });
  } catch (error) {
    preview.value = {
      status: 'invalid',
      entries: [],
      warnings: [{ rowNumber: null, code: 'FILE_READ_FAILED', message: '檔案無法讀取，請重新匯出 CSV 後再試' }],
      summary: { rows: 0, importable: 0, skipped: 1 },
    };
  }
};

const executeCurrentImport = async (owner) => {
  importing.value = true;
  result.value = null;
  progress.value = { current: 0, total: preview.value.entries.length };

  try {
    result.value = await runIbkrTradeImportBatch(preview.value.entries, {
      createRecord: async (entry) => {
        const outcome = await createIbkrRecord(entry, {
          storage: window.localStorage,
          owner,
          getToken: () => authStore.token,
          refreshToken: () => authStore.refreshToken(),
          apiBaseUrl: CONFIG.API_BASE_URL,
        });
        progress.value = {
          current: Math.min(progress.value.current + 1, progress.value.total),
          total: progress.value.total,
        };
        return outcome;
      },
      refreshRecords: () => portfolioStore.fetchRecords(),
      requestUpdate: () => portfolioStore.triggerUpdate(portfolioStore.selectedBenchmark, { automatic: true }),
    });

    const type = resultTone.value === 'success'
      ? 'success'
      : resultTone.value === 'error'
        ? 'error'
        : 'warning';
    const metadataToast = result.value.metadataUpdated > 0 ? `、來源資訊 ${result.value.metadataUpdated}` : '';
    const metadataWarningToast = result.value.sync?.metadataWarnings?.length > 0
      ? `、來源提醒 ${result.value.sync.metadataWarnings.length}`
      : '';
    addToast(`${resultTitle.value}：新增 ${result.value.created}、已存在 ${result.value.replayed}${metadataToast}${metadataWarningToast}`, type);
  } catch (error) {
    result.value = {
      status: 'failed',
      total: preview.value.entries.length,
      processed: 0,
      created: 0,
      replayed: 0,
      failure: { outcomeAmbiguous: error?.outcomeAmbiguous === true },
      sync: {},
    };
    addToast('IBKR 匯入未完成，沒有足夠證據宣告寫入成功', 'error');
  } finally {
    importing.value = false;
  }
};

const confirmImport = async () => {
  if (importing.value || retrying.value || profileDirty.value || !preview.value?.entries?.length) return;
  const owner = authStore.user?.email || '';
  if (!owner || !authStore.token) {
    addToast('請先登入再執行 IBKR 匯入', 'error');
    return;
  }
  await executeCurrentImport(owner);
};

const retryAmbiguousImport = async () => {
  if (!canRetryAmbiguous.value) return;
  const priorResult = result.value;
  const retryEntries = preview.value.entries;

  const confirmation = [
    `安全續傳 ${retryEntries.length} 筆 IBKR 交易？`,
    '系統會先確認既有未定交易；確認完成後才以目前仍在記憶體中的相同來源識別重播整批。',
    '已確認項目會由伺服器判定為安全重播，不會用交易欄位相似度猜測重複。',
  ].join('\n');
  if (!window.confirm(confirmation)) return;

  const owner = authStore.user?.email || '';
  if (!owner || !authStore.token) {
    addToast('請先登入再執行安全續傳', 'error');
    return;
  }

  retrying.value = true;
  try {
    const gate = await prepareAmbiguousImportRetry(priorResult, {
      entries: retryEntries,
      storage: window.localStorage,
      owner,
      reconcile: () => portfolioStore.fetchAll(),
    });

    if (!gate.ready) {
      if (gate.reason === IMPORT_AMBIGUOUS_RETRY_REASON.RECONCILIATION_PENDING) {
        addToast('系統仍在確認先前未定的交易結果；目前不會重送整批。', 'info');
      } else if (gate.reason === IMPORT_AMBIGUOUS_RETRY_REASON.RECOVERY_STATE_UNAVAILABLE) {
        addToast('無法安全確認本機恢復狀態；目前不會重送整批。', 'error');
      }
      return;
    }

    await executeCurrentImport(owner);
  } finally {
    retrying.value = false;
  }
};

const maskAccount = (accountId) => {
  const value = String(accountId || '').trim();
  if (!value) return '—';
  if (value.length <= 4) return value;
  return `•••${value.slice(-4)}`;
};

const scopeDisplay = (entry) => {
  const account = maskAccount(entry?.source?.accountId);
  if (!activeProfileName.value) return account;
  if (account === '—') return `設定檔：${activeProfileName.value}`;
  return `${account} · 設定檔：${activeProfileName.value}`;
};

const formatNumber = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-US', { maximumFractionDigits: digits });
};
</script>

<style scoped>
.ibkr-import { display: inline-flex; }
.file-input { display: none; }
.import-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #d5d9e2);
  border-radius: 8px;
  background: var(--card-bg, #fff);
  color: inherit;
  cursor: pointer;
  font-weight: 600;
}
.import-button:hover:not(:disabled) { border-color: #64748b; }
.import-button:disabled { cursor: not-allowed; opacity: 0.6; }
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
}
.import-dialog {
  width: min(920px, 100%);
  max-height: min(88vh, 900px);
  overflow: auto;
  border-radius: 14px;
  background: var(--card-bg, #fff);
  color: var(--text-primary, #111827);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
}
.dialog-header,
.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}
.dialog-actions {
  justify-content: flex-end;
  border-top: 1px solid var(--border-color, #e5e7eb);
  border-bottom: 0;
}
.dialog-header h3 { margin: 0; }
.file-name { margin: 0.25rem 0 0; color: var(--text-secondary, #64748b); font-size: var(--type-body); }
.close-button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: var(--icon-md);
}
.dialog-state { padding: 2rem 1.25rem; text-align: center; }
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 1rem 1.25rem 0;
}
.summary-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
}
.summary-item strong { font-size: var(--type-section); }
.summary-item.good strong { color: #15803d; }
.summary-item.warning strong { color: #b45309; }
.profile-section,
.safety-note,
.preview-section,
.warning-section,
.result-box { margin: 1rem 1.25rem; }
.profile-section {
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
}
.profile-copy p,
.profile-active,
.profile-dirty,
.profile-error {
  margin: 0.35rem 0 0;
  line-height: 1.5;
  font-size: var(--type-label);
}
.profile-copy p,
.profile-active { color: var(--text-secondary, #64748b); }
.profile-dirty { color: #b45309; }
.profile-error { color: #b91c1c; }
.profile-controls {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.65rem;
}
.profile-controls input {
  flex: 1;
  min-width: 0;
  min-height: 38px;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-color, #d5d9e2);
  border-radius: 8px;
  background: var(--card-bg, #fff);
  color: inherit;
}
.profile-apply { white-space: nowrap; }
.safety-note {
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.08);
  line-height: 1.55;
}
.preview-section h4,
.warning-section h4 { margin: 0 0 0.6rem; }
.preview-table-wrap { overflow-x: auto; }
.preview-table { width: 100%; border-collapse: collapse; font-size: var(--type-body); }
.preview-table th,
.preview-table td {
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  white-space: nowrap;
}
.preview-table th { text-align: left; color: var(--text-secondary, #64748b); }
.preview-table .number { text-align: right; font-variant-numeric: tabular-nums; }
.warning-section {
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(217, 119, 6, 0.28);
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.08);
}
.warning-section ul { margin: 0; padding-left: 1.25rem; }
.warning-section li { margin: 0.3rem 0; line-height: 1.45; }
.more-note { color: var(--text-secondary, #64748b); font-size: var(--type-label); }
.result-box {
  padding: 0.85rem 1rem;
  border-radius: 10px;
}
.result-box p { margin: 0.35rem 0 0; line-height: 1.5; }
.result-box.success { background: rgba(22, 163, 74, 0.1); }
.result-box.warning { background: rgba(245, 158, 11, 0.12); }
.result-box.error { background: rgba(220, 38, 38, 0.1); }
.primary-button,
.secondary-button {
  min-height: 38px;
  padding: 0.55rem 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.primary-button { border: 0; background: #2563eb; color: #fff; }
.primary-button:disabled { opacity: 0.55; cursor: not-allowed; }
.secondary-button {
  border: 1px solid var(--border-color, #d5d9e2);
  background: transparent;
  color: inherit;
}
@media (max-width: 700px) {
  .dialog-backdrop { align-items: flex-end; padding: 0; }
  .import-dialog { width: 100%; max-height: 92vh; border-radius: 14px 14px 0 0; }
  .summary-grid { grid-template-columns: 1fr; gap: 0.5rem; }
  .profile-controls { align-items: stretch; flex-direction: column; }
  .dialog-actions { position: sticky; bottom: 0; background: var(--card-bg, #fff); }
  .primary-button, .secondary-button { flex: 1; }
}
</style>
