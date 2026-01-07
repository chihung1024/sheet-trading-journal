<template>
  <div class="records-section card">
    <div class="records-header">
      <h3>交易記錄</h3>
      <div class="filter-controls">
        <input 
          v-model="filterSymbol"
          type="text"
          placeholder="搜索代碼..."
          class="filter-input"
          aria-label="搜索交易記錄"
        >
        <select 
          v-model="filterType"
          class="filter-select"
          aria-label="篩選交易類型"
        >
          <option value="">全部類型</option>
          <option value="BUY">買入</option>
          <option value="SELL">賣出</option>
          <option value="DIV">股息</option>
        </select>
      </div>
    </div>

    <div v-if="filteredRecords.length === 0" class="empty-state">
      <p>📭 暫無交易記錄</p>
    </div>

    <div v-else class="records-list">
      <div 
        v-for="record in paginatedRecords"
        :key="record.id"
        class="record-item"
      >
        <div class="record-header">
          <div class="record-symbol">
            <strong>{{ record.symbol }}</strong>
            <span class="record-type" :class="`type-${record.txn_type.toLowerCase()}`">
              {{ getTypeLabel(record.txn_type) }}
            </span>
          </div>
          <div class="record-date">{{ formatDate(record.txn_date) }}</div>
        </div>

        <div class="record-details">
          <div class="detail-item">
            <span class="detail-label">股數</span>
            <span class="detail-value">{{ formatNumber(record.qty) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">單價</span>
            <span class="detail-value">${{ formatPrice(record.price) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">總額</span>
            <span class="detail-value">${{ formatCurrency(record.total_amount) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">手續費</span>
            <span class="detail-value">${{ formatCurrency(record.fee || 0) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">交易稅</span>
<span class="detail-value">{{ formatCurrency(record.tax || 0) }}</span>          </div>
        </div>

        <div class="record-actions">
          <button 
            class="action-btn edit-btn"
            @click="editRecord(record)"
            aria-label="編輯記錄"
            title="編輯"
          >
            ✎
          </button>
          <button 
            class="action-btn delete-btn"
            @click="deleteRecord(record)"
            aria-label="刪除記錄"
            title="刪除"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- 分頁 -->
    <div v-if="totalPages > 1" class="pagination">
      <button 
        class="page-btn"
        @click="currentPage = Math.max(1, currentPage - 1)"
        :disabled="currentPage === 1"
        aria-label="上一頁"
      >
        ← 上一頁
      </button>

      <div class="page-info">
        第 {{ currentPage }} / {{ totalPages }} 頁 (共 {{ filteredRecords.length }} 筆)
      </div>

      <button 
        class="page-btn"
        @click="currentPage = Math.min(totalPages, currentPage + 1)"
        :disabled="currentPage === totalPages"
        aria-label="下一頁"
      >
        下一頁 →
      </button>
    </div>

    <!-- 刪除確認對話框 -->
    <div v-if="showDeleteConfirm" class="confirm-overlay" @click="showDeleteConfirm = false">
      <div class="confirm-dialog" @click.stop>
        <h4>確認刪除</h4>
        <p>確定要刪除此交易記錄嗎？此操作無法撤銷。</p>
        <div class="confirm-actions">
          <button 
            class="btn btn-secondary"
            @click="showDeleteConfirm = false"
          >
            取消
          </button>
          <button 
            class="btn btn-danger"
            @click="confirmDelete"
          >
            刪除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

const filterSymbol = ref('');
const filterType = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const showDeleteConfirm = ref(false);
const selectedRecord = ref(null);

const records = computed(() => store.records || []);

const filteredRecords = computed(() => {
  return records.value.filter(record => {
    const matchSymbol = record.symbol.toUpperCase().includes(filterSymbol.value.toUpperCase());
    const matchType = !filterType.value || record.txn_type === filterType.value;
    return matchSymbol && matchType;
  }).sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date));
});

const totalPages = computed(() => 
  Math.ceil(filteredRecords.value.length / pageSize.value) || 1
);

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredRecords.value.slice(start, end);
});

// 格式化函數
const getTypeLabel = (type) => {
  const labels = {
    'BUY': '買入',
    'SELL': '賣出',
    'DIV': '股息'
  };
  return labels[type] || type;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('zh-TW').format(value);
};

const formatPrice = (value) => {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// 編輯和刪除
const editRecord = (record) => {
  console.log('編輯記錄:', record);
  // 發出編輯事件或導航到編輯頁面
};

const deleteRecord = (record) => {
  selectedRecord.value = record;
  showDeleteConfirm.value = true;
};

const confirmDelete = async () => {
  if (selectedRecord.value) {
    try {
      await store.deleteRecord(selectedRecord.value.id);
      // 重新計算分頁
      if (currentPage.value > totalPages.value && currentPage.value > 1) {
        currentPage.value--;
      }
      showDeleteConfirm.value = false;
      selectedRecord.value = null;
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗，請重試');
    }
  }
};
</script>

<style scoped>
.records-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  gap: var(--space-md);
}

.records-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 700;
  flex: 1;
}

.filter-controls {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.filter-input,
.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
}

.filter-input {
  min-width: 180px;
}

.filter-input::placeholder {
  color: var(--text-muted);
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(31, 110, 251, 0.1);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
  color: var(--text-muted);
  font-size: 1rem;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.record-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  transition: all 200ms ease;
}

.record-item:hover {
  background: var(--bg);
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(31, 110, 251, 0.1);
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
}

.record-symbol {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.record-symbol strong {
  color: var(--primary);
  font-size: 1.05rem;
  font-weight: 700;
}

.record-type {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.record-type.type-buy {
  background: rgba(76, 175, 80, 0.2);
  color: #4cb050;
}

.record-type.type-sell {
  background: rgba(248, 81, 73, 0.2);
  color: var(--error-light);
}

.record-type.type-div {
  background: rgba(31, 110, 251, 0.2);
  color: var(--primary);
}

.record-date {
  color: var(--text-muted);
  font-size: 0.9rem;
  white-space: nowrap;
}

.record-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  padding: var(--space-md) 0;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 0.95rem;
  color: var(--text);
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-weight: 600;
}

.record-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  transition: all 200ms ease;
}

.action-btn:hover {
  background: var(--border);
  color: var(--text);
}

.edit-btn:hover {
  color: var(--primary);
}

.delete-btn:hover {
  color: var(--error-light);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border);
}

.page-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 200ms ease;
}

.page-btn:hover:not(:disabled) {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(31, 110, 251, 0.3);
}

.page-btn:active:not(:disabled) {
  transform: translateY(0);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
}

.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-md);
}

.confirm-dialog {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  animation: slideUp 300ms ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.confirm-dialog h4 {
  margin: 0 0 var(--space-md) 0;
  color: var(--text);
  font-size: 1.1rem;
}

.confirm-dialog p {
  margin: 0 0 var(--space-lg) 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
}

.btn {
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 200ms ease;
}

.btn:hover {
  background: var(--border);
}

.btn-secondary {
  background: var(--bg-secondary);
  border-color: var(--border);
}

.btn-danger {
  background: rgba(248, 81, 73, 0.1);
  border-color: var(--error-light);
  color: var(--error-light);
}

.btn-danger:hover {
  background: rgba(248, 81, 73, 0.2);
  border-color: var(--error-light);
}

@media (max-width: 768px) {
  .records-header {
    flex-direction: column;
    align-items: stretch;
  }

  .records-header h3 {
    flex: none;
  }

  .filter-controls {
    flex-direction: column;
  }

  .filter-input {
    min-width: auto;
    width: 100%;
  }

  .filter-select {
    width: 100%;
  }

  .record-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .record-details {
    grid-template-columns: repeat(2, 1fr);
  }

  .pagination {
    flex-wrap: wrap;
  }

  .page-btn {
    flex: 1;
    min-width: 100px;
  }

  .page-info {
    order: 3;
    flex-basis: 100%;
    text-align: center;
  }

  .confirm-dialog {
    margin: var(--space-md);
  }
}
</style>
