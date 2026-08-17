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
      title="預覽 Canonical Trade CSV；此版本不會寫入資料"
      aria-label="預覽通用交易 CSV"
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
              <p class="eyebrow">Broker-Neutral Preview</p>
              <h2 id="neutral-import-title">通用交易 CSV 預覽</h2>
            </div>
            <button type="button" class="icon-close" aria-label="關閉" @click="closeDialog">×</button>
          </header>

          <div class="dialog-body">
            <div class="zero-write-banner">
              <strong>零寫入預覽</strong>
              <span>只在瀏覽器讀取檔案；不建立、修改或刪除交易。</span>
            </div>

            <div class="contract-card">
              <p>
                第一版採明確的 <strong>Canonical Trade CSV v1</strong>，不猜券商欄位、幣別、日期格式或交易方向。
              </p>
              <div class="contract-row">
                <span class="contract-label">必要欄位</span>
                <code>{{ requiredHeaders.join(', ') }}</code>
              </div>
              <div class="contract-row">
                <span class="contract-label">選填欄位</span>
                <code>{{ optionalHeaders.join(', ') }}</code>
              </div>
              <p class="contract-note">txn_type 第一版只接受 BUY / SELL；日期固定 YYYY-MM-DD；currency 不會由 symbol 推測。</p>
            </div>

            <div v-if="errorMessage" class="error-panel" role="alert">
              <strong>無法建立預覽</strong>
              <span>{{ errorMessage }}</span>
            </div>

            <template v-if="preview">
              <div class="preview-summary" aria-label="CSV 預覽摘要">
                <div class="summary-item">
                  <span>來源列</span>
                  <strong>{{ preview.counts.rows }}</strong>
                </div>
                <div class="summary-item ready">
                  <span>可解析</span>
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

              <div v-if="preview.file_issues.length" class="schema-issues" role="alert">
                <strong>檔案契約尚未通過</strong>
                <ul>
                  <li v-for="issue in preview.file_issues" :key="issue.code">{{ issue.message }}</li>
                </ul>
              </div>

              <div v-if="preview.counts.duplicate_rows > 0" class="duplicate-note">
                偵測到 {{ preview.counts.duplicate_rows }} 列具有重複交易欄位，已保留為獨立來源列；預覽不會自動去重。
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
                          {{ row.status === 'ready' ? '可解析' : '阻擋' }}
                        </span>
                      </td>
                      <td>{{ row.payload.txn_date || '—' }}</td>
                      <td>{{ row.payload.symbol || '—' }}</td>
                      <td>{{ row.payload.txn_type || '—' }}</td>
                      <td class="num">{{ displayNumber(row.payload.qty) }}</td>
                      <td class="num">{{ displayNumber(row.payload.price) }}</td>
                      <td>{{ row.payload.currency || '—' }}</td>
                      <td class="row-feedback">
                        <span v-if="row.issues.length === 0 && row.warnings.length === 0">通過</span>
                        <span v-for="issue in row.issues" :key="`i-${issue.code}-${issue.field}`" class="issue-text">
                          {{ issue.message }}
                        </span>
                        <span v-for="warning in row.warnings" :key="`w-${warning.code}-${warning.field}`" class="warning-text">
                          {{ warning.message }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p v-if="preview.rows.length > visibleRows.length" class="row-limit-note">
                畫面僅顯示前 {{ visibleRows.length }} 列；摘要仍涵蓋全部 {{ preview.rows.length }} 列。
              </p>
            </template>
          </div>

          <footer class="dialog-footer">
            <span class="write-state">writes_allowed = false</span>
            <div class="footer-actions">
              <button type="button" class="btn-secondary" @click="openPicker">重新選擇</button>
              <button type="button" class="btn-primary" @click="closeDialog">完成</button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  MAX_CANONICAL_CSV_BYTES,
  OPTIONAL_CANONICAL_HEADERS,
  REQUIRED_CANONICAL_HEADERS,
  buildCanonicalTradeCsvPreview,
} from '../services/brokerNeutralImportPreview.js';

const fileInput = ref(null);
const dialogOpen = ref(false);
const preview = ref(null);
const errorMessage = ref('');

const requiredHeaders = REQUIRED_CANONICAL_HEADERS;
const optionalHeaders = OPTIONAL_CANONICAL_HEADERS;
const visibleRows = computed(() => preview.value?.rows?.slice(0, 20) || []);

const openPicker = () => {
  dialogOpen.value = true;
  fileInput.value?.click();
};

const closeDialog = () => {
  dialogOpen.value = false;
};

const handleFileChange = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  dialogOpen.value = true;
  preview.value = null;
  errorMessage.value = '';

  if (file.size > MAX_CANONICAL_CSV_BYTES) {
    errorMessage.value = 'CSV 超過 2 MiB 上限。';
    return;
  }

  try {
    const text = await file.text();
    preview.value = buildCanonicalTradeCsvPreview(text, { fileSizeBytes: file.size });
  } catch (error) {
    errorMessage.value = error?.message || 'CSV 格式無法確認。';
  }
};

const displayNumber = (value) => (
  Number.isFinite(value) ? String(value) : '—'
);
</script>

<style scoped>
.neutral-import-action {
  display: inline-flex;
  flex: 0 0 auto;
}

.sr-file-input {
  position: fixed;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.neutral-import-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
}

.neutral-import-button:hover {
  border-color: var(--primary);
  color: var(--primary);
}

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
  max-height: min(86vh, 900px);
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

.dialog-header {
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h2,
.dialog-header p {
  margin: 0;
}

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

.icon-close:hover {
  background: var(--bg-secondary);
}

.dialog-body {
  display: grid;
  gap: 14px;
  overflow: auto;
  padding: 16px 18px;
}

.zero-write-banner,
.contract-card,
.error-panel,
.schema-issues,
.duplicate-note {
  border-radius: 10px;
  padding: 12px 14px;
}

.zero-write-banner {
  display: flex;
  gap: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.contract-card {
  display: grid;
  gap: 8px;
  border: 1px solid var(--border-color);
}

.contract-card p {
  margin: 0;
}

.contract-row {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.contract-label {
  color: var(--text-muted);
  font-weight: 700;
}

.contract-row code {
  overflow-wrap: anywhere;
}

.contract-note {
  color: var(--text-muted);
}

.error-panel,
.schema-issues {
  display: grid;
  gap: 6px;
  border: 1px solid var(--danger, #dc2626);
  background: color-mix(in srgb, var(--danger, #dc2626) 8%, transparent);
}

.schema-issues ul {
  margin: 0;
  padding-left: 20px;
}

.duplicate-note {
  border: 1px solid var(--warning, #d97706);
  background: color-mix(in srgb, var(--warning, #d97706) 8%, transparent);
}

.preview-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.summary-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.summary-item span {
  color: var(--text-muted);
}

.preview-table-wrap {
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.preview-table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
}

.preview-table th,
.preview-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
  vertical-align: top;
}

.preview-table th {
  position: sticky;
  top: 0;
  background: var(--bg-card, #fff);
  z-index: 1;
}

.preview-table .num {
  text-align: right;
}

.row-status {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--bg-secondary);
  font-weight: 700;
  white-space: nowrap;
}

.row-status.ready {
  color: var(--success, #15803d);
}

.row-status.blocked,
.issue-text {
  color: var(--danger, #dc2626);
}

.row-feedback {
  min-width: 260px;
}

.row-feedback span {
  display: block;
}

.warning-text {
  color: var(--warning, #b45309);
}

.empty-preview,
.row-limit-note {
  color: var(--text-muted);
}

.empty-preview {
  text-align: center !important;
}

.row-limit-note {
  margin: 0;
}

.dialog-footer {
  border-top: 1px solid var(--border-color);
}

.write-state {
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.btn-secondary,
.btn-primary {
  min-height: 38px;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.btn-secondary {
  border: 1px solid var(--border-color);
  background: var(--bg-card, #fff);
  color: inherit;
}

.btn-primary {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
}

@media (max-width: 720px) {
  .neutral-import-overlay {
    align-items: end;
    padding: 0;
  }

  .neutral-import-dialog {
    width: 100%;
    max-height: 92vh;
    border-radius: 14px 14px 0 0;
  }

  .preview-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .contract-row {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .dialog-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-actions {
    width: 100%;
  }

  .footer-actions button {
    flex: 1;
  }
}
</style>
