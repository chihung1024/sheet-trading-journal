<template>
  <div class="card record-list-card">
    <div class="card-header">
      <div class="header-main">
        <h3 class="panel-title">交易紀錄</h3>
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="搜尋標的、標籤或備註..." 
              class="search-input"
            />
          </div>
          <div class="filter-group">
            <select v-model="filterType" class="filter-select">
              <option value="all">所有類別</option>
              <option value="BUY">買入 (BUY)</option>
              <option value="SELL">賣出 (SELL)</option>
              <option value="DIVIDEND">股息 (DIV)</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="stats-summary">
      <div class="stat-item">
        <span class="stat-label">總筆數</span>
        <span class="stat-value">{{ filteredRecords.length }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">買入</span>
        <span class="stat-value text-emerald">{{ buyCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">賣出</span>
        <span class="stat-value text-rose">{{ sellCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">股息</span>
        <span class="stat-value text-blue">{{ divCount }}</span>
      </div>
    </div>

    <div class="table-container" ref="tableContainer">
      <table>
        <thead>
          <tr>
            <th @click="toggleSort('txn_date')" class="sortable">
              日期 <span class="sort-icon">{{ getSortIcon('txn_date') }}</span>
            </th>
            <th @click="toggleSort('symbol')" class="sortable">
              標的 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
            </th>
            <th class="text-center">類別</th>
            <th class="text-right">數量</th>
            <th class="text-right">成交價 (USD)</th>
            <th class="text-right hidden-mobile">總額 (TWD)</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        
        <tbody class="divide-y">
          <tr v-if="filteredRecords.length === 0">
            <td colspan="7" class="empty-state">
              <div class="empty-icon">📂</div>
              <p>目前沒有符合條件的紀錄</p>
            </td>
          </tr>

          <tr 
            v-for="record in paginatedRecords" 
            :key="record.id"
            class="row-item"
          >
            <td class="col-date font-num">
              {{ formatDate(record.txn_date) }}
            </td>
            <td class="col-symbol">
              <span class="symbol-badge">{{ record.symbol }}</span>
              <div class="tag-hint hidden-mobile" v-if="record.tag">
                <small>🏷️ {{ record.tag }}</small>
              </div>
            </td>
            <td class="text-center">
              <span :class="['type-tag', getTypeClass(record.txn_type)]">
                {{ getTypeLabel(record.txn_type) }}
              </span>
            </td>
            <td class="text-right font-num">{{ formatNumber(record.qty, 2) }}</td>
            <td class="text-right font-num text-sub">${{ formatNumber(record.price, 2) }}</td>
            <td class="text-right font-num font-bold hidden-mobile">
              NT${{ formatNumber(getTotalAmountTWD(record), 0) }}
            </td>
            <td class="text-center actions">
              <button @click="handleEdit(record)" class="btn-icon" title="編輯">✎</button>
              <button @click="handleDelete(record.id)" class="btn-icon delete" title="刪除">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination-bar" v-if="totalPages > 1">
      <button 
        @click="currentPage--" 
        :disabled="currentPage === 1"
        class="page-nav"
      >←</button>
      <div class="page-info">
        第 {{ currentPage }} / {{ totalPages }} 頁
      </div>
      <button 
        @click="currentPage++" 
        :disabled="currentPage === totalPages"
        class="page-nav"
      >→</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

// --- 狀態管理 ---
const searchQuery = ref('');
const filterType = ref('all');
const sortBy = ref('txn_date');
const sortOrder = ref('desc');
const currentPage = ref(1);
const itemsPerPage = 15;

// --- 邏輯計算 ---

const formatDate = (dateStr) => dateStr;

const formatNumber = (num, d = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '-';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// 取得匯率並計算台幣總額 (對齊 RecordList.vue 原有邏輯)
const getTotalAmountTWD = (record) => {
  const qty = Math.abs(Number(record.qty) || 0);
  const price = Number(record.price) || 0;
  const fees = (Number(record.fee || record.commission) || 0) + (Number(record.tax) || 0);
  const usdTotal = (qty * price) + fees;
  
  // 嘗試從 history 找當天匯率，找不到則用 32.0 預設
  const historyItem = portfolioStore.history.find(h => h.date === record.txn_date);
  const rate = historyItem ? historyItem.fx_rate : 32.0;
  return usdTotal * rate;
};

const getTypeLabel = (type) => {
  const labels = { 'BUY': '買入', 'SELL': '賣出', 'DIVIDEND': '股息', 'DIV': '股息' };
  return labels[type] || type;
};

const getTypeClass = (type) => {
  if (type === 'BUY') return 'tag-buy';
  if (type === 'SELL') return 'tag-sell';
  return 'tag-div';
};

// 篩選與統計
const filteredRecords = computed(() => {
  let result = [...portfolioStore.records];
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(r => r.symbol.toLowerCase().includes(q) || (r.tag && r.tag.toLowerCase().includes(q)));
  }
  if (filterType.value !== 'all') {
    result = result.filter(r => r.txn_type === filterType.value);
  }
  result.sort((a, b) => {
    let valA = a[sortBy.value], valB = b[sortBy.value];
    if (sortBy.value === 'txn_date') { valA = new Date(valA); valB = new Date(valB); }
    return sortOrder.value === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });
  return result;
});

const buyCount = computed(() => filteredRecords.value.filter(r => r.txn_type === 'BUY').length);
const sellCount = computed(() => filteredRecords.value.filter(r => r.txn_type === 'SELL').length);
const divCount = computed(() => filteredRecords.value.filter(r => ['DIVIDEND', 'DIV'].includes(r.txn_type)).length);

// 分頁
const totalPages = computed(() => Math.ceil(filteredRecords.value.length / itemsPerPage) || 1);
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredRecords.value.slice(start, start + itemsPerPage);
});

// --- 操作方法 ---
const toggleSort = (field) => {
  if (sortBy.value === field) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  else { sortBy.value = field; sortOrder.value = 'desc'; }
};

const getSortIcon = (field) => {
  if (sortBy.value !== field) return '↕';
  return sortOrder.value === 'asc' ? '↑' : '↓';
};

const handleDelete = async (id) => {
  if (confirm('確定要刪除此筆交易紀錄嗎？')) {
    await portfolioStore.deleteRecord(id);
  }
};

const emit = defineEmits(['edit']);
const handleEdit = (record) => emit('edit', record);

watch([searchQuery, filterType], () => currentPage.value = 1);
</script>

<style scoped>
.record-list-card {
  padding: 0;
  overflow: hidden;
}

.header-main {
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  border-bottom: 1px solid var(--border-color);
}

.panel-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  padding-left: 12px;
  border-left: 4px solid var(--primary);
}

.toolbar {
  display: flex;
  gap: 12px;
}

.search-box {
  position: relative;
  min-width: 240px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.5;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-main);
  font-size: 0.95rem;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-main);
}

/* 統計摘要欄樣式 */
.stats-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--bg-secondary);
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-sub);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.2rem;
  font-weight: 700;
}

/* 表格與行樣式 */
.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: var(--bg-secondary);
  padding: 12px 16px;
  text-align: left;
  font-size: 0.85rem;
  color: var(--text-sub);
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
}

th.sortable { cursor: pointer; }
th.sortable:hover { color: var(--primary); }

td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

.row-item {
  transition: background 0.2s;
}

.row-item:hover {
  background: rgba(var(--primary-rgb), 0.03);
}

.symbol-badge {
  font-weight: 700;
  color: var(--primary);
  background: rgba(59, 130, 246, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.type-tag {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
}

.tag-buy { background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid var(--success); }
.tag-sell { background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger); }
.tag-div { background: rgba(59, 130, 246, 0.1); color: var(--primary); border: 1px solid var(--primary); }

.font-num { font-family: 'JetBrains Mono', monospace; }
.text-sub { color: var(--text-sub); }
.font-bold { font-weight: 700; }

.actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.btn-icon {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-sub);
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-icon.delete:hover {
  background: var(--danger);
  border-color: var(--danger);
}

/* 分頁 */
.pagination-bar {
  padding: 16px 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  background: var(--bg-secondary);
}

.page-nav {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}

.page-nav:disabled { opacity: 0.3; cursor: not-allowed; }

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: var(--text-sub);
}

.empty-icon { font-size: 3rem; margin-bottom: 12px; opacity: 0.3; }

.text-emerald { color: var(--success); }
.text-rose { color: var(--danger); }
.text-blue { color: var(--primary); }

@media (max-width: 768px) {
  .hidden-mobile { display: none; }
  .stats-summary { grid-template-columns: repeat(2, 1fr); }
  .search-box { min-width: 100%; }
  .header-main { flex-direction: column; align-items: stretch; }
}
</style>
