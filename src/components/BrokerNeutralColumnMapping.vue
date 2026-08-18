<template>
  <div class="mapping-action">
    <input
      ref="fileInput"
      type="file"
      class="sr-file-input"
      accept=".csv,text/csv"
      aria-label="選擇需要欄位對應的券商 CSV"
      @change="handleFileChange"
    >
    <button
      type="button"
      class="tool-action-button"
      title="將其他券商 CSV 欄位明確對應到 Canonical Trade CSV v1；只預覽、不寫入"
      @click="chooseFile"
    >
      欄位對應預覽
    </button>

    <Teleport to="body">
      <div v-if="open" class="mapping-overlay" @click.self="closeDialog">
        <section
          class="mapping-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mapping-title"
        >
          <header class="dialog-header">
            <div>
              <p class="eyebrow">Explicit Mapping · Zero Write</p>
              <h2 id="mapping-title">其他券商 CSV 欄位對應</h2>
              <p v-if="fileName" class="file-name">{{ fileName }}</p>
            </div>
            <button type="button" class="icon-close" aria-label="關閉欄位對應" @click="closeDialog">×</button>
          </header>

          <div class="dialog-body">
            <div class="zero-write-banner">
              <strong>此階段不會寫入交易</strong>
              <span>
                你明確指定來源欄位或固定值；系統不猜日期格式、BUY/SELL、幣別、正負號或重複交易。
                對應後仍必須通過原 Canonical Trade CSV v1 validator。
              </span>
            </div>

            <div v-if="reading" class="state-panel" role="status">正在讀取來源 CSV…</div>
            <div v-if="errorMessage" class="error-panel" role="alert">
              <strong>無法建立欄位對應預覽</strong>
              <span>{{ errorMessage }}</span>
            </div>

            <template v-if="sourceTable">
              <section class="source-panel">
                <div class="section-heading">
                  <div>
                    <h3>來源欄位</h3>
                    <p>{{ sourceTable.rows.length }} 筆來源資料 · {{ sourceTable.headers.length }} 個欄位</p>
                  </div>
                  <button type="button" class="btn-secondary" @click="chooseFile">重新選擇</button>
                </div>
                <div class="source-header-list">
                  <code v-for="header in sourceTable.headers" :key="header">{{ header }}</code>
                </div>
              </section>

              <section class="mapping-panel">
                <div class="section-heading">
                  <div>
                    <h3>明確欄位對應</h3>
                    <p>必要欄位全部對應後才能建立 Canonical 預覽；選填欄位可留空。</p>
                  </div>
                </div>

                <div class="mapping-grid mapping-grid-header" aria-hidden="true">
                  <span>Canonical 欄位</span>
                  <span>來源欄位</span>
                  <span>明確固定值</span>
                </div>

                <div
                  v-for="field in canonicalFields"
                  :key="field"
                  class="mapping-grid mapping-row"
                >
                  <label :for="`map-${field}`" class="field-label">
                    <code>{{ field }}</code>
                    <span v-if="requiredFieldSet.has(field)" class="required-badge">必要</span>
                    <span v-else class="optional-badge">選填</span>
                  </label>

                  <select
                    :id="`map-${field}`"
                    v-model="mappingState[field].sourceHeader"
                    @change="handleColumnSelection(field)"
                  >
                    <option value="">未對應</option>
                    <option v-for="header in sourceTable.headers" :key="header" :value="header">
                      {{ header }}
                    </option>
                  </select>

                  <input
                    v-if="constantFieldSet.has(field)"
                    v-model="mappingState[field].constant"
                    type="text"
                    :placeholder="constantPlaceholder(field)"
                    @input="handleConstantInput(field)"
                  >
                  <span v-else class="constant-unavailable">不提供固定值</span>
                </div>
              </section>

              <div class="preview-actions">
                <span class="mapping-status" :class="{ ready: mappingReady }">
                  {{ mappingReady ? '必要欄位已全部明確對應' : `尚缺 ${missingRequired.length} 個必要欄位` }}
                </span>
                <button
                  type="button"
                  class="btn-primary"
                  :disabled="!mappingReady"
                  @click="buildPreview"
                >建立零寫入預覽</button>
              </div>

              <section v-if="mappedResult" class="mapped-preview">
                <div class="preview-summary">
                  <div>
                    <span>來源資料</span>
                    <strong>{{ mappedResult.source_row_count }}</strong>
                  </div>
                  <div class="good">
                    <span>Canonical 可通過</span>
                    <strong>{{ mappedResult.canonical_preview.counts.ready }}</strong>
                  </div>
                  <div :class="{ bad: mappedResult.canonical_preview.counts.blocked > 0 }">
                    <span>阻擋</span>
                    <strong>{{ mappedResult.canonical_preview.counts.blocked }}</strong>
                  </div>
                  <div>
                    <span>提醒</span>
                    <strong>{{ mappedResult.canonical_preview.counts.warnings }}</strong>
                  </div>
                </div>

                <div
                  class="mapped-status-panel"
                  :class="mappedResult.canonical_preview.status === 'ready' ? 'success' : 'warning'"
                >
                  <strong>
                    {{ mappedResult.canonical_preview.status === 'ready'
                      ? '欄位對應後已通過 Canonical v1 檢查'
                      : '欄位已對應，但 Canonical 資料語意仍未全部通過' }}
                  </strong>
                  <span>
                    {{ mappedResult.canonical_preview.status === 'ready'
                      ? '此結果仍是零寫入預覽；本階段不會建立交易。'
                      : '請依下方阻擋原因修正來源資料或欄位對應；系統不會自動轉換。' }}
                  </span>
                </div>

                <div class="mapped-table-wrap">
                  <table class="mapped-table">
                    <thead>
                      <tr>
                        <th>列</th>
                        <th>狀態</th>
                        <th>日期</th>
                        <th>代碼</th>
                        <th>類型</th>
                        <th>股數</th>
                        <th>價格</th>
                        <th>幣別</th>
                        <th>檢查結果</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in mappedRows" :key="row.row_number">
                        <td>{{ row.row_number }}</td>
                        <td>{{ row.status === 'ready' ? '通過' : '阻擋' }}</td>
                        <td>{{ row.payload.txn_date || '—' }}</td>
                        <td><strong>{{ row.payload.symbol || '—' }}</strong></td>
                        <td>{{ row.payload.txn_type || '—' }}</td>
                        <td class="num">{{ displayNumber(row.payload.qty) }}</td>
                        <td class="num">{{ displayNumber(row.payload.price) }}</td>
                        <td>{{ row.payload.currency || '—' }}</td>
                        <td class="feedback-cell">
                          <span v-if="row.issues.length === 0 && row.warnings.length === 0">通過</span>
                          <span v-for="issue in row.issues" :key="`${row.row_number}-i-${issue.code}`" class="bad-text">
                            {{ issue.message }}
                          </span>
                          <span v-for="warning in row.warnings" :key="`${row.row_number}-w-${warning.code}`" class="warning-text">
                            {{ warning.message }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-if="mappedResult.canonical_preview.rows.length > mappedRows.length" class="more-note">
                  畫面僅顯示前 {{ mappedRows.length }} 筆；摘要仍涵蓋全部 {{ mappedResult.canonical_preview.rows.length }} 筆。
                </p>
              </section>
            </template>
          </div>

          <footer class="dialog-footer">
            <span>零寫入 mapping preview · 不建立第二套財務語意</span>
            <button type="button" class="btn-primary" @click="closeDialog">完成</button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import {
  CANONICAL_HEADERS,
  MAX_CANONICAL_CSV_BYTES,
  REQUIRED_CANONICAL_HEADERS,
} from '../services/brokerNeutralImportPreview.js';
import {
  CONSTANT_MAPPING_FIELDS,
  MAPPING_SOURCE_MODE,
  buildMappedCanonicalTradePreview,
  parseBrokerSourceCsv,
} from '../services/brokerNeutralColumnMapping.js';

const fileInput = ref(null);
const open = ref(false);
const reading = ref(false);
const fileName = ref('');
const sourceText = ref('');
const sourceFileSize = ref(null);
const sourceTable = ref(null);
const mappedResult = ref(null);
const errorMessage = ref('');
const canonicalFields = CANONICAL_HEADERS;
const requiredFieldSet = new Set(REQUIRED_CANONICAL_HEADERS);
const constantFieldSet = new Set(CONSTANT_MAPPING_FIELDS);
const mappingState = reactive(Object.fromEntries(
  CANONICAL_HEADERS.map(field => [field, { sourceHeader: '', constant: '' }]),
));

const resetMapping = () => {
  for (const field of CANONICAL_HEADERS) {
    mappingState[field].sourceHeader = '';
    mappingState[field].constant = '';
  }
  mappedResult.value = null;
};

const applyExactHeaderDefaults = () => {
  const available = new Set(sourceTable.value?.headers || []);
  for (const field of CANONICAL_HEADERS) {
    if (available.has(field)) mappingState[field].sourceHeader = field;
  }
};

const mappedEntry = (field) => {
  const state = mappingState[field];
  if (state.sourceHeader) {
    return { mode: MAPPING_SOURCE_MODE.COLUMN, source_header: state.sourceHeader };
  }
  if (constantFieldSet.has(field) && state.constant.trim()) {
    return { mode: MAPPING_SOURCE_MODE.CONSTANT, value: state.constant.trim() };
  }
  return null;
};

const mappingObject = computed(() => Object.fromEntries(
  CANONICAL_HEADERS.map(field => [field, mappedEntry(field)]),
));

const missingRequired = computed(() => REQUIRED_CANONICAL_HEADERS.filter(field => !mappedEntry(field)));
const mappingReady = computed(() => Boolean(sourceTable.value) && missingRequired.value.length === 0);
const mappedRows = computed(() => mappedResult.value?.canonical_preview?.rows?.slice(0, 12) || []);

const chooseFile = () => {
  open.value = true;
  fileInput.value?.click();
};

const closeDialog = () => {
  open.value = false;
};

const handleColumnSelection = (field) => {
  if (mappingState[field].sourceHeader) mappingState[field].constant = '';
  mappedResult.value = null;
};

const handleConstantInput = (field) => {
  if (mappingState[field].constant) mappingState[field].sourceHeader = '';
  mappedResult.value = null;
};

const handleFileChange = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  open.value = true;
  reading.value = true;
  errorMessage.value = '';
  fileName.value = file.name || 'Broker CSV';
  sourceText.value = '';
  sourceFileSize.value = file.size;
  sourceTable.value = null;
  resetMapping();

  if (file.size > MAX_CANONICAL_CSV_BYTES) {
    reading.value = false;
    errorMessage.value = 'CSV 超過 2 MiB 上限。';
    return;
  }

  try {
    const text = await file.text();
    const table = parseBrokerSourceCsv(text, { fileSizeBytes: file.size });
    sourceText.value = text;
    sourceTable.value = table;
    applyExactHeaderDefaults();
  } catch (error) {
    errorMessage.value = error?.message || '來源 CSV 無法安全解析。';
  } finally {
    reading.value = false;
  }
};

const buildPreview = () => {
  errorMessage.value = '';
  mappedResult.value = null;
  try {
    mappedResult.value = buildMappedCanonicalTradePreview(
      sourceText.value,
      mappingObject.value,
      { fileSizeBytes: sourceFileSize.value },
    );
  } catch (error) {
    errorMessage.value = error?.message || '欄位對應無法建立 Canonical 預覽。';
  }
};

const constantPlaceholder = (field) => {
  if (field === 'currency') return '例：USD';
  if (field === 'txn_type') return '只接受 BUY 或 SELL';
  if (field === 'tag') return '例：Stock';
  if (field === 'note') return '固定備註（選填）';
  return '';
};

const displayNumber = value => (Number.isFinite(value) ? String(value) : '—');
</script>

<style scoped>
.mapping-action { display: block; }
.sr-file-input { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.tool-action-button,
.btn-primary,
.btn-secondary {
  min-height: 36px;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.tool-action-button { width: 100%; background: var(--bg-card, #fff); color: inherit; text-align: left; }
.tool-action-button:hover,
.btn-secondary:hover { border-color: var(--primary); color: var(--primary); }
.btn-primary { border-color: var(--primary); background: var(--primary); color: #fff; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
.mapping-overlay {
  position: fixed;
  inset: 0;
  z-index: 3300;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(15 23 42 / 58%);
}
.mapping-dialog {
  display: flex;
  flex-direction: column;
  width: min(1180px, 96vw);
  max-height: min(90vh, 940px);
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-card, #fff);
  color: var(--text-main, inherit);
  box-shadow: 0 24px 70px rgb(15 23 42 / 24%);
}
.dialog-header,
.dialog-footer,
.section-heading,
.preview-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.dialog-header,
.dialog-footer { padding: 15px 18px; }
.dialog-header { border-bottom: 1px solid var(--border-color); }
.dialog-footer { border-top: 1px solid var(--border-color); color: var(--text-muted); }
.dialog-header h2,
.dialog-header p,
.section-heading h3,
.section-heading p { margin: 0; }
.eyebrow { color: var(--text-muted); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.file-name { margin-top: 3px !important; color: var(--text-muted); }
.icon-close { min-width: 36px; min-height: 36px; border: 0; border-radius: 8px; background: transparent; cursor: pointer; font: inherit; }
.icon-close:hover { background: var(--bg-secondary); }
.dialog-body { display: grid; gap: 14px; overflow: auto; padding: 16px 18px; }
.zero-write-banner,
.state-panel,
.error-panel,
.source-panel,
.mapping-panel,
.mapped-preview,
.mapped-status-panel {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
}
.zero-write-banner { display: grid; gap: 4px; background: var(--bg-secondary); }
.state-panel { text-align: center; color: var(--text-muted); }
.error-panel { display: grid; gap: 4px; border-color: var(--danger, #dc2626); background: rgb(220 38 38 / 7%); }
.source-panel,
.mapping-panel,
.mapped-preview { display: grid; gap: 12px; }
.section-heading p { margin-top: 3px; color: var(--text-muted); }
.source-header-list { display: flex; flex-wrap: wrap; gap: 6px; }
.source-header-list code { padding: 4px 7px; border-radius: 6px; background: var(--bg-secondary); }
.mapping-grid { display: grid; grid-template-columns: minmax(170px, 0.8fr) minmax(220px, 1.2fr) minmax(220px, 1fr); gap: 10px; align-items: center; }
.mapping-grid-header { color: var(--text-muted); font-weight: 700; }
.mapping-row { padding: 7px 0; border-top: 1px solid var(--border-color); }
.field-label { display: flex; align-items: center; gap: 7px; }
.required-badge,
.optional-badge { padding: 2px 6px; border-radius: 999px; font-size: var(--type-caption); }
.required-badge { color: var(--danger, #dc2626); background: rgb(220 38 38 / 8%); }
.optional-badge { color: var(--text-muted); background: var(--bg-secondary); }
.mapping-row select,
.mapping-row input { min-width: 0; min-height: 36px; padding: 0.45rem 0.55rem; border: 1px solid var(--border-color); border-radius: 7px; background: var(--bg-card, #fff); color: inherit; font: inherit; }
.constant-unavailable { color: var(--text-muted); }
.mapping-status { color: var(--warning, #d97706); font-weight: 700; }
.mapping-status.ready { color: var(--success); }
.preview-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.preview-summary > div { display: flex; justify-content: space-between; gap: 8px; padding: 9px 10px; border: 1px solid var(--border-color); border-radius: 8px; }
.preview-summary span { color: var(--text-muted); }
.preview-summary .good strong { color: var(--success); }
.preview-summary .bad strong { color: var(--danger, #dc2626); }
.mapped-status-panel { display: grid; gap: 4px; }
.mapped-status-panel.success { border-color: var(--success); background: rgb(16 185 129 / 7%); }
.mapped-status-panel.warning { border-color: var(--warning, #d97706); background: rgb(245 158 11 / 7%); }
.mapped-table-wrap { overflow: auto; border: 1px solid var(--border-color); border-radius: 8px; }
.mapped-table { width: 100%; min-width: 930px; border-collapse: collapse; }
.mapped-table th,
.mapped-table td { padding: 7px 9px; border-bottom: 1px solid var(--border-color); text-align: left; }
.mapped-table th { color: var(--text-muted); background: var(--bg-secondary); }
.mapped-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.feedback-cell { display: grid; gap: 2px; min-width: 220px; }
.bad-text { color: var(--danger, #dc2626); }
.warning-text { color: var(--warning, #d97706); }
.more-note { margin: 0; color: var(--text-muted); }

@media (max-width: 760px) {
  .mapping-overlay { padding: 0; align-items: end; }
  .mapping-dialog { width: 100%; max-height: 95vh; border-radius: 14px 14px 0 0; }
  .mapping-grid-header { display: none; }
  .mapping-grid { grid-template-columns: 1fr; gap: 6px; }
  .mapping-row { padding: 10px 0; }
  .preview-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .preview-actions,
  .dialog-footer { align-items: stretch; flex-direction: column; }
  .preview-actions button,
  .dialog-footer button { width: 100%; }
}
</style>
