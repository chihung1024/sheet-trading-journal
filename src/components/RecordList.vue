<template>
  <div class="records-section card">
    <div class="section-header">
      <h2>交易紀錄</h2>
      <div class="filter-controls">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋股票代碼..."
          class="search-input"
        />
        <select v-model="filterType" class="filter-select">
          <option value="">全部</option>
          <option value="BUY">買入</option>
          <option value="SELL">賣出</option>
          <option value="DIV">配息</option>
        </select>
      </div>
    </div>

    <div v-if="filteredRecords.length > 0" class="records-list">
      <div
        v-for="(record, index) in filteredRecords"
        :key="index"
        class="record-item"
        :style="{ animationDelay: `${index * 50}ms` }`"
      >
        <div class="record-left">
          <div class="record-type" :class="`type-${record.type?.toLowerCase()}`">
            {{ getTypeLabel(record.type) }}
          </div>
          <div class="record-info">
            <div class="record-ticker">{{ record.ticker }}</div>
            <div class="record-date">{{ formatDate(record.date) }}</div>
          </div>
        </div>

        <div class="record-middle">
          <div class="record-detail">
            <span class="label">股數:</span>
            <span class="value">{{ record.quantity }}</span>
          </div>
          <div class="record-detail">
            <span class="label">單價:</span>
            <span class="value">{{ record.price }}</span>
          </div>
        </div>

        <div class="record-right">
          <div class="record-amount">
            {{ formatCurrency(record.quantity * record.price) }}
          </div>
          <div class="record-actions">
            <button
              class="action-btn edit"
              @click="handleEdit(record)"
              title="編輯"
            >
              ✎
            </button>
            <button
              class="action-btn delete"
              @click="handleDelete(record)"
              title="刪除"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">📋</div>
      <p>暫無交易紀錄</p>
    </div>

    <!-- 分頁 -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        :disabled="currentPage === 1"
        @click="currentPage--"
        class="pagination-btn"
      >
        ←
      </button>
      <span class="pagination-info">
        第 {{ currentPage }} / {{ totalPages }} 頁
      </span>
      <button
        :disabled="currentPage === totalPages"
        @click="currentPage++"
        class="pagination-btn"
      >
        →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useDialogStore } from '../stores/dialog';
import { useToastStore } from '../stores/toast';

const store = usePortfolioStore();
const dialogStore = useDialogStore();
const toastStore = useToastStore();

const searchQuery = ref('');
const filterType = ref('');
const currentPage = ref(1);
const pageSize = ref(10);

const records = computed(() => store.records || []);

const filteredRecords = computed(() => {
  let result = records.value;

  if (searchQuery.value) {
    result = result.filter((r) =>
      r.ticker?.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  if (filterType.value) {
    result = result.filter((r) => r.type === filterType.value);
  }

  // 反向排序（最新在前）
  result = result.reverse();

  // 分頁
  const start = (currentPage.value - 1) * pageSize.value;
  return result.slice(start, start + pageSize.value);
});

const totalPages = computed(() => {
  let result = records.value;

  if (searchQuery.value) {
    result = result.filter((r) =>
      r.ticker?.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  if (filterType.value) {
    result = result.filter((r) => r.type === filterType.value);
  }

  return Math.ceil(result.length / pageSize.value) || 1;
});

const getTypeLabel = (type) => {
  const labels = {
    BUY: '買入',
    SELL: '賣出',
    DIV: '配息',
  };
  return labels[type] || type;
};

const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('zh-TW');
};

const formatCurrency = (num) => {
  return Number(num).toLocaleString('zh-TW', {
    style: 'currency',
    currency: 'USD',
  });
};

const handleEdit = (record) => {
  emit('edit', record);
};

const handleDelete = (record) => {
  dialogStore.openConfirm({
    title: '刪除交易紀錄',
    message: `確認刪除 ${record.ticker} 在 ${formatDate(record.date)} 的交易紀錄嗎？`,
    confirmText: '刪除',
    cancelText: '取消',
    isDangerous: true,
    onConfirm: async () => {
      toastStore.success('交易紀錄已刪除');
    },
  });
};

const emit = defineEmits(['edit']);
</script>

<style scoped>
.records-section {
  animation: fadeInUp 500ms var(--easing-ease-out) 500ms both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-header {
  margin-bottom: var(--space-lg);
}

.section-header h2 {
  margin: 0 0 12px 0;
  font-size: 1.5rem;
}

.filter-controls {
  display: flex;
  gap: var(--space-md);
}

@media (max-width: 768px) {
  .filter-controls {
    flex-wrap: wrap;
  }
}

.search-input,
.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.9rem;
  transition: all 200ms ease;
}

.search-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(31, 110, 251, 0.1);
}

.search-input {
  flex: 1;
  min-width: 150px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  animation: slideInLeft 400ms var(--easing-ease-out) both;
  transition: all 200ms ease;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.record-item:hover {
  background: var(--card-bg);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .record-item {
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .record-left,
  .record-middle,
  .record-right {
    width: 100%;
  }

  .record-middle,
  .record-right {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.record-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex: 1;
  min-width: 0;
}

.record-type {
  padding: 4px 12px;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  text-transform: uppercase;
}

.record-type.type-buy {
  background: rgba(38, 166, 65, 0.2);
  color: var(--success-light);
}

.record-type.type-sell {
  background: rgba(248, 81, 73, 0.2);
  color: var(--error-light);
}

.record-type.type-div {
  background: rgba(255, 193, 7, 0.2);
  color: var(--warning-light);
}

.record-info {
  flex: 1;
  min-width: 0;
}

.record-ticker {
  font-weight: 700;
  font-size: 1rem;
  color: var(--primary);
}

.record-date {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.record-middle {
  display: flex;
  gap: var(--space-lg);
  flex: 1;
}

@media (max-width: 768px) {
  .record-middle {
    gap: var(--space-md);
  }
}

.record-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.record-detail .label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.record-detail .value {
  font-weight: 600;
  color: var(--text);
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-sm);
  flex: 0 0 auto;
}

@media (max-width: 768px) {
  .record-right {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.record-amount {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text);
}

.record-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  transition: transform 200ms ease;
  color: var(--text-secondary);
}

.action-btn:hover {
  transform: scale(1.2);
}

.action-btn.edit:hover {
  color: var(--primary);
}

.action-btn.delete:hover {
  color: var(--error-light);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--space-md);
}

.empty-state p {
  margin: 0;
  font-size: 1.1rem;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border);
}

.pagination-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 200ms ease;
  font-weight: 600;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
}
</style>
