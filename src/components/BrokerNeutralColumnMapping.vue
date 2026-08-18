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
      :disabled="importing || retrying"
      title="將其他券商 CSV 明確對應到 Canonical Trade CSV v1，預覽通過後可安全匯入"
      @click="chooseFile"
    >
      欄位對應匯入
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
              <p class="eyebrow">Explicit Mapping · Durable Import</p>
              <h2 id="mapping-title">其他券商 CSV 欄位對應</h2>
              <p v-if="fileName" class="file-name">{{ fileName }}</p>
            </div>
            <button
              type="button"
              class="icon-close"
              :disabled="importing || retrying"
              aria-label="關閉欄位對應"
              @click="closeDialog"
            >×</button>
          </header>

          <div class="dialog-body">
            <div class="safety-banner">
              <strong>先明確對應 → Canonical v1 預覽 → 最後確認寫入</strong>
              <span>
                系統不猜日期格式、BUY/SELL、幣別、正負號或重複交易。Mapping preview 本身仍是零寫入；
                只有重新驗證原始來源、mapping 與來源設定檔後，才會進入既有 durable record writer。
              </span>
            </div>

            <div v-if="reading" class="state-panel" role="status">正在讀取來源 CSV…</div>
            <div v-if="errorMessage" class="error-panel" role="alert">
              <strong>無法建立安全欄位對應</strong>
              <span>{{ errorMessage }}</span>
            </div>

            <template v-if="sourceTable">
              <section class="source-panel">
                <div class="section-heading">
                  <div>
                    <h3>來源欄位</h3>
                    <p>{{ sourceTable.rows.length }} 筆來源資料 · {{ sourceTable.headers.length }} 個欄位</p>
                  </div>
                  <button type="button" class="btn-secondary" :disabled="importing || retrying" @click="chooseFile">
                    重新選擇
                  </button>
                </div>
                <div class="source-header-list">
                  <code v-for="header in sourceTable.headers" :key="header">{{ header }}</code>
                </div>
              </section>

              <section class="preset-panel" aria-labelledby="mapping-preset-title">
                <div class="section-heading">
                  <div>
                    <h3 id="mapping-preset-title">已儲存的欄位對應</h3>
                    <p>Preset 只記住欄名與 mapping；不保存 CSV、交易資料或匯入來源設定檔。</p>
                  </div>
                </div>

                <p v-if="!signedOwner" class="preset-note">
                  登入後可將目前 mapping 儲存在這個瀏覽器；手動欄位對應與預覽不受影響。
                </p>
                <p v-if="presetCorrupted" class="preset-warning" role="status">
                  舊的 mapping preset 無法安全讀取，已忽略；手動 mapping 不受影響。下一次明確儲存會建立新的有效 preset。
                </p>

                <div v-if="signedOwner && exactPresets.length" class="preset-row">
                  <label for="mapping-preset-select">符合目前來源欄位</label>
                  <select
                    id="mapping-preset-select"
                    v-model="selectedPresetKey"
                    :disabled="importing || retrying"
                  >
                    <option value="">選擇已儲存 preset</option>
                    <option v-for="preset in exactPresets" :key="preset.label_key" :value="preset.label_key">
                      {{ preset.label }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn-secondary"
                    :disabled="!selectedPresetKey || importing || retrying"
                    @click="applySelectedPreset"
                  >套用</button>
                  <button
                    type="button"
                    class="btn-secondary danger-text"
                    :disabled="!selectedPresetKey || importing || retrying"
                    @click="deleteSelectedPreset"
                  >刪除</button>
                </div>
                <p v-else-if="signedOwner" class="preset-note">目前這組來源欄位沒有已儲存 preset。</p>

                <div v-if="signedOwner" class="preset-row save-row">
                  <label for="mapping-preset-label">Preset 名稱</label>
                  <input
                    id="mapping-preset-label"
                    v-model="presetLabel"
                    type="text"
                    maxlength="48"
                    autocomplete="off"
                    :disabled="importing || retrying"
                    placeholder="例如：富途成交明細 v1"
                  >
                  <button
                    type="button"
                    class="btn-secondary"
                    :disabled="!mappingReady || !presetLabel.trim() || importing || retrying"
                    @click="saveCurrentPreset"
                  >儲存目前對應</button>
                </div>
                <p v-if="presetFeedback" class="preset-feedback" role="status">{{ presetFeedback }}</p>
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
                    :disabled="importing || retrying"
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
                    :disabled="importing || retrying"
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
                  :disabled="!mappingReady || importing || retrying"
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
                      ? '這一層 preview 仍是零寫入；請設定來源名稱並明確確認後，才會建立 durable import intents。'
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

                <div v-if="mappedResult.canonical_preview.status === 'ready'" class="source-profile-card">
                  <label for="mapped-source-profile"><strong>匯入來源設定檔</strong></label>
                  <input
                    id="mapped-source-profile"
                    v-model="sourceProfile"
                    type="text"
                    maxlength="64"
                    autocomplete="off"
                    :disabled="importing || retrying"
                    placeholder="例如：富途主帳戶、Schwab 主帳戶"
                    @input="invalidateImportResult"
                  >
                  <p>
                    同一來源設定檔＋完全相同原始 CSV＋完全相同 mapping 會使用相同防重複識別。
                    原始檔或 mapping 任一變更都視為新來源；系統不以交易欄位相似度猜測重複。
                  </p>
                </div>
              </section>
            </template>

            <div v-if="importing" class="progress-panel" role="status" aria-live="polite">
              <strong>正在安全匯入 {{ progress.current }}/{{ progress.total }}</strong>
              <span>逐筆使用 source-bound stable key 提交；整批完成或停止後只做一次權威 readback 與重算。</span>
            </div>

            <div v-if="result" class="result-panel" :class="resultTone" role="status" aria-live="polite">
              <strong>{{ resultTitle }}</strong>
              <span>{{ resultMessage }}</span>
            </div>
            <ImportReconciliationReceipt
              :result="result"
              :retry-available="canRetryAmbiguous"
              :retrying="retrying"
              @retry="retryAmbiguousImport"
            />
          </div>

          <footer class="dialog-footer">
            <span>
              Mapping preview 本身 writes_allowed=false；實際寫入僅透過 reviewed durable record-create path。
            </span>
            <div class="footer-actions">
              <button type="button" class="btn-secondary" :disabled="importing || retrying" @click="closeDialog">
                {{ result ? '關閉' : '取消' }}
              </button>
              <button
                v-if="mappedResult?.canonical_preview?.status === 'ready' && !result"
                type="button"
                class="btn-primary"
                :disabled="!executionReady"
                @click="confirmImport"
              >
                {{ importing ? `匯入中 ${progress.current}/${progress.total}` : `確認匯入 ${mappedResult.source_row_count} 筆` }}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { CONFIG } from '../config.js';
import { useToast } from '../composables/useToast';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import ImportReconciliationReceipt from './ImportReconciliationReceipt.vue';
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
import {
  deleteBrokerMappingPreset,
  listBrokerMappingPresets,
  saveBrokerMappingPreset,
} from '../services/brokerNeutralMappingPresets.js';
import { prepareMappedBrokerImport } from '../services/brokerNeutralMappedImportExecution.js';
import { createBrokerNeutralRecord } from '../services/brokerNeutralRecordCreate.js';
import {
  IMPORT_AMBIGUOUS_RETRY_REASON,
  isAmbiguousImportRetryCandidate,
  prepareAmbiguousImportRetry,
} from '../services/importAmbiguousRetry.js';
import { runRecordImportBatch } from '../services/recordImportBatch.js';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const fileInput = ref(null);
const open = ref(false);
const reading = ref(false);
const importing = ref(false);
const retrying = ref(false);
const fileName = ref('');
const sourceText = ref('');
const sourceFileSize = ref(null);
const sourceTable = ref(null);
const mappedResult = ref(null);
const sourceProfile = ref('');
const errorMessage = ref('');
const result = ref(null);
const progress = ref({ current: 0, total: 0 });
const presetLabel = ref('');
const selectedPresetKey = ref('');
const exactPresets = ref([]);
const presetCorrupted = ref(false);
const presetFeedback = ref('');
const canonicalFields = CANONICAL_HEADERS;
const requiredFieldSet = new Set(REQUIRED_CANONICAL_HEADERS);
const constantFieldSet = new Set(CONSTANT_MAPPING_FIELDS);
const mappingState = reactive(Object.fromEntries(
  CANONICAL_HEADERS.map(field => [field, { sourceHeader: '', constant: '' }]),
));

const signedOwner = computed(() => authStore.user?.email || '');

const resetPresetState = () => {
  presetLabel.value = '';
  selectedPresetKey.value = '';
  exactPresets.value = [];
  presetCorrupted.value = false;
  presetFeedback.value = '';
};

const resetMapping = () => {
  for (const field of CANONICAL_HEADERS) {
    mappingState[field].sourceHeader = '';
    mappingState[field].constant = '';
  }
  mappedResult.value = null;
  result.value = null;
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
const sourceReady = computed(() => (
  mappedResult.value?.canonical_preview?.status === 'ready'
  && mappedResult.value?.canonical_preview?.counts?.blocked === 0
  && mappedResult.value?.source_row_count > 0
  && sourceText.value.length > 0
  && sourceProfile.value.trim().length > 0
));
const executionReady = computed(() => (
  !reading.value
  && !importing.value
  && !retrying.value
  && !result.value
  && sourceReady.value
));
const canRetryAmbiguous = computed(() => (
  !reading.value
  && !importing.value
  && !retrying.value
  && sourceReady.value
  && isAmbiguousImportRetryCandidate(result.value)
));

const resultTone = computed(() => {
  const status = result.value?.status;
  if (status === 'committed' || status === 'replayed') return 'success';
  if (status === 'failed') return 'error';
  return 'warning';
});

const resultTitle = computed(() => {
  const status = result.value?.status;
  if (status === 'committed') return '欄位對應匯入完成';
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
      ? '最後一筆回應不確定。可使用逐筆結果中的「安全續傳」先確認既有未定結果，再以相同原始檔、mapping 與來源識別續跑。'
      : '後續寫入已停止。修正問題後，以相同來源設定檔、同一原始檔與同一 mapping 重新執行即可安全續傳。';
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

const refreshExactPresets = () => {
  exactPresets.value = [];
  selectedPresetKey.value = '';
  presetCorrupted.value = false;
  if (!sourceTable.value || !signedOwner.value) return;
  try {
    const state = listBrokerMappingPresets(window.localStorage, signedOwner.value, {
      sourceHeaders: sourceTable.value.headers,
    });
    exactPresets.value = state.presets;
    presetCorrupted.value = state.corrupted;
  } catch (error) {
    presetFeedback.value = error?.message || '無法讀取 mapping preset；可繼續手動對應。';
  }
};

const applyPreset = (preset) => {
  if (!preset || importing.value || retrying.value) return;
  resetMapping();
  for (const field of CANONICAL_HEADERS) {
    const entry = preset.mapping[field];
    if (!entry) continue;
    if (entry.mode === MAPPING_SOURCE_MODE.COLUMN) mappingState[field].sourceHeader = entry.source_header;
    if (entry.mode === MAPPING_SOURCE_MODE.CONSTANT) mappingState[field].constant = entry.value;
  }
  selectedPresetKey.value = preset.label_key;
  presetLabel.value = preset.label;
  presetFeedback.value = `已套用「${preset.label}」；請重新建立 Canonical 預覽。`;
};

const applySelectedPreset = () => {
  const preset = exactPresets.value.find(item => item.label_key === selectedPresetKey.value);
  if (preset) applyPreset(preset);
};

const saveCurrentPreset = () => {
  if (retrying.value || !signedOwner.value || !sourceTable.value || !mappingReady.value || !presetLabel.value.trim()) return;
  try {
    const saved = saveBrokerMappingPreset(window.localStorage, signedOwner.value, {
      label: presetLabel.value,
      sourceHeaders: sourceTable.value.headers,
      mapping: mappingObject.value,
    });
    refreshExactPresets();
    selectedPresetKey.value = saved.preset.label_key;
    presetLabel.value = saved.preset.label;
    presetCorrupted.value = false;
    presetFeedback.value = saved.recovered_from_corruption
      ? `已忽略損壞的舊 preset，並儲存新的「${saved.preset.label}」。`
      : `已儲存「${saved.preset.label}」。`;
  } catch (error) {
    presetFeedback.value = error?.message || 'Mapping preset 儲存失敗。';
  }
};

const deleteSelectedPreset = () => {
  const preset = exactPresets.value.find(item => item.label_key === selectedPresetKey.value);
  if (!preset || !signedOwner.value || importing.value || retrying.value) return;
  if (!window.confirm(`刪除 mapping preset「${preset.label}」？`)) return;
  try {
    deleteBrokerMappingPreset(window.localStorage, signedOwner.value, preset.label);
    if (presetLabel.value === preset.label) presetLabel.value = '';
    refreshExactPresets();
    presetFeedback.value = `已刪除「${preset.label}」。`;
  } catch (error) {
    presetFeedback.value = error?.message || 'Mapping preset 刪除失敗。';
  }
};

const chooseFile = () => {
  if (importing.value || retrying.value) return;
  open.value = true;
  fileInput.value?.click();
};

const closeDialog = () => {
  if (importing.value || retrying.value) return;
  open.value = false;
};

const invalidateMappedPreview = () => {
  mappedResult.value = null;
  result.value = null;
};

const invalidateImportResult = () => {
  if (result.value) result.value = null;
};

const markMappingEdited = () => {
  selectedPresetKey.value = '';
  presetFeedback.value = presetLabel.value
    ? '目前 mapping 已修改；如需保留請儲存 preset。'
    : '';
  invalidateMappedPreview();
};

const handleColumnSelection = (field) => {
  if (retrying.value) return;
  if (mappingState[field].sourceHeader) mappingState[field].constant = '';
  markMappingEdited();
};

const handleConstantInput = (field) => {
  if (retrying.value) return;
  if (mappingState[field].constant) mappingState[field].sourceHeader = '';
  markMappingEdited();
};

const handleFileChange = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || retrying.value) return;

  open.value = true;
  reading.value = true;
  errorMessage.value = '';
  fileName.value = file.name || 'Broker CSV';
  sourceText.value = '';
  sourceFileSize.value = file.size;
  sourceTable.value = null;
  sourceProfile.value = '';
  progress.value = { current: 0, total: 0 };
  resetMapping();
  resetPresetState();

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
    refreshExactPresets();
  } catch (error) {
    errorMessage.value = error?.message || '來源 CSV 無法安全解析。';
  } finally {
    reading.value = false;
  }
};

const buildPreview = () => {
  if (retrying.value) return;
  errorMessage.value = '';
  result.value = null;
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

const prepareCurrentImport = () => prepareMappedBrokerImport(
  sourceText.value,
  mappingObject.value,
  sourceProfile.value,
  { fileSizeBytes: sourceFileSize.value },
);

const executePreparedImport = async (prepared, owner) => {
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
    addToast('欄位對應匯入未完成，沒有足夠證據宣告寫入成功', 'error');
  } finally {
    importing.value = false;
  }
};

const confirmImport = async () => {
  if (!executionReady.value) return;

  let prepared;
  try {
    prepared = await prepareCurrentImport();
  } catch (error) {
    errorMessage.value = error?.message || '欄位對應來源尚未達到安全匯入條件。';
    return;
  }

  const confirmation = [
    `確認匯入 ${prepared.entries.length} 筆欄位對應交易？`,
    `來源設定檔：${prepared.source_profile}`,
    '防重複識別綁定原始 CSV、完整 mapping contract 與來源列序。',
    '原始檔或 mapping 任一變更會視為新來源；系統不使用交易欄位相似度猜測重複。',
  ].join('\n');
  if (!window.confirm(confirmation)) return;

  const owner = signedOwner.value;
  if (!owner || !authStore.token) {
    addToast('請先登入再執行欄位對應匯入', 'error');
    return;
  }

  await executePreparedImport(prepared, owner);
};

const retryAmbiguousImport = async () => {
  if (!canRetryAmbiguous.value) return;
  const priorResult = result.value;

  let prepared;
  try {
    prepared = await prepareCurrentImport();
  } catch (error) {
    errorMessage.value = error?.message || '目前來源、mapping 或設定檔已不符合原本的安全匯入條件。';
    return;
  }

  const confirmation = [
    `安全續傳 ${prepared.entries.length} 筆欄位對應交易？`,
    `來源設定檔：${prepared.source_profile}`,
    '系統會先確認既有未定交易；確認完成後才以同一原始 CSV、完整 mapping 與穩定識別從頭重播。',
    '已確認項目會由伺服器判定為安全重播，不會用交易欄位相似度猜測重複。',
  ].join('\n');
  if (!window.confirm(confirmation)) return;

  const owner = signedOwner.value;
  if (!owner || !authStore.token) {
    addToast('請先登入再執行安全續傳', 'error');
    return;
  }

  retrying.value = true;
  try {
    const gate = await prepareAmbiguousImportRetry(priorResult, {
      entries: prepared.entries,
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

    await executePreparedImport(prepared, owner);
  } finally {
    retrying.value = false;
  }
};

watch(signedOwner, () => {
  presetFeedback.value = '';
  refreshExactPresets();
});

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
.tool-action-button:hover:not(:disabled),
.btn-secondary:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
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
.icon-close:hover:not(:disabled) { background: var(--bg-secondary); }
.dialog-body { display: grid; gap: 14px; overflow: auto; padding: 16px 18px; }
.safety-banner,
.state-panel,
.error-panel,
.source-panel,
.preset-panel,
.mapping-panel,
.mapped-preview,
.mapped-status-panel,
.source-profile-card,
.progress-panel,
.result-panel {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
}
.safety-banner { display: grid; gap: 4px; background: var(--bg-secondary); }
.state-panel { text-align: center; color: var(--text-muted); }
.error-panel { display: grid; gap: 4px; border-color: var(--danger, #dc2626); background: rgb(220 38 38 / 7%); }
.source-panel,
.preset-panel,
.mapping-panel,
.mapped-preview,
.source-profile-card { display: grid; gap: 12px; }
.section-heading p,
.preset-note,
.preset-feedback { margin: 0; color: var(--text-muted); }
.preset-warning { margin: 0; color: var(--warning, #d97706); }
.preset-feedback { font-weight: 600; }
.preset-row {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.3fr) auto auto;
  gap: 8px;
  align-items: center;
}
.preset-row select,
.preset-row input {
  min-width: 0;
  min-height: 36px;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-card, #fff);
  color: inherit;
  font: inherit;
}
.save-row { grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.3fr) auto; }
.danger-text { color: var(--danger, #dc2626); }
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
.mapping-row input,
.source-profile-card input {
  min-width: 0;
  min-height: 36px;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--bg-card, #fff);
  color: inherit;
  font: inherit;
}
.constant-unavailable { color: var(--text-muted); }
.mapping-status { color: var(--warning, #d97706); font-weight: 700; }
.mapping-status.ready { color: var(--success); }
.preview-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.preview-summary > div { display: flex; justify-content: space-between; gap: 8px; padding: 9px 10px; border: 1px solid var(--border-color); border-radius: 8px; }
.preview-summary span { color: var(--text-muted); }
.preview-summary .good strong { color: var(--success); }
.preview-summary .bad strong { color: var(--danger, #dc2626); }
.mapped-status-panel,
.progress-panel,
.result-panel { display: grid; gap: 4px; }
.mapped-status-panel.success { border-color: var(--success); background: rgb(16 185 129 / 7%); }
.mapped-status-panel.warning { border-color: var(--warning, #d97706); background: rgb(245 158 11 / 7%); }
.source-profile-card p { margin: 0; color: var(--text-muted); }
.progress-panel { border-color: var(--primary); background: var(--bg-secondary); }
.result-panel.success { background: rgb(16 185 129 / 8%); }
.result-panel.warning { background: rgb(245 158 11 / 9%); }
.result-panel.error { background: rgb(220 38 38 / 8%); }
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
.footer-actions { display: flex; gap: 8px; align-items: center; }

@media (max-width: 760px) {
  .mapping-overlay { padding: 0; align-items: end; }
  .mapping-dialog { width: 100%; max-height: 95vh; border-radius: 14px 14px 0 0; }
  .mapping-grid-header { display: none; }
  .mapping-grid,
  .preset-row,
  .save-row { grid-template-columns: 1fr; gap: 6px; }
  .mapping-row { padding: 10px 0; }
  .preview-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .preview-actions,
  .dialog-footer { align-items: stretch; flex-direction: column; }
  .preview-actions button,
  .footer-actions,
  .footer-actions button { width: 100%; }
  .footer-actions { flex-direction: column; }
}
</style>
