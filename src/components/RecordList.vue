<template>
  <div class="card record-list-card">
    <div class="card-header">
      <div class="header-left">
        <h3 class="card-title">
            <span class="icon">📝</span> 交易紀錄列表
        </h3>
      </div>
      
      <div class="toolbar">
         <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="搜尋代碼..." 
                class="search-input"
            >
         </div>
         
         <div class="filters-wrapper">
             <div class="select-group">
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
             </div>
            
            <button class="btn-refresh" @click="refreshData" :disabled="isRefreshing" title="刷新數據">
                <span class="refresh-icon" :class="{ spinning: isRefreshing }">⟳</span>
                <span class="desktop-only">刷新</span>
            </button>
         </div>
      </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <span class="stat-label">總筆數</span>
            <span class="stat-value">{{ processedRecords.length }}</span>
        </div>
        <div class="stat-card">
            <span class="stat-label">買入</span>
            <span class="stat-value text-primary">{{ buyCount }}</span>
        </div>
        <div class="stat-card">
            <span class="stat-label">賣出</span>
            <span class="stat-value text-success">{{ sellCount }}</span>
        </div>
        <div class="stat-card">
            <span class="stat-label">配息</span>
            <span class="stat-value text-warning">{{ divCount }}</span>
        </div>
    </div>

    <div class="list-controls">
        <span class="list-info">顯示第 {{ (currentPage - 1) * itemsPerPage + 1 }} - {{ Math.min(currentPage * itemsPerPage, processedRecords.length) }} 筆，共 {{ processedRecords.length }} 筆</span>
        <select v-model="itemsPerPage" class="per-page-select">
            <option :value="10">10 筆/頁</option>
            <option :value="20">20 筆/頁</option>
            <option :value="50">50 筆/頁</option>
            <option :value="100">100 筆/頁</option>
        </select>
    </div>

    <div class="table-container" ref="tableRef">
        <table class="responsive-table">
            <thead>
                <tr>
                    <th @click="sortBy('txn_date')" class="sortable col-date">
                        日期 <span class="sort-icon">{{ getSortIcon('txn_date') }}</span>
                    </th>
                    <th @click="sortBy('symbol')" class="sortable col-symbol">
                        標的 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('txn_type')" class="sortable col-type">
                        類型 <span class="sort-icon">{{ getSortIcon('txn_type') }}</span>
                    </th>
                    <th class="text-right mobile-hide">股數</th>
                    <th class="text-right mobile-hide">單價(USD)</th>
                    <th @click="sortBy('total_amount_twd')" class="text-right sortable col-amount">
                        總額 (TWD) <span class="sort-icon">{{ getSortIcon('total_amount_twd') }}</span>
                    </th>
                    <th class="text-right col-action">操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="paginatedRecords.length === 0">
                    <td colspan="7" class="empty-state">
                        <div class="empty-content">
                            <span class="empty-icon">📭</span>
                            <p>無符合條件的紀錄</p>
                        </div>
                    </td>
                </tr>
                <tr 
                    v-for="r in paginatedRecords" 
                    :key="r.id"
                    class="record-row"
                    :class="{ 'editing': editingId === r.id }"
                >
                    <td class="col-date" data-label="日期">
                        <div class="date-wrapper">
                            <span class="date-day">{{ formatDate(r.txn_date) }}</span>
                            <span class="date-year mobile-only">{{ r.txn_date.substring(0,4) }}</span>
                        </div>
                    </td>

                    <td class="col-symbol" data-label="標的">
                        <div class="symbol-wrapper">
                            <span class="symbol-badge">{{ r.symbol }}</span>
                            <span class="tag-badge" v-if="r.tag">#{{ r.tag }}</span>
                        </div>
                    </td>

                    <td class="col-type" data-label="類型">
                        <span class="type-pill" :class="r.txn_type.toLowerCase()">
                            {{ getTypeLabel(r.txn_type) }}
                        </span>
                    </td>

                    <td class="text-right font-num mobile-hide" data-label="股數">
                        {{ formatNumber(r.qty, 2) }}
                    </td>

                    <td class="text-right font-num mobile-hide" data-label="單價">
                        {{ formatNumber(r.price, 4) }}
                    </td>

                    <td class="text-right font-num col-amount" data-label="總額(TWD)">
                        <div class="amount-wrapper">
                            <span class="main-amount">NT${{ formatNumber(getTotalAmountTWD(r), 0) }}</span>
                            <div class="mobile-details mobile-only">
                                {{ formatNumber(r.qty, 2) }} 股 @ ${{ formatNumber(r.price, 2) }}
                            </div>
                        </div>
                    </td>

                    <td class="col-action" data-label="操作">
                        <div class="action-group">
                            <button 
                                class="btn-icon edit" 
                                @click="editRecord(r)"
                                title="編輯"
                            >
                                ✎
                            </button>
                            <button 
                                class="btn-icon delete" 
                                @click="deleteRecord(r.id)"
                                title="刪除"
                            >
                                ✕
                            </button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="pagination-container" v-if="totalPages > 1">
        <button class="page-btn" @click="goToPage(1)" :disabled="currentPage === 1" title="第一頁">
            «
        </button>
        <button class="page-btn" @click="prevPage" :disabled="currentPage === 1" title="上一頁">
            ‹
        </button>
        
        <div class="page-numbers">
            <button 
                v-for="page in visiblePages" 
                :key="page"
                class="page-number"
                :class="{ active: page === currentPage }"
                @click="goToPage(page)"
            >
                {{ page }}
            </button>
        </div>
        
        <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages" title="下一頁">
            ›
        </button>
        <button class="page-btn" @click="goToPage(totalPages)" :disabled="currentPage === totalPages" title="最後一頁">
            »
        </button>
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

// Formatters
const formatNumber = (num, d=2) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    return Number(num).toLocaleString('en-US', { 
        minimumFractionDigits: d, 
        maximumFractionDigits: d 
    });
};

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW', { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

const getTypeLabel = (type) => {
    const labels = {
        'BUY': '買入',
        'SELL': '賣出',
        'DIV': '配息'
    };
    return labels[type] || type;
};

// Calculations
const fxRateMap = computed(() => {
    const map = {};
    if (store.history && store.history.length > 0) {
        store.history.forEach(item => {
            map[item.date] = item.fx_rate || 32.0;
        });
    }
    return map;
});

const getFxRateByDate = (dateStr) => {
    if (fxRateMap.value[dateStr]) {
        return fxRateMap.value[dateStr];
    }
    const dates = Object.keys(fxRateMap.value).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] <= dateStr) {
            return fxRateMap.value[dates[i]];
        }
    }
    if (dates.length > 0) {
        return fxRateMap.value[dates[dates.length - 1]];
    }
    return 32.0;
};

const calculateTotalAmountUSD = (record) => {
    const qty = Number(record.qty) || 0;
    const price = Number(record.price) || 0;
    const commission = Number(record.fee || record.commission) || 0;
    const tax = Number(record.tax) || 0;
    // Base amount logic: usually we want absolute value for transaction size
    const baseAmount = Math.abs(qty * price);
    const totalUSD = baseAmount + commission + tax;
    return totalUSD;
};

const getTotalAmountTWD = (record) => {
    const usdAmount = calculateTotalAmountUSD(record);
    const fxRate = getFxRateByDate(record.txn_date);
    return usdAmount * fxRate;
};

// Filters & Data Processing
const availableYears = computed(() => {
    const years = new Set(
        store.records.map(r => r.txn_date.substring(0, 4))
    );
    return Array.from(years).sort().reverse();
});

const processedRecords = computed(() => {
    let result = store.records.filter(r => {
        const matchSearch = r.symbol.toUpperCase().includes(
            searchQuery.value.toUpperCase()
        );
        const matchType = filterType.value === 'ALL' || r.txn_type === filterType.value;
        const matchYear = filterYear.value === 'ALL' || r.txn_date.startsWith(filterYear.value);
        
        let matchGroup = true;
        if (store.currentGroup !== 'all') {
            const tags = (r.tag || '').split(/[,;]/).map(t => t.trim());
            matchGroup = tags.includes(store.currentGroup);
        }
        return matchSearch && matchType && matchYear && matchGroup;
    });

    // Sorting
    result.sort((a, b) => {
        let valA, valB;
        if (sortKey.value === 'total_amount_twd') {
            valA = getTotalAmountTWD(a);
            valB = getTotalAmountTWD(b);
        } else {
            valA = a[sortKey.value];
            valB = b[sortKey.value];
        }
        
        // Date sorting logic
        if (sortKey.value === 'txn_date') {
            return sortOrder.value === 'asc' 
                ? new Date(valA) - new Date(valB) 
                : new Date(valB) - new Date(valA);
        }
        
        // String sorting
        if (typeof valA === 'string') {
            return sortOrder.value === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        }
        
        // Number sorting
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
    return result;
});

// Stats Counters
const buyCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'BUY').length);
const sellCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'SELL').length);
const divCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'DIV').length);

// Pagination Logic
const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return processedRecords.value.slice(start, start + itemsPerPage.value);
});

const totalPages = computed(() => Math.ceil(processedRecords.value.length / itemsPerPage.value) || 1);

const visiblePages = computed(() => {
    const pages = [];
    const total = totalPages.value;
    const current = currentPage.value;
    
    // Simple logic for small page counts
    if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        // Logic for large page counts with ellipsis
        if (current <= 4) {
            for (let i = 1; i <= 5; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        } else if (current >= total - 3) {
            pages.push(1);
            pages.push('...');
            for (let i = total - 4; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);
            pages.push('...');
            for (let i = current - 1; i <= current + 1; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        }
    }
    return pages;
});

// UI Actions
const prevPage = () => { if (currentPage.value > 1) { currentPage.value--; scrollToTop(); } };
const nextPage = () => { if (currentPage.value < totalPages.value) { currentPage.value++; scrollToTop(); } };
const goToPage = (page) => { if (page !== '...' && page >= 1 && page <= totalPages.value) { currentPage.value = page; scrollToTop(); } };

const scrollToTop = () => {
    if (tableRef.value) tableRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const sortBy = (key) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'desc';
    }
};

const getSortIcon = (key) => {
    if (sortKey.value !== key) return '';
    return sortOrder.value === 'asc' ? '↑' : '↓';
};

const refreshData = async () => {
    isRefreshing.value = true;
    try {
        await store.fetchRecords();
        addToast('數據已更新', 'success');
    } catch (e) {
        addToast('刷新失敗', 'error');
    } finally {
        setTimeout(() => { isRefreshing.value = false; }, 500);
    }
};

const editRecord = (record) => {
    editingId.value = record.id;
    emit('edit', record);
    setTimeout(() => { editingId.value = null; }, 2000);
};

const deleteRecord = async (id) => {
    if (!confirm("確定要刪除這筆紀錄嗎？\n此操作無法復原。")) return;
    await store.deleteRecord(id);
};

// Watchers
watch([searchQuery, filterType, filterYear, itemsPerPage], () => { currentPage.value = 1; });
watch(() => store.currentGroup, () => { currentPage.value = 1; });

</script>

<style scoped>
/* Card Base */
.record-list-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-card);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 600px;
}

/* Header */
.card-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    background: rgba(var(--bg-secondary-rgb), 0.3);
    flex-wrap: wrap;
}

.card-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
}
.card-title .icon { font-size: 1.2rem; }

/* Toolbar */
.toolbar {
    display: flex;
    gap: 12px;
    flex: 1;
    justify-content: flex-end;
    flex-wrap: wrap;
}

.search-wrapper { position: relative; min-width: 200px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-sub); pointer-events: none; }
.search-input { width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-app); color: var(--text-main); font-size: 0.9rem; transition: all 0.2s; }
.search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); width: 220px; }

.filters-wrapper { display: flex; gap: 8px; flex-wrap: wrap; }
.select-group { display: flex; gap: 8px; }
.filter-select { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-app); color: var(--text-main); cursor: pointer; font-size: 0.9rem; }
.filter-select:hover { border-color: var(--primary); }

.btn-refresh { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; color: var(--text-main); font-weight: 500; transition: all 0.2s; }
.btn-refresh:hover:not(:disabled) { background: var(--bg-card); border-color: var(--primary); color: var(--primary); }
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.refresh-icon { font-size: 1.1rem; display: inline-block; }
.refresh-icon.spinning { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Stats Grid */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 16px 24px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
.stat-card { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-label { font-size: 0.8rem; color: var(--text-sub); text-transform: uppercase; font-weight: 600; }
.stat-value { font-size: 1.25rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.text-primary { color: var(--primary); }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }

/* List Controls */
.list-controls { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; font-size: 0.85rem; color: var(--text-sub); border-bottom: 1px solid var(--border-color); }
.per-page-select { padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 6px; background: transparent; color: var(--text-main); cursor: pointer; }

/* Table */
.table-container { flex: 1; overflow-x: auto; overflow-y: auto; }
.responsive-table { width: 100%; border-collapse: separate; border-spacing: 0; }

th {
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    color: var(--text-sub);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
    z-index: 2;
}
th.text-right { text-align: right; }
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--text-main); background: var(--border-color); }

td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-main); font-size: 0.95rem; vertical-align: middle; }
.record-row:hover { background: var(--bg-secondary); }
.record-row.editing { background: rgba(59, 130, 246, 0.1); }

/* Columns */
.col-date { width: 120px; }
.date-day { font-family: 'JetBrains Mono', monospace; font-weight: 500; }

.col-symbol { width: 120px; }
.symbol-wrapper { display: flex; align-items: center; gap: 8px; }
.symbol-badge { font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--primary); background: rgba(59, 130, 246, 0.1); padding: 2px 6px; border-radius: 4px; }
.tag-badge { font-size: 0.75rem; color: var(--text-sub); background: var(--bg-secondary); padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-color); }

.col-type { width: 100px; }
.type-pill { font-size: 0.8rem; padding: 4px 10px; border-radius: 99px; font-weight: 600; text-transform: uppercase; }
.type-pill.buy { background: rgba(59, 130, 246, 0.15); color: var(--primary); }
.type-pill.sell { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.type-pill.div { background: rgba(245, 158, 11, 0.15); color: var(--warning); }

.col-amount { font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }

.action-group { display: flex; justify-content: flex-end; gap: 6px; }
.btn-icon { width: 28px; height: 28px; border: 1px solid transparent; background: transparent; border-radius: 6px; cursor: pointer; color: var(--text-sub); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.btn-icon:hover { background: var(--bg-secondary); border-color: var(--border-color); color: var(--text-main); }
.btn-icon.edit:hover { color: var(--primary); background: rgba(59, 130, 246, 0.1); }
.btn-icon.delete:hover { color: var(--danger); background: rgba(239, 68, 68, 0.1); }

/* Pagination */
.pagination-container { padding: 16px; border-top: 1px solid var(--border-color); display: flex; justify-content: center; gap: 6px; align-items: center; background: var(--bg-card); }
.page-btn, .page-number { min-width: 32px; height: 32px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 6px; cursor: pointer; color: var(--text-sub); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: all 0.2s; }
.page-btn:hover:not(:disabled), .page-number:hover { border-color: var(--primary); color: var(--primary); background: var(--bg-card); }
.page-number.active { background: var(--primary); color: white; border-color: var(--primary); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Empty State */
.empty-state { padding: 60px 20px; text-align: center; }
.empty-content { color: var(--text-sub); }
.empty-icon { font-size: 2.5rem; margin-bottom: 10px; display: block; opacity: 0.5; }

/* Responsive Card View */
@media (max-width: 768px) {
    .card-header { flex-direction: column; align-items: stretch; padding: 16px; }
    .toolbar { flex-direction: column; width: 100%; }
    .search-wrapper { width: 100%; }
    .filters-wrapper { justify-content: space-between; }
    .select-group { flex: 1; gap: 8px; }
    .filter-select { flex: 1; }
    .desktop-only { display: none; }
    
    .stats-grid { grid-template-columns: repeat(2, 1fr); padding: 12px; gap: 8px; }
    
    /* Table to Card Transformation */
    .table-container { overflow: visible; }
    .responsive-table, thead, tbody, th, td, tr { display: block; }
    thead { display: none; }
    
    .record-row {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        margin-bottom: 12px;
        padding: 12px;
        position: relative;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        box-shadow: var(--shadow-sm);
    }
    
    td {
        border: none;
        padding: 4px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        text-align: right;
    }
    
    td::before {
        content: attr(data-label);
        font-size: 0.85rem;
        color: var(--text-sub);
        font-weight: 500;
        text-align: left;
    }
    
    /* Mobile Column Overrides */
    .col-date { grid-column: 1 / 2; order: 1; justify-content: flex-start; }
    .col-symbol { grid-column: 2 / 3; order: 2; justify-content: flex-end; }
    .col-symbol::before { display: none; } /* Hide label for symbol to save space */
    
    .col-type { grid-column: 1 / 2; order: 3; justify-content: flex-start; }
    .col-amount { grid-column: 2 / 3; order: 4; justify-content: flex-end; }
    .col-amount::before { display: none; } /* Use logic below for label */
    
    .col-action { 
        grid-column: 1 / -1; 
        order: 10; 
        border-top: 1px solid var(--border-color); 
        margin-top: 8px; 
        padding-top: 8px !important;
        justify-content: flex-end;
    }
    .col-action::before { display: none; }

    .mobile-hide { display: none !important; }
    .mobile-only { display: inline-block !important; }
    
    .date-wrapper { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; }
    .date-year { font-size: 0.75rem; color: var(--text-muted); }
    
    .amount-wrapper { display: flex; flex-direction: column; align-items: flex-end; }
    .main-amount { font-size: 1rem; font-weight: 700; }
    .mobile-details { font-size: 0.75rem; color: var(--text-sub); margin-top: 2px; }
}

@media (max-width: 480px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .list-info { display: none; } /* Hide text info on very small screens */
    .list-controls { justify-content: center; }
}
</style>
