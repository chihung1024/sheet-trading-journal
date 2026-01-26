<template>
  <div class="card">
    <div class="card-header">
        <div class="header-main">
            <h3>交易紀錄列表</h3>
            <button class="btn-toggle-filter mobile-only" @click="showFilters = !showFilters">
                {{ showFilters ? '收起篩選' : '篩選' }}
                <span :class="{ 'rotate': showFilters }">▼</span>
            </button>
        </div>
        
        <div class="toolbar" :class="{ 'mobile-hidden': !showFilters }">
             <div class="search-box">
                <span class="icon">🔍</span>
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="搜尋代碼..." 
                    class="search-input"
                >
             </div>
             
             <div class="filters">
                 <select v-model="filterType" class="filter-select">
                    <option value="ALL">所有類型</option>
                    <option value="BUY">買入</option>
                    <option value="SELL">賣出</option>
                    <option value="DIV">配息</option>
                </select>
                
                <select v-model="filterYear" class="filter-select">
                    <option value="ALL">所有年份</option>
                    <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
                </select>
                
                <select v-model="itemsPerPage" class="filter-select desktop-only">
                    <option :value="10">10 筆/頁</option>
                    <option :value="20">20 筆/頁</option>
                    <option :value="50">50 筆/頁</option>
                </select>
             </div>
             
             <button class="btn-refresh" @click="refreshData" :disabled="isRefreshing">
                <span class="refresh-icon" :class="{ spinning: isRefreshing }">↺</span>
                <span class="btn-text">刷新</span>
             </button>
        </div>
    </div>

    <div class="stats-summary">
        <div class="stat-item">
            <span class="stat-label">總筆數</span>
            <span class="stat-value">{{ processedRecords.length }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">買入</span>
            <span class="stat-value text-primary">{{ buyCount }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">賣出</span>
            <span class="stat-value text-success">{{ sellCount }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">配息</span>
            <span class="stat-value text-warning">{{ divCount }}</span>
        </div>
    </div>

    <div class="table-container desktop-view" ref="tableRef">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('txn_date')" class="sortable">
                        日期 <span class="sort-icon">{{ getSortIcon('txn_date') }}</span>
                    </th>
                    <th @click="sortBy('symbol')" class="sortable">
                        代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('txn_type')" class="sortable">
                        類型 <span class="sort-icon">{{ getSortIcon('txn_type') }}</span>
                    </th>
                    <th class="text-right">股數</th>
                    <th class="text-right">單價 (USD)</th>
                    <th @click="sortBy('total_amount_twd')" class="text-right sortable">
                        總額 (TWD) <span class="sort-icon">{{ getSortIcon('total_amount_twd') }}</span>
                    </th>
                    <th class="text-right">操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="paginatedRecords.length === 0">
                    <td colspan="7" class="empty-state">無符合條件的紀錄</td>
                </tr>
                <tr 
                    v-for="r in paginatedRecords" 
                    :key="r.id"
                    class="record-row"
                    :class="{ 'editing': editingId === r.id }"
                >
                    <td class="date-cell">{{ formatDate(r.txn_date) }}</td>
                    <td><span class="symbol-badge">{{ r.symbol }}</span></td>
                    <td><span class="type-badge" :class="r.txn_type.toLowerCase()">{{ getTypeLabel(r.txn_type) }}</span></td>
                    <td class="text-right font-num">{{ formatNumber(r.qty, 2) }}</td>
                    <td class="text-right font-num">{{ formatNumber(r.price, 4) }}</td>
                    <td class="text-right font-num font-bold">NT${{ formatNumber(getTotalAmountTWD(r), 0) }}</td>
                    <td class="text-right actions">
                        <button class="btn-icon edit" @click="editRecord(r)" title="編輯">✎</button>
                        <button class="btn-icon delete" @click="deleteRecord(r.id)" title="刪除">✕</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="mobile-view">
        <div v-if="paginatedRecords.length === 0" class="empty-state">無符合條件的紀錄</div>
        <div v-for="r in paginatedRecords" :key="`mob-${r.id}`" class="record-card">
            <div class="record-header">
                <div class="record-info">
                    <span class="symbol-text">{{ r.symbol }}</span>
                    <span class="type-badge small" :class="r.txn_type.toLowerCase()">{{ getTypeLabel(r.txn_type) }}</span>
                </div>
                <div class="record-date">{{ formatDate(r.txn_date) }}</div>
            </div>
            <div class="record-body">
                <div class="data-row">
                    <span>數量 / 價格</span>
                    <span class="font-num">{{ formatNumber(r.qty, 2) }} @ {{ formatNumber(r.price, 2) }}</span>
                </div>
                <div class="data-row">
                    <span>總額 (TWD)</span>
                    <span class="font-num font-bold">NT${{ formatNumber(getTotalAmountTWD(r), 0) }}</span>
                </div>
            </div>
            <div class="record-footer">
                <button class="btn-action edit" @click="editRecord(r)">編輯</button>
                <button class="btn-action delete" @click="deleteRecord(r.id)">刪除</button>
            </div>
        </div>
    </div>

    <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" @click="prevPage" :disabled="currentPage === 1">←</button>
        <div class="page-numbers">
            <button v-for="page in visiblePages" :key="page" class="page-number" 
                :class="{ active: page === currentPage }" @click="goToPage(page)">
                {{ page }}
            </button>
        </div>
        <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">→</button>
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

const tableRef = ref(null);
const searchQuery = ref('');
const filterType = ref('ALL');
const filterYear = ref('ALL');
const currentPage = ref(1);
const itemsPerPage = ref(20);
const sortKey = ref('txn_date');
const sortOrder = ref('desc');
const isRefreshing = ref(false);
const editingId = ref(null);
const showFilters = ref(false); // Mobile Only

const formatNumber = (num, d=2) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const getTypeLabel = (type) => {
    const labels = { 'BUY': '買入', 'SELL': '賣出', 'DIV': '配息' };
    return labels[type] || type;
};

const fxRateMap = computed(() => {
    const map = {};
    if (store.history && store.history.length > 0) {
        store.history.forEach(item => { map[item.date] = item.fx_rate || 32.0; });
    }
    return map;
});

const getFxRateByDate = (dateStr) => {
    if (fxRateMap.value[dateStr]) return fxRateMap.value[dateStr];
    const dates = Object.keys(fxRateMap.value).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] <= dateStr) return fxRateMap.value[dates[i]];
    }
    return dates.length > 0 ? fxRateMap.value[dates[dates.length - 1]] : 32.0;
};

const getTotalAmountTWD = (record) => {
    const qty = Number(record.qty) || 0;
    const price = Number(record.price) || 0;
    const commission = Number(record.fee || record.commission) || 0;
    const tax = Number(record.tax) || 0;
    const totalUSD = Math.abs(qty * price) + commission + tax;
    const fxRate = getFxRateByDate(record.txn_date);
    return totalUSD * fxRate;
};

const availableYears = computed(() => {
    const years = new Set(store.records.map(r => r.txn_date.substring(0, 4)));
    return Array.from(years).sort().reverse();
});

const processedRecords = computed(() => {
    let result = store.records.filter(r => {
        const matchSearch = r.symbol.toUpperCase().includes(searchQuery.value.toUpperCase());
        const matchType = filterType.value === 'ALL' || r.txn_type === filterType.value;
        const matchYear = filterYear.value === 'ALL' || r.txn_date.startsWith(filterYear.value);
        let matchGroup = true;
        if (store.currentGroup !== 'all') {
            const tags = (r.tag || '').split(/[,;]/).map(t => t.trim());
            matchGroup = tags.includes(store.currentGroup);
        }
        return matchSearch && matchType && matchYear && matchGroup;
    });

    result.sort((a, b) => {
        let valA, valB;
        if (sortKey.value === 'total_amount_twd') {
            valA = getTotalAmountTWD(a);
            valB = getTotalAmountTWD(b);
        } else {
            valA = a[sortKey.value];
            valB = b[sortKey.value];
        }
        if (sortKey.value === 'txn_date') return sortOrder.value === 'asc' ? new Date(valA) - new Date(valB) : new Date(valB) - new Date(valA);
        if (typeof valA === 'string') return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
    return result;
});

const buyCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'BUY').length);
const sellCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'SELL').length);
const divCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'DIV').length);

const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return processedRecords.value.slice(start, start + itemsPerPage.value);
});

const totalPages = computed(() => Math.ceil(processedRecords.value.length / itemsPerPage.value) || 1);

const visiblePages = computed(() => {
    const pages = [];
    const total = totalPages.value;
    const current = currentPage.value;
    if (total <= 5) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        pages.push(1);
        if(current > 3) pages.push('...');
        let start = Math.max(2, current - 1);
        let end = Math.min(total - 1, current + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if(current < total - 2) pages.push('...');
        pages.push(total);
    }
    return pages;
});

const prevPage = () => { if (currentPage.value > 1) { currentPage.value--; scrollToTop(); } };
const nextPage = () => { if (currentPage.value < totalPages.value) { currentPage.value++; scrollToTop(); } };
const goToPage = (page) => { if (page !== '...' && page >= 1 && page <= totalPages.value) { currentPage.value = page; scrollToTop(); } };

const scrollToTop = () => {
    if (window.innerWidth > 768 && tableRef.value) {
        tableRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        const el = document.querySelector('.card-header');
        if(el) el.scrollIntoView({ behavior: 'smooth' });
    }
};

const sortBy = (key) => {
    if (sortKey.value === key) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    else { sortKey.value = key; sortOrder.value = 'desc'; }
};

const getSortIcon = (key) => sortKey.value !== key ? '⇅' : (sortOrder.value === 'asc' ? '↑' : '↓');

const refreshData = async () => {
    isRefreshing.value = true;
    try { await store.fetchRecords(); addToast('數據已更新', 'success'); } 
    catch (e) { addToast('刷新失敗', 'error'); } 
    finally { setTimeout(() => { isRefreshing.value = false; }, 500); }
};

const editRecord = (record) => { editingId.value = record.id; emit('edit', record); setTimeout(() => { editingId.value = null; }, 2000); };
const deleteRecord = async (id) => { if (!confirm("確定要刪除這筆紀錄嗎？")) return; await store.deleteRecord(id); };

watch([searchQuery, filterType, filterYear], () => { currentPage.value = 1; });
</script>

<style scoped>
.card-header { margin-bottom: 20px; }
.header-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.header-main h3 { margin: 0; padding-left: 12px; border-left: 4px solid var(--primary); }
.btn-toggle-filter { background: transparent; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; font-size: 0.9rem; color: var(--text-sub); display: flex; align-items: center; gap: 6px; }
.btn-toggle-filter span { font-size: 0.7rem; transition: transform 0.3s; }
.btn-toggle-filter span.rotate { transform: rotate(180deg); }

.toolbar { display: flex; gap: 12px; flex-wrap: wrap; background: var(--bg-secondary); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); transition: max-height 0.3s ease, opacity 0.3s ease; }
.search-box { position: relative; flex: 1; min-width: 200px; }
.search-box .icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-sub); }
.search-input { width: 100%; padding: 8px 10px 8px 32px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.95rem; background: var(--bg-card); color: var(--text-main); }

.filters { display: flex; gap: 10px; flex-wrap: wrap; }
.filter-select { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-card); color: var(--text-main); font-size: 0.95rem; }

.btn-refresh { margin-left: auto; background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; cursor: pointer; color: var(--text-sub); display: flex; align-items: center; gap: 6px; }
.refresh-icon.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.stats-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; }
.stat-item { text-align: center; }
.stat-label { font-size: 0.8rem; color: var(--text-sub); display: block; margin-bottom: 4px; }
.stat-value { font-size: 1.2rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

/* Table View */
.table-container { overflow-x: auto; border-radius: 8px; }
table { width: 100%; }
th { text-align: left; padding: 12px; border-bottom: 2px solid var(--border-color); font-size: 0.9rem; color: var(--text-sub); cursor: pointer; white-space: nowrap; }
td { padding: 12px; border-bottom: 1px solid var(--border-color); font-size: 0.95rem; }
.type-badge { padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; }
.type-badge.buy { color: var(--primary); background: rgba(59, 130, 246, 0.1); }
.type-badge.sell { color: var(--success); background: rgba(16, 185, 129, 0.1); }
.type-badge.div { color: var(--warning); background: rgba(245, 158, 11, 0.1); }

/* Mobile View */
.mobile-view { display: none; }
.record-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.record-header { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed var(--border-color); }
.record-info { display: flex; align-items: center; gap: 8px; }
.symbol-text { font-weight: 700; font-size: 1.1rem; }
.record-date { font-size: 0.85rem; color: var(--text-sub); font-family: 'JetBrains Mono'; }
.record-body { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
.data-row { display: flex; justify-content: space-between; font-size: 0.95rem; }
.record-footer { display: flex; gap: 10px; }
.btn-action { flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); font-weight: 600; cursor: pointer; }
.btn-action.edit { color: var(--primary); }
.btn-action.delete { color: var(--danger); }

/* Utilities */
.text-primary { color: var(--primary); }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }
.font-num { font-family: 'JetBrains Mono', monospace; }
.mobile-hidden { display: flex; } /* Desktop Default */
.mobile-only { display: none; }

@media (max-width: 768px) {
    .desktop-view { display: none; }
    .mobile-view { display: block; }
    .mobile-only { display: flex; }
    .mobile-hidden { display: none; }
    .toolbar { flex-direction: column; }
    .search-box, .filter-select, .btn-refresh { width: 100%; margin-left: 0; }
    .stats-summary { grid-template-columns: 2fr 1fr 1fr 1fr; }
    .stat-value { font-size: 1rem; }
}
</style>
