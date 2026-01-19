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
              placeholder="搜尋代碼、標籤..." 
              class="search-input"
            />
          </div>
          <div class="filter-group">
            <select v-model="filterType" class="filter-select">
              <option value="ALL">所有類別</option>
              <option value="BUY">買入</option>
              <option value="SELL">賣出</option>
              <option value="DIV">股息</option>
            </select>
            <select v-model="filterYear" class="filter-select">
              <option value="ALL">所有年份</option>
              <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="stats-summary-bar">
      <div class="stat-pill">
        <span class="label">總筆數</span>
        <span class="value">{{ processedRecords.length }}</span>
      </div>
      <div class="stat-pill">
        <span class="label">買入</span>
        <span class="value text-primary">{{ buyCount }}</span>
      </div>
      <div class="stat-pill">
        <span class="label">賣出</span>
        <span class="value text-success">{{ sellCount }}</span>
      </div>
      <div class="stat-pill">
        <span class="label">股息</span>
        <span class="value text-warning">{{ divCount }}</span>
      </div>
    </div>

    <div class="table-container">
      <table class="pro-table">
        <thead>
          <tr>
            <th @click="sortBy('txn_date')" class="sortable col-date">
              日期 <span class="sort-icon">{{ getSortIcon('txn_date') }}</span>
            </th>
            <th @click="sortBy('symbol')" class="sortable">
              標的 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
            </th>
            <th class="text-center">類別</th>
            <th class="text-right">數量</th>
            <th class="text-right">成交價 (USD)</th>
            <th @click="sortBy('total_amount_twd')" class="text-right sortable hidden-mobile">
              總額 (TWD) <span class="sort-icon">{{ getSortIcon('total_amount_twd') }}</span>
            </th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        
        <tbody>
          <tr v-if="paginatedRecords.length === 0">
            <td colspan="7" class="empty-row">
              <div class="empty-content">
                <span class="empty-icon">📁</span>
                <p>無符合條件的交易紀錄</p>
              </div>
            </td>
          </tr>

          <tr 
            v-for="r in paginatedRecords" 
            :key="r.id"
            class="record-row"
          >
            <td class="font-num date-text">{{ formatDate(r.txn_date) }}</td>
            <td>
              <span class="symbol-badge">{{ r.symbol }}</span>
              <div class="tag-hint" v-if="r.tag"><small>🏷️ {{ r.tag }}</small></div>
            </td>
            <td class="text-center">
              <span :class="['type-tag', r.txn_type.toLowerCase()]">
                {{ getTypeLabel(r.txn_type) }}
              </span>
            </td>
            <td class="text-right font-num">{{ formatNumber(r.qty, 2) }}</td>
            <td class="text-right font-num text-sub">${{ formatNumber(r.price, 2) }}</td>
            <td class="text-right font-num font-bold hidden-mobile">
              NT${{ formatNumber(getTotalAmountTWD(r), 0) }}
            </td>
            <td class="text-center">
              <div class="action-btns">
                <button @click="editRecord(r)" class="btn-tool edit" title="編輯">✎</button>
                <button @click="deleteRecord(r.id)" class="btn-tool delete" title="刪除">✕</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination-footer" v-if="totalPages > 1">
      <div class="page-info">第 {{ currentPage }} / {{ totalPages }} 頁</div>
      <div class="page-controls">
        <button @click="goToPage(1)" :disabled="currentPage === 1">«</button>
        <button @click="prevPage" :disabled="currentPage === 1">‹</button>
        <span class="page-current">{{ currentPage }}</span>
        <button @click="nextPage" :disabled="currentPage === totalPages">›</button>
        <button @click="goToPage(totalPages)" :disabled="currentPage === totalPages">»</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

const store = usePortfolioStore();
const { addToast } = useToast();
const emit = defineEmits(['edit']);

// --- 狀態控制 ---
const searchQuery = ref('');
const filterType = ref('ALL');
const filterYear = ref('ALL');
const currentPage = ref(1);
const itemsPerPage = 20;
const sortKey = ref('txn_date');
const sortOrder = ref('desc');

// --- 格式化工具 ---
const formatNumber = (num, d = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '-';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const formatDate = (dateStr) => {
  return dateStr.replace(/-/g, '/');
};

const getTypeLabel = (type) => {
  const labels = { 'BUY': '買入', 'SELL': '賣出', 'DIV': '股息', 'DIVIDEND': '股息' };
  return labels[type] || type;
};

// --- 金融邏輯計算 ---
const getTotalAmountTWD = (record) => {
  const qty = Math.abs(Number(record.qty) || 0);
  const price = Number(record.price) || 0;
  const fees = (Number(record.fee || record.commission) || 0) + (Number(record.tax) || 0);
  const usdTotal = (qty * price) + fees;
  
  // 取得該日匯率 (對齊歷史數據)
  const historyItem = store.history.find(h => h.date === record.txn_date);
  const rate = historyItem ? historyItem.fx_rate : 32.0;
  return usdTotal * rate;
};

// --- 篩選與排序 ---
const availableYears = computed(() => {
  const years = new Set(store.records.map(r => r.txn_date.substring(0, 4)));
  return Array.from(years).sort().reverse();
});

const processedRecords = computed(() => {
  let result = store.records.filter(r => {
    const matchSearch = r.symbol.toUpperCase().includes(searchQuery.value.toUpperCase()) || (r.tag && r.tag.includes(searchQuery.value));
    const matchType = filterType.value === 'ALL' || r.txn_type === filterType.value;
    const matchYear = filterYear.value === 'ALL' || r.txn_date.startsWith(filterYear.value);
    return matchSearch && matchType && matchYear;
  });

  result.sort((a, b) => {
    let valA = a[sortKey.value], valB = b[sortKey.value];
    if (sortKey.value === 'txn_date') {
      valA = new Date(valA); valB = new Date(valB);
    }
    if (sortOrder.value === 'asc') return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });
  return result;
});

const buyCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'BUY').length);
const sellCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'SELL').length);
const divCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'DIV').length);

// --- 分頁邏輯 ---
const totalPages = computed(() => Math.ceil(processedRecords.value.length / itemsPerPage) || 1);
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return processedRecords.value.slice(start, start + itemsPerPage);
});

const goToPage = (p) => { currentPage.value = p; };
const prevPage = () => { if (currentPage.value > 1) currentPage.value--; };
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };

// --- 操作動作 ---
const sortBy = (key) => {
  if (sortKey.value === key) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortOrder.value = 'desc'; }
};

const getSortIcon = (key) => {
  if (sortKey.value !== key) return '↕';
  return sortOrder.value === 'asc' ? '↑' : '↓';
};

const editRecord = (r) => emit('edit', r);

// 【關鍵修正】: 呼叫 Store 封裝好的刪除邏輯以確保 RELOAD_UI 連鎖反應
const deleteRecord = async (id) => {
  if (confirm("確定要刪除此筆紀錄嗎？若為最後一筆，系統將自動重置分析數據。")) {
    await store.deleteRecord(id);
  }
};

watch([searchQuery, filterType, filterYear], () => { currentPage.value = 1; });
</script>

<style scoped>
.record-list-card { padding: 0; overflow: hidden; }
.header-main { padding: 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 16px; }
.panel-title { margin: 0; font-size: 1.2rem; font-weight: 700; padding-left: 12px; border-left: 4px solid var(--primary); }
.toolbar { display: flex; gap: 12px; align-items: center; }

.search-box { position: relative; min-width: 220px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); opacity: 0.5; }
.search-input { width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-main); font-size: 0.9rem; }

.filter-group { display: flex; gap: 8px; }
.filter-select { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); color: var(--text-main); font-size: 0.9rem; cursor: pointer; }

/* 統計摘要條 */
.stats-summary-bar { display: flex; gap: 24px; padding: 12px 24px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
.stat-pill { display: flex; align-items: baseline; gap: 8px; }
.stat-pill .label { font-size: 0.8rem; color: var(--text-sub); font-weight: 600; }
.stat-pill .value { font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 700; }

/* 表格樣式 */
.table-container { overflow-x: auto; }
.pro-table { width: 100%; border-collapse: collapse; }
.pro-table th { background: var(--bg-secondary); padding: 12px 16px; text-align: left; font-size: 0.8rem; color: var(--text-sub); border-bottom: 2px solid var(--border-color); white-space: nowrap; }
.pro-table th.sortable { cursor: pointer; }
.pro-table th.sortable:hover { color: var(--primary); }
.pro-table td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }

.record-row:hover { background: rgba(var(--primary-rgb), 0.03); }
.date-text { color: var(--text-sub); font-size: 0.85rem; }
.symbol-badge { font-weight: 700; color: var(--primary); background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px; }
.tag-hint { color: var(--text-sub); margin-top: 4px; }

.type-tag { padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
.type-tag.buy { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.type-tag.sell { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
.type-tag.div, .type-tag.dividend { background: rgba(245, 158, 11, 0.1); color: var(--warning); }

.font-num { font-family: 'JetBrains Mono', monospace; }
.text-sub { color: var(--text-sub); }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }
.text-right { text-align: right; }

.action-btns { display: flex; justify-content: center; gap: 8px; }
.btn-tool { background: var(--bg-secondary); border: 1px solid var(--border-color); width: 30px; height: 30px; border-radius: 6px; cursor: pointer; color: var(--text-sub); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.btn-tool:hover { background: var(--primary); color: white; border-color: var(--primary); }
.btn-tool.delete:hover { background: var(--danger); border-color: var(--danger); }

/* 分頁底部 */
.pagination-footer { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); }
.page-info { font-size: 0.85rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.page-controls { display: flex; align-items: center; gap: 4px; }
.page-controls button { width: 32px; height: 32px; border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 6px; cursor: pointer; font-size: 1rem; color: var(--text-main); }
.page-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
.page-current { min-width: 32px; text-align: center; font-weight: 700; color: var(--primary); font-family: 'JetBrains Mono', monospace; }

.empty-row { padding: 60px 0; text-align: center; }
.empty-icon { font-size: 3rem; opacity: 0.2; margin-bottom: 12px; }

@media (max-width: 768px) {
  .hidden-mobile { display: none; }
  .header-main { flex-direction: column; align-items: stretch; }
  .toolbar { flex-direction: column; align-items: stretch; }
  .search-box { min-width: 100%; }
}
</style>
