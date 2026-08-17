<template>
  <section v-if="missingRecords.length > 0" class="currency-reconciliation" aria-labelledby="currency-reconciliation-title">
    <div class="reconciliation-summary">
      <div>
        <span class="eyebrow">現金帳本準備</span>
        <h4 id="currency-reconciliation-title">{{ missingRecords.length }} 筆交易缺少已確認報價單位</h4>
        <p>
          建議值只由 Symbol 市場後綴推測，不會自動寫入。請確認後再勾選；這裡只補 metadata，不會重算持倉或啟用現金 NAV。
        </p>
      </div>
      <button type="button" class="toggle-button" @click="expanded = !expanded" :aria-expanded="expanded">
        {{ expanded ? '收合' : '開始修復' }}
      </button>
    </div>

    <div v-if="expanded" class="reconciliation-body">
      <div class="bulk-actions">
        <button type="button" class="secondary-button" @click="selectAllSuggested" :disabled="repairing">
          全選建議值
        </button>
        <button type="button" class="secondary-button" @click="clearSelection" :disabled="repairing || selectedIds.length === 0">
          清除選取
        </button>
        <span class="selection-count">已選 {{ selectedIds.length }} 筆</span>
      </div>

      <div class="record-list">
        <div v-for="record in missingRecords" :key="record.id" class="record-row">
          <label class="record-selector">
            <input
              type="checkbox"
              :checked="selectedIds.includes(Number(record.id))"
              :disabled="repairing"
              @change="toggleSelection(record.id, $event.target.checked)"
            >
            <span class="record-identity">
              <strong>{{ record.symbol }}</strong>
              <span>{{ record.txn_date }} · {{ record.txn_type }}</span>
            </span>
          </label>

          <div class="currency-editor">
            <label :for="`currency-repair-${record.id}`">報價單位</label>
            <input
              :id="`currency-repair-${record.id}`"
              :value="drafts[record.id] || ''"
              list="record-currency-options"
              autocomplete="off"
              maxlength="3"
              spellcheck="false"
              :disabled="repairing"
              :aria-invalid="selectedIds.includes(Number(record.id)) && !normalizedDraft(record.id)"
              @input="setDraft(record.id, $event.target.value)"
              @blur="normalizeDraft(record.id)"
            >
            <span class="candidate-note">建議：{{ suggestedCurrency(record) }}</span>
          </div>
        </div>
      </div>

      <datalist id="record-currency-options">
        <option v-for="currency in currencyOptions" :key="currency" :value="currency"></option>
      </datalist>

      <div class="reconciliation-footer">
        <p class="authority-note">
          `GBp` 代表英股便士報價單位，不等於 GBP 現金結算。未勾選的交易不會被修改。
        </p>
        <button
          type="button"
          class="primary-button"
          :disabled="repairing || selectedIds.length === 0 || selectedHasInvalidCurrency"
          @click="confirmSelected"
        >
          {{ repairing ? '確認中…' : `確認並儲存 ${selectedIds.length} 筆` }}
        </button>
      </div>

      <p v-if="selectedHasInvalidCurrency" class="error-message" role="alert">
        已選取的交易中有無效報價單位；請使用三碼幣別代碼或 GBp。
      </p>
      <p v-if="resultMessage" class="result-message" :class="resultTone" aria-live="polite">
        {{ resultMessage }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { CONFIG } from '../config';
import { useToast } from '../composables/useToast';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import {
  detectNativeCurrency,
  NATIVE_CURRENCY_OPTIONS,
  normalizeNativeCurrency,
} from '../services/instrumentCurrency.js';
import { getStoredRecordCurrency } from '../services/recordHistoryPresentation.js';
import { reconcileRecordCurrencies } from '../services/recordCurrencyReconciliation.js';

const store = usePortfolioStore();
const auth = useAuthStore();
const { addToast } = useToast();

const expanded = ref(false);
const repairing = ref(false);
const selectedIds = ref([]);
const drafts = reactive({});
const resultMessage = ref('');
const resultTone = ref('');
const currencyOptions = NATIVE_CURRENCY_OPTIONS;

const missingRecords = computed(() => store.records.filter(record => !getStoredRecordCurrency(record)));

const suggestedCurrency = record => detectNativeCurrency(record?.symbol);
const normalizedDraft = id => normalizeNativeCurrency(drafts[id]);

watch(missingRecords, (records) => {
  const missingIds = new Set(records.map(record => Number(record.id)));
  selectedIds.value = selectedIds.value.filter(id => missingIds.has(id));
  for (const record of records) {
    if (!(record.id in drafts)) drafts[record.id] = suggestedCurrency(record);
  }
}, { immediate: true });

const setDraft = (id, value) => {
  drafts[id] = value;
  resultMessage.value = '';
};

const normalizeDraft = (id) => {
  const normalized = normalizeNativeCurrency(drafts[id]);
  if (normalized) drafts[id] = normalized;
};

const toggleSelection = (id, checked) => {
  const numericId = Number(id);
  const next = new Set(selectedIds.value);
  if (checked) next.add(numericId);
  else next.delete(numericId);
  selectedIds.value = [...next];
  resultMessage.value = '';
};

const selectAllSuggested = () => {
  for (const record of missingRecords.value) {
    drafts[record.id] = suggestedCurrency(record);
  }
  selectedIds.value = missingRecords.value.map(record => Number(record.id));
  resultMessage.value = '';
};

const clearSelection = () => {
  selectedIds.value = [];
  resultMessage.value = '';
};

const selectedRecords = computed(() => {
  const selected = new Set(selectedIds.value);
  return missingRecords.value.filter(record => selected.has(Number(record.id)));
});

const selectedHasInvalidCurrency = computed(() => (
  selectedRecords.value.some(record => !normalizedDraft(record.id))
));

const confirmSelected = async () => {
  if (repairing.value || selectedRecords.value.length === 0 || selectedHasInvalidCurrency.value) return;

  repairing.value = true;
  resultMessage.value = '';
  resultTone.value = '';

  try {
    const selections = selectedRecords.value.map(record => ({
      record,
      currency: normalizedDraft(record.id),
    }));

    const result = await reconcileRecordCurrencies(selections, {
      getToken: () => auth.token,
      refreshToken: () => auth.refreshToken(),
      apiBaseUrl: CONFIG.API_BASE_URL,
      refreshRecords: () => store.fetchRecords(),
      readRecords: () => store.records,
    });

    if (!result.readbackSucceeded) {
      resultMessage.value = '寫入結果無法重新讀回確認；系統沒有把任何項目宣告為成功。請稍後重新整理後再確認。';
      resultTone.value = 'warning';
      addToast('幣別修復結果暫時無法確認', 'warning');
      return;
    }

    const confirmedIds = new Set(result.confirmed.map(item => item.id));
    selectedIds.value = selectedIds.value.filter(id => !confirmedIds.has(id));

    if (result.unconfirmed.length === 0) {
      resultMessage.value = `已由伺服器重新讀回確認 ${result.confirmed.length} 筆報價單位。`;
      resultTone.value = 'success';
      addToast('交易報價單位已確認', 'success');
      return;
    }

    resultMessage.value = `已確認 ${result.confirmed.length} 筆；另有 ${result.unconfirmed.length} 筆未能確認，未覆寫既有資料。`;
    resultTone.value = 'warning';
    addToast('部分交易報價單位仍需確認', 'warning');
  } catch (error) {
    console.error('record currency reconciliation failed:', error);
    resultMessage.value = '幣別修復未完成；既有交易內容沒有被一般編輯流程覆寫。';
    resultTone.value = 'error';
    addToast('幣別修復失敗', 'error');
  } finally {
    repairing.value = false;
  }
};
</script>

<style scoped>
.currency-reconciliation { margin: 0 0 24px; padding: 16px; border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-sm); background: rgba(245, 158, 11, 0.06); }
.reconciliation-summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.eyebrow { display: block; margin-bottom: 4px; color: var(--warning); font-size: var(--type-caption); font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
h4 { margin: 0 0 6px; color: var(--text-main); font-size: var(--type-section); }
p { margin: 0; color: var(--text-sub); font-size: var(--type-label); line-height: 1.55; }
.toggle-button, .secondary-button, .primary-button { border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
.toggle-button { flex: 0 0 auto; padding: 9px 12px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main); }
.reconciliation-body { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-color); }
.bulk-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.secondary-button { padding: 7px 10px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-sub); }
.selection-count { margin-left: auto; color: var(--text-sub); font-size: var(--type-label); font-weight: 700; }
.record-list { max-height: 360px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); }
.record-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 220px); gap: 12px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border-color); }
.record-row:last-child { border-bottom: 0; }
.record-selector { display: flex; align-items: center; gap: 10px; min-width: 0; cursor: pointer; }
.record-selector input { width: 18px; height: 18px; margin: 0; flex: 0 0 auto; }
.record-identity { display: flex; flex-direction: column; min-width: 0; }
.record-identity strong { color: var(--primary); font-family: 'JetBrains Mono', monospace; }
.record-identity span { color: var(--text-sub); font-size: var(--type-caption); }
.currency-editor { display: grid; grid-template-columns: auto minmax(72px, 1fr); gap: 4px 8px; align-items: center; }
.currency-editor label, .candidate-note { color: var(--text-sub); font-size: var(--type-caption); font-weight: 700; }
.currency-editor input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 7px; background: var(--bg-card); color: var(--text-main); font-family: 'JetBrains Mono', monospace; }
.currency-editor input[aria-invalid="true"] { border-color: var(--danger); }
.candidate-note { grid-column: 2; font-weight: 500; }
.reconciliation-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 12px; }
.authority-note { max-width: 680px; }
.primary-button { flex: 0 0 auto; padding: 10px 14px; border: 0; background: var(--primary); color: white; }
.primary-button:disabled, .secondary-button:disabled { opacity: 0.55; cursor: not-allowed; }
.error-message, .result-message { margin-top: 10px; font-weight: 700; }
.error-message, .result-message.error { color: var(--danger); }
.result-message.warning { color: var(--warning); }
.result-message.success { color: var(--success); }
@media (max-width: 768px) {
  .reconciliation-summary, .reconciliation-footer { flex-direction: column; align-items: stretch; }
  .record-row { grid-template-columns: 1fr; }
  .selection-count { margin-left: 0; }
  .primary-button, .toggle-button { width: 100%; }
}
</style>