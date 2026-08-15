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
      :disabled="importing"
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
              :disabled="importing"
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

            <div class="safety-note">
              目前只匯入可安全辨識的 <strong>STK BUY / SELL</strong> 成交；同一 Order 的多個 fills 會合併。
              無法確認帳戶、代碼、幣別或成交完整性的資料不會寫入。
            </div>

            <div v-if="preview.entries.length > 0" class="preview-section">
              <h4>寫入前預覽</h4>
              <div class="preview-table-wrap">
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>帳戶</th>
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
                      <td>{{ maskAccount(entry.source.accountId) }}</td>
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
          </template>

          <footer class="dialog-actions">
            <button type="button" class="secondary-button" :disabled="importing" @click="closeDialog">
              {{ result ? '關閉' : '取消' }}
            </button>
            <button
              v-if="preview && !result"
              type="button"
              class="primary-button"
              :disabled="importing || preview.entries.length === 0"
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
import { createIbkrRecord } from '../services/ibkrRecordCreate.js';
import { parseIbkrTradeCsv } from '../services/ibkrTradeImport.js';
import { runIbkrTradeImportBatch } from '../services/ibkrTradeImportBatch.js';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const fileInput = ref(null);
const showDialog = ref(false);
const reading = ref(false);
const importing = ref(false);
const fileName = ref('');
const preview = ref(null);
const result = ref(null);
const progress = ref({ current: 0, total: 0 });

const progressText = computed(() => (
  progress.value.total > 0 ? `${progress.value.current}/${progress.value.total}` : ''
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
  if (status === 'committed_with_sync_warning') return '交易已保存，資料同步尚未完成';
  if (status === 'replayed_with_sync_warning') return '交易已存在，最新清單暫時無法重新載入';
  if (status === 'partial_failure') return '部分交易已處理';
  return '匯入未完成';
});

const resultMessage = computed(() => {
  if (!result.value) return '';
  const base = `已處理 ${result.value.processed}/${result.value.total} 筆；新增 ${result.value.created} 筆，已存在 ${result.value.replayed} 筆。`;
  if (result.value.status === 'partial_failure') {
    const ambiguity = result.value.failure?.outcomeAmbiguous === true
      ? '最後一筆回應不確定，請直接重新匯入同一檔案確認；已成功項目不會重複新增。'
      : '後續寫入已停止。修正問題後可重新匯入同一檔案；已成功項目不會重複新增。';
    return `${base} ${ambiguity}`;
  }
  if (result.value.status === 'committed_with_sync_warning') {
    return `${base} 帳本寫入已確認，不需要重新匯入；稍後重新整理或使用「立即更新」即可繼續同步。`;
  }
  if (result.value.status === 'replayed_with_sync_warning') {
    return `${base} 不需要重新匯入；稍後重新整理即可。`;
  }
  if (result.value.status === 'failed') {
    return `${base} 沒有已確認的新寫入。請依提示修正後再試。`;
  }
  return base;
});

const chooseFile = () => {
  if (importing.value) return;
  fileInput.value?.click();
};

const resetState = () => {
  reading.value = false;
  importing.value = false;
  fileName.value = '';
  preview.value = null;
  result.value = null;
  progress.value = { current: 0, total: 0 };
};

const closeDialog = () => {
  if (importing.value) return;
  showDialog.value = false;
  resetState();
};

const handleFileChange = async (event) => {
  const file = event.target?.files?.[0];
  if (fileInput.value) fileInput.value.value = '';
  if (!file) return;

  resetState();
  showDialog.value = true;
  reading.value = true;
  fileName.value = file.name || 'IBKR CSV';
  try {
    const contents = await file.text();
    preview.value = parseIbkrTradeCsv(contents);
    if (preview.value.entries.length === 0) {
      addToast('這份 IBKR 檔案沒有可安全匯入的股票成交', 'warning');
    }
  } catch (error) {
    preview.value = {
      status: 'invalid',
      entries: [],
      warnings: [{ rowNumber: null, code: 'FILE_READ_FAILED', message: '檔案無法讀取，請重新匯出 CSV 後再試' }],
      summary: { rows: 0, importable: 0, skipped: 1 },
    };
  } finally {
    reading.value = false;
  }
};

const confirmImport = async () => {
  if (importing.value || !preview.value?.entries?.length) return;
  importing.value = true;
  result.value = null;
  progress.value = { current: 0, total: preview.value.entries.length };

  const owner = authStore.user?.email || '';
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
    addToast(`${resultTitle.value}：新增 ${result.value.created}、已存在 ${result.value.replayed}`, type);
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

const maskAccount = (accountId) => {
  const value = String(accountId || '').trim();
  if (!value) return '—';
  if (value.length <= 4) return value;
  return `•••${value.slice(-4)}`;
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
.file-name { margin: 0.25rem 0 0; color: var(--text-secondary, #64748b); font-size: 0.85rem; }
.close-button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1.1rem;
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
.summary-item strong { font-size: 1.15rem; }
.summary-item.good strong { color: #15803d; }
.summary-item.warning strong { color: #b45309; }
.safety-note,
.preview-section,
.warning-section,
.result-box { margin: 1rem 1.25rem; }
.safety-note {
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.08);
  line-height: 1.55;
}
.preview-section h4,
.warning-section h4 { margin: 0 0 0.6rem; }
.preview-table-wrap { overflow-x: auto; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
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
.more-note { color: var(--text-secondary, #64748b); font-size: 0.82rem; }
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
  .dialog-actions { position: sticky; bottom: 0; background: var(--card-bg, #fff); }
  .primary-button, .secondary-button { flex: 1; }
}
</style>
