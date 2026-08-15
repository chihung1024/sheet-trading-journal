<template>
  <section class="record-detail-panel" :id="panelId" aria-label="完整交易明細">
    <div class="detail-header">
      <div>
        <span class="detail-eyebrow">已儲存交易欄位</span>
        <h4>{{ record.symbol || '—' }} · {{ typeLabel }}</h4>
      </div>
      <span class="detail-date">{{ record.txn_date || '—' }}</span>
    </div>

    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">交易日期</span>
        <span class="detail-value">{{ record.txn_date || '—' }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">類型</span>
        <span class="detail-value">{{ typeLabel }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">代碼</span>
        <span class="detail-value symbol-value">{{ record.symbol || '—' }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">紀錄數量</span>
        <span class="detail-value font-num">{{ formatNumber(record.qty, 4) }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">{{ priceLabel }}</span>
        <span class="detail-value font-num">{{ formatStoredAmount(record.price, 4) }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">手續費</span>
        <span class="detail-value font-num">{{ formatStoredAmount(record.fee, 2) }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">稅費</span>
        <span class="detail-value font-num">{{ formatStoredAmount(record.tax, 2) }}</span>
      </div>
    </div>

    <div class="detail-section">
      <span class="detail-label">策略標籤</span>
      <div v-if="tags.length > 0" class="detail-tags">
        <span v-for="tag in tags" :key="tag" class="detail-tag">{{ tag }}</span>
      </div>
      <p v-else class="detail-empty">未設定策略標籤</p>
    </div>

    <div class="detail-section journal-section">
      <span class="detail-label">交易備註 / 投資理由</span>
      <p v-if="record.note" class="detail-note">{{ record.note }}</p>
      <p v-else class="detail-empty">未填寫交易備註</p>
    </div>

    <p class="detail-authority-note">
      此處只顯示已儲存的交易／日誌欄位；績效與 TWD 估值仍以系統既有計算與已驗證快照為準。
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { detectNativeCurrency, formatNativeAmount } from '../services/instrumentCurrency.js';
import { getRecordTags } from '../services/recordHistoryPresentation.js';

const props = defineProps({
  record: {
    type: Object,
    required: true,
  },
  panelId: {
    type: String,
    required: true,
  },
});

const currency = computed(() => detectNativeCurrency(props.record?.symbol));
const tags = computed(() => getRecordTags(props.record));
const typeLabel = computed(() => ({
  BUY: '買入',
  SELL: '賣出',
  DIV: '配息',
}[String(props.record?.txn_type || '').toUpperCase()] || String(props.record?.txn_type || '—')));
const priceLabel = computed(() => (
  String(props.record?.txn_type || '').toUpperCase() === 'DIV' ? 'DIV 入帳金額' : '成交價'
));

const formatNumber = (value, digits = 2) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatStoredAmount = (value, digits) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return formatNativeAmount(number, currency.value, digits);
};
</script>

<style scoped>
.record-detail-panel { padding: 18px 20px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary); color: var(--text-main); text-align: left; }
.detail-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.detail-eyebrow { display: block; margin-bottom: 4px; color: var(--text-sub); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.detail-header h4 { margin: 0; font-size: 1rem; }
.detail-date { color: var(--text-sub); font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; white-space: nowrap; }
.detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.detail-item { min-width: 0; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); }
.detail-label { display: block; margin-bottom: 5px; color: var(--text-sub); font-size: 0.72rem; font-weight: 700; }
.detail-value { display: block; overflow-wrap: anywhere; font-size: 0.9rem; font-weight: 650; }
.symbol-value { color: var(--primary); font-family: 'JetBrains Mono', monospace; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.detail-section { margin-top: 14px; }
.detail-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.detail-tag { padding: 4px 9px; border-radius: 999px; border: 1px solid rgba(99, 102, 241, 0.2); background: rgba(99, 102, 241, 0.08); color: var(--text-main); font-size: 0.78rem; font-weight: 650; }
.detail-note { margin: 0; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; }
.detail-empty { margin: 0; color: var(--text-sub); font-size: 0.85rem; }
.detail-authority-note { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--border-color); color: var(--text-sub); font-size: 0.76rem; line-height: 1.5; }
@media (max-width: 900px) {
  .detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .record-detail-panel { padding: 14px; }
  .detail-header { flex-direction: column; gap: 6px; }
  .detail-grid { grid-template-columns: 1fr; }
  .detail-date { white-space: normal; }
}
</style>
