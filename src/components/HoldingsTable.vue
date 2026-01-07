<template>
  <div class="holdings-section card">
    <div class="holdings-header">
      <h3>持倉明細</h3>
      <div class="table-controls">
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="搜索股票代碼..."
          class="search-input"
          aria-label="搜索持倉"
        >
        <select 
          v-model="sortBy"
          class="sort-select"
          aria-label="排序方式"
        >
          <option value="symbol">按代碼</option>
          <option value="quantity">按股數</option>
          <option value="value">按價值</option>
          <option value="gain">按收益</option>
        </select>
      </div>
    </div>

    <div v-if="filteredHoldings.length === 0" class="empty-state">
      <p>📭 暫無持倉數據</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="holdings-table" role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader">股票代碼</th>
            <th role="columnheader" class="text-right">股數</th>
            <th role="columnheader" class="text-right">成本價</th>
            <th role="columnheader" class="text-right">現價</th>
            <th role="columnheader" class="text-right">總成本</th>
            <th role="columnheader" class="text-right">現值</th>
            <th role="columnheader" class="text-right">收益</th>
            <th role="columnheader" class="text-right">收益率</th>
            <th role="columnheader" class="text-center">操作</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr 
            v-for="holding in filteredHoldings"
            :key="holding.symbol"
            class="table-row"
            role="row"
          >
            <td class="symbol-cell">
              <strong>{{ holding.symbol }}</strong>
            </td>
            <td class="text-right">{{ formatNumber(holding.quantity) }}</td>
            <td class="text-right">${{ formatPrice(holding.costPrice) }}</td>
            <td class="text-right">${{ formatPrice(holding.currentPrice) }}</td>
            <td class="text-right">${{ formatCurrency(holding.totalCost) }}</td>
            <td class="text-right">${{ formatCurrency(holding.currentValue) }}</td>
            <td 
              class="text-right"
              :class="{ positive: holding.gain >= 0, negative: holding.gain < 0 }"
            >
              {{ holding.gain >= 0 ? '+' : '' }}${{ formatCurrency(holding.gain) }}
            </td>
            <td 
              class="text-right"
              :class="{ positive: holding.gainPercent >= 0, negative: holding.gainPercent < 0 }"
            >
              {{ holding.gainPercent >= 0 ? '+' : '' }}{{ formatPercent(holding.gainPercent) }}
            </td>
            <td class="text-center">
              <button 
                class="action-btn edit-btn"
                @click="editHolding(holding)"
                title="編輯"
                aria-label="編輯持倉"
              >
                ✎
              </button>
              <button 
                class="action-btn delete-btn"
                @click="deleteHolding(holding)"
                title="刪除"
                aria-label="刪除持倉"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 總計行 -->
      <div class="table-summary">
        <div class="summary-item">
          <span class="summary-label">合計成本</span>
          <span class="summary-value">${{ formatCurrency(totalCost) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">合計現值</span>
          <span class="summary-value">${{ formatCurrency(totalValue) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">合計收益</span>
          <span 
            class="summary-value"
            :class="{ positive: totalGain >= 0, negative: totalGain < 0 }"
          >
            {{ totalGain >= 0 ? '+' : '' }}${{ formatCurrency(totalGain) }}
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">平均收益率</span>
          <span 
            class="summary-value"
            :class="{ positive: avgGainPercent >= 0, negative: avgGainPercent < 0 }"
          >
            {{ avgGainPercent >= 0 ? '+' : '' }}{{ formatPercent(avgGainPercent) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 確認刪除對話框 - 修改：確保 selectedHolding 正確顯示 -->
    <div v-if="showDeleteConfirm" class="confirm-dialog">
      <div class="dialog-content">
        <h4>確認刪除</h4>
        <p v-if="selectedHolding">
          確定要刪除 <strong>{{ selectedHolding.symbol }}</strong> 的持倉記錄嗎？此操作無法撤銷。
        </p>
        <div class="dialog-actions">
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

const searchQuery = ref('');
const sortBy = ref('symbol');
const showDeleteConfirm = ref(false);
const selectedHolding = ref(null);

const holdings = computed(() => store.holdings || []);

const filteredHoldings = computed(() => {
  let filtered = holdings.value.filter(h => 
    h.symbol.toUpperCase().includes(searchQuery.value.toUpperCase())
  );

  // 排序
  switch (sortBy.value) {
    case 'quantity':
      filtered.sort((a, b) => b.quantity - a.quantity);
      break;
    case 'value':
      filtered.sort((a, b) => b.currentValue - a.currentValue);
      break;
    case 'gain':
      filtered.sort((a, b) => b.gain - a.gain);
      break;
    case 'symbol':
    default:
      filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  return filtered;
});

const totalCost = computed(() => 
  holdings.value.reduce((sum, h) => sum + h.totalCost, 0)
);

const totalValue = computed(() => 
  holdings.value.reduce((sum, h) => sum + h.currentValue, 0)
);

const totalGain = computed(() => totalValue.value - totalCost.value);

const avgGainPercent = computed(() => {
  if (totalCost.value === 0) return 0;
  return (totalGain.value / totalCost.value) * 100;
});

// 格式化函數
const formatCurrency = (value) => {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatPrice = (value) => {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('zh-TW').format(value);
};

const formatPercent = (value) => {
  return value.toFixed(2) + '%';
};

// 編輯持倉
const editHolding = (holding) => {
  console.log('編輯持倉:', holding);
  // 發出編輯事件
};

// 刪除持倉
const deleteHolding = (holding) => {
  selectedHolding.value = holding;
  showDeleteConfirm.value = true;
};

// 確認刪除
const confirmDelete = async () => {
  if (selectedHolding.value) {
    try {
      await store.deleteHolding(selectedHolding.value.symbol);
      showDeleteConfirm.value = false;
      selectedHolding.value = null;
    } catch (error) {
      console.error('刪除失敗:', error);
    }
  }
};
</script>

<style scoped>
.holdings-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.holdings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  gap: var(--space-md);
}

.holdings-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 1.1rem;
}

.table-controls {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.search-input,
.sort-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.9rem;
}

.search-input {
  min-width: 200px;
}

.search-input:focus,
.sort-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(31, 110, 251, 0.1);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--text-muted);
  font-size: 1rem;
}

.table-wrapper {
  overflow-x: auto;
}

.holdings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.holdings-table thead {
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border);
}

.holdings-table th {
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  color: var(--text-muted);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.holdings-table th.text-right {
  text-align: right;
}

.holdings-table th.text-center {
  text-align: center;
}

.holdings-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background 200ms ease;
}

.holdings-table tbody tr:hover {
  background: var(--bg-secondary);
}

.holdings-table td {
  padding: 12px 8px;
  color: var(--text);
}

.holdings-table td.text-right {
  text-align: right;
  font-family: 'Monaco', 'Menlo', monospace;
}

.holdings-table td.text-center {
  text-align: center;
}

.symbol-cell {
  font-weight: 600;
  color: var(--primary);
}

.positive {
  color: #4cb050;
}

.negative {
  color: var(--error-light);
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  transition: color 200ms ease;
  margin: 0 2px;
}

.action-btn:hover {
  color: var(--text);
}

.edit-btn:hover {
  color: var(--primary);
}

.delete-btn:hover {
  color: var(--error-light);
}

.table-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md);
  margin-top: var(--space-lg);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

.summary-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  font-family: 'Monaco', 'Menlo', monospace;
}

.summary-value.positive {
  color: #4cb050;
}

.summary-value.negative {
  color: var(--error-light);
}

/* 修改：刪除確認對話框 */
.confirm-dialog {
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
}

.dialog-content {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  max-width: 400px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
}

.dialog-content h4 {
  margin: 0 0 var(--space-md) 0;
  color: var(--text);
}

.dialog-content p {
  margin: 0 0 var(--space-lg) 0;
  color: var(--text-muted);
}

.dialog-actions {
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
  transition: all 200ms ease;
}

.btn:hover {
  background: var(--border);
}

.btn-secondary {
  background: var(--bg-secondary);
}

.btn-danger {
  background: rgba(248, 81, 73, 0.1);
  border-color: var(--error-light);
  color: var(--error-light);
}

.btn-danger:hover {
  background: rgba(248, 81, 73, 0.2);
}

@media (max-width: 768px) {
  .holdings-header {
    flex-direction: column;
    align-items: stretch;
  }

  .table-controls {
    flex-direction: column;
  }

  .search-input {
    min-width: auto;
  }

  .holdings-table {
    font-size: 0.8rem;
  }

  .holdings-table th,
  .holdings-table td {
    padding: 8px 4px;
  }

  .table-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
