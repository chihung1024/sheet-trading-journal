<template>
  <details v-if="receipt && receipt.rows.length" class="import-receipt">
    <summary>
      <span>逐筆匯入結果</span>
      <strong>{{ receipt.attempted }}/{{ receipt.total }}</strong>
    </summary>

    <div class="receipt-body">
      <div class="receipt-summary">
        <span>新增 {{ receipt.created }}</span>
        <span>已存在 {{ receipt.replayed }}</span>
        <span v-if="receipt.unattempted > 0">未執行 {{ receipt.unattempted }}</span>
      </div>

      <div v-if="receipt.sync_messages.length" class="sync-warning" role="status">
        <strong>交易結果與後續同步分開判定</strong>
        <ul>
          <li v-for="message in receipt.sync_messages" :key="message">{{ message }}</li>
        </ul>
      </div>

      <div class="receipt-table-wrap">
        <table class="receipt-table">
          <thead>
            <tr>
              <th>順序</th>
              <th>來源</th>
              <th>結果</th>
              <th>補充狀態</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visibleRows" :key="row.position">
              <td>{{ row.position }}</td>
              <td>{{ row.reference }}</td>
              <td><span class="status-pill" :class="row.tone">{{ row.label }}</span></td>
              <td>
                <span v-if="row.notes.length === 0">—</span>
                <span v-else>{{ row.notes.join('；') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        v-if="visibleRows.length < receipt.rows.length"
        type="button"
        class="show-more"
        @click="showMore"
      >
        顯示更多（尚有 {{ receipt.rows.length - visibleRows.length }} 筆）
      </button>

      <p v-if="receipt.unattempted > 0" class="unattempted-note">
        後續 {{ receipt.unattempted }} 筆因前一筆停止條件而未送出，系統沒有替它們臆造成功或失敗結果。
      </p>

      <div v-if="showRetry" class="retry-panel">
        <div>
          <strong>可使用相同來源安全續傳</strong>
          <p>系統會先確認既有未定結果，再以原本的穩定識別重播整批；已確認項目不會重複新增。</p>
        </div>
        <button
          type="button"
          class="retry-button"
          :disabled="retrying"
          @click="emit('retry')"
        >
          {{ retrying ? '正在確認既有結果…' : '安全續傳' }}
        </button>
      </div>
    </div>
  </details>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { isAmbiguousImportRetryCandidate } from '../services/importAmbiguousRetry.js';
import { buildImportReconciliationReceipt } from '../services/importReconciliationReceipt.js';

const props = defineProps({
  result: {
    type: Object,
    default: null,
  },
  retryAvailable: {
    type: Boolean,
    default: false,
  },
  retrying: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['retry']);

const PAGE_SIZE = 100;
const visibleLimit = ref(PAGE_SIZE);

const receipt = computed(() => {
  if (!props.result?.items) return null;
  try {
    return buildImportReconciliationReceipt(props.result);
  } catch {
    return null;
  }
});
const visibleRows = computed(() => receipt.value?.rows?.slice(0, visibleLimit.value) || []);
const showRetry = computed(() => (
  props.retryAvailable
  && isAmbiguousImportRetryCandidate(props.result)
));

const showMore = () => {
  visibleLimit.value += PAGE_SIZE;
};

watch(() => props.result, () => {
  visibleLimit.value = PAGE_SIZE;
});
</script>

<style scoped>
.import-receipt {
  margin-top: 0.75rem;
  border: 1px solid var(--border-color, #d5d9e2);
  border-radius: 10px;
  background: var(--bg-card, var(--card-bg, #fff));
}
.import-receipt summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  cursor: pointer;
  font-weight: 700;
}
.receipt-body {
  display: grid;
  gap: 0.7rem;
  padding: 0 0.85rem 0.85rem;
}
.receipt-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  color: var(--text-muted, var(--text-secondary, #64748b));
}
.sync-warning {
  padding: 0.65rem 0.75rem;
  border: 1px solid rgb(217 119 6 / 35%);
  border-radius: 8px;
  background: rgb(245 158 11 / 8%);
}
.sync-warning ul {
  margin: 0.35rem 0 0;
  padding-left: 1.15rem;
}
.receipt-table-wrap {
  overflow: auto;
  border: 1px solid var(--border-color, #d5d9e2);
  border-radius: 8px;
}
.receipt-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
}
.receipt-table th,
.receipt-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  text-align: left;
  vertical-align: top;
}
.receipt-table th {
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-muted, var(--text-secondary, #64748b));
}
.status-pill {
  display: inline-flex;
  padding: 0.18rem 0.48rem;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
}
.status-pill.success { color: #15803d; background: rgb(22 163 74 / 10%); }
.status-pill.neutral { color: #475569; background: rgb(100 116 139 / 10%); }
.status-pill.warning { color: #b45309; background: rgb(245 158 11 / 12%); }
.status-pill.error { color: #b91c1c; background: rgb(220 38 38 / 10%); }
.show-more,
.retry-button {
  min-height: 34px;
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--border-color, #d5d9e2);
  border-radius: 7px;
  font: inherit;
  font-weight: 600;
}
.show-more {
  justify-self: start;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.unattempted-note {
  margin: 0;
  color: var(--text-muted, var(--text-secondary, #64748b));
  line-height: 1.5;
}
.retry-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid rgb(217 119 6 / 35%);
  border-radius: 8px;
  background: rgb(245 158 11 / 8%);
}
.retry-panel p {
  margin: 0.25rem 0 0;
  color: var(--text-muted, var(--text-secondary, #64748b));
  line-height: 1.45;
}
.retry-button {
  flex: 0 0 auto;
  border-color: var(--primary, #2563eb);
  background: var(--primary, #2563eb);
  color: #fff;
  cursor: pointer;
}
.retry-button:disabled { cursor: not-allowed; opacity: 0.58; }

@media (max-width: 640px) {
  .retry-panel { align-items: stretch; flex-direction: column; }
  .retry-button { width: 100%; }
}
</style>