<template>
  <div class="card">
    <div class="card-header">
        <div class="header-top">
            <h3>交易紀錄列表</h3>
            <button class="btn-toggle-filter mobile-only" @click="showFilters = !showFilters">
                <span class="filter-icon">🌪️</span>
                {{ showFilters ? '收起篩選' : '篩選' }}
                <span class="arrow-icon" :class="{ 'rotate': showFilters }">▼</span>
            </button>
        </div>
        
        <div class="toolbar" :class="{ 'mobile-hidden': !showFilters }">
             <div class="search-box">
                <span class="icon">🔍</span>
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="搜尋股票代碼..." 
                    class="search-input"
                >
             </div>
             
             <div class="filters">
                 <select v-model="filterType" class="filter-select">
                    <option value="ALL">所有類型 (All Types)</option>
                    <option value="BUY">買入 (Buy)</option>
                    <option value="SELL">賣出 (Sell)</option>
                    <option value="DIV">配息 (Dividend)</option>
                </select>
                
                <select v-model="filterYear" class="filter-select">
                    <option value="ALL">所有年份 (All Years)</option>
                    <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
                </select>
                
                <select v-model="itemsPerPage" class="filter-select desktop-only">
                    <option :value="10">10 筆/頁</option>
                    <option :value="20">20 筆/頁</option>
                    <option :value="50">50 筆/頁</option>
                    <option :value="100">100 筆/頁</option>
                </select>
             </div>
             
             <button class="btn-refresh" @click="refreshData" :disabled="isRefreshing">
                <span class="refresh-icon" :class="{ spinning: isRefreshing }">↺</span>
                <span class="btn-text desktop-only">刷新數據</span>
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
                    <th @click="sortBy('txn_date')" class="sortable sticky-header">
                        日期 <span class="sort-icon">{{ getSortIcon('txn_date') }}</span>
                    </th>
                    <th @click="sortBy('symbol')" class="sortable sticky-header">
                        代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('txn_type')" class="sortable sticky-header">
                        類型 <span class="sort-icon">{{ getSortIcon('txn_type') }}</span>
                    </th>
                    <th class="text-right sticky-header">股數</th>
                    <th class="text-right sticky-header">單價 (USD)</th>
                    <th @click="sortBy('total_amount_twd')" class="text-right sortable sticky-header">
                        總額 (TWD) <span class="sort-icon">{{ getSortIcon('total_amount_twd') }}</span>
                    </th>
                    <th class="text-right sticky-header action-col">操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="paginatedRecords.length === 0">
                    <td colspan="7" class="empty-state">
                        <div class="empty-icon">📭</div>
                        <div>無符合條件的紀錄</div>
                    </td>
                </tr>
                <tr 
                    v-for="r in paginatedRecords" 
                    :key="r.id"
                    class="record-row"
                    :class="{ 'editing': editingId === r.id }"
                >
                    <td class="date-cell">{{ formatDate(r.txn_date) }}</td>
                    <td>
                        <span class="symbol-badge">{{ r.symbol }}</span>
                    </td>
                    <td>
                        <span class="type-badge" :class="r.txn_type.toLowerCase()">
                            {{ getTypeLabel(r.txn_type) }}
                        </span>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(r.qty, 2) }}</td>
                    <td class="text-right font-num">{{ formatNumber(r.price, 4) }}</td>
                    <td class="text-right font-num font-bold">
                        NT${{ formatNumber(getTotalAmountTWD(r), 0) }}
                    </td>
                    <td class="text-right actions">
                        <button class="btn-icon edit" @click="editRecord(r)" title="編輯">✎</button>
                        <button class="btn-icon delete" @click="deleteRecord(r.id)" title="刪除">✕</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="mobile-view">
        <div v-if="paginatedRecords.length === 0" class="empty-state">
            <div class="empty-icon">📭</div>
            <div>無符合條件的紀錄</div>
        </div>
        
        <div v-for="r in paginatedRecords" :key="`mob-${r.id}`" class="record-card">
            <div class="card-row-top">
                <div class="card-info-left">
                    <span class="symbol-text">{{ r.symbol }}</span>
                    <span class="type-badge small" :class="r.txn_type.toLowerCase()">
                        {{ getTypeLabel(r.txn_type) }}
                    </span>
                </div>
                <div class="card-date">{{ formatDate(r.txn_date) }}</div>
            </div>
            
            <div class="card-divider"></div>
            
            <div class="card-body">
                <div class="data-pair">
                    <span class="label">數量</span>
                    <span class="val">{{ formatNumber(r.qty, 2) }}</span>
                </div>
                <div class="data-pair">
                    <span class="label">單價 (USD)</span>
                    <span class="val">{{ formatNumber(r.price, 4) }}</span>
                </div>
                <div class="data-pair full-width">
                    <span class="label">總額 (TWD)</span>
                    <span class="val font-bold text-primary">NT$ {{ formatNumber(getTotalAmountTWD(r), 0) }}</span>
                </div>
            </div>
            
            <div class="card-footer">
                <button class="btn-mobile-action edit" @click="editRecord(r)">
                    ✎ 編輯
                </button>
                <button class="btn-mobile-action delete" @click="deleteRecord(r.id)">
                    ✕ 刪除
                </button>
            </div>
        </div>
    </div>

    <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" @click="goToPage(1)" :disabled="currentPage === 1">«</button>
        <button class="page-btn" @click="prevPage" :disabled="currentPage === 1">←</button>
        
        <div class="page-numbers">
            <span class="mobile-page-info mobile-only">{{ currentPage }} / {{ totalPages }}</span>
            <button 
                v-for="page in visiblePages" 
                :key="page"
                class="page-number desktop-only"
                :class="{ active: page === currentPage }"
                @click="goToPage(page)"
            >
                {{ page }}
            </button>
        </div>
        
        <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">→</button>
        <button class="page-btn" @click="goToPage(totalPages)" :disabled="currentPage === totalPages">»</button>
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
const showFilters = ref(false); // Mobile toggle state

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

// 匯率計算邏輯
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
    // 簡單的回溯查找最近的匯率
    const dates = Object.keys(fxRateMap.value).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] <= dateStr) {
            return fxRateMap.value[dates[i]];
        }
    }
    if (dates.length > 0) {
        return fxRateMap.value[dates[dates.length - 1]];
    }
    return 32.0; // 默認匯率
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
    const years = new Set(
        store.records.map(r => r.txn_date.substring(0, 4))
    );
    return Array.from(years).sort().reverse();
});

// 數據過濾與排序核心邏輯
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

    result.sort((a, b) => {
        let valA, valB;
        if (sortKey.value === 'total_amount_twd') {
            valA = getTotalAmountTWD(a);
            valB = getTotalAmountTWD(b);
        } else {
            valA = a[sortKey.value];
            valB = b[sortKey.value];
        }
        if (sortKey.value === 'txn_date') {
            return sortOrder.value === 'asc' 
                ? new Date(valA) - new Date(valB) 
                : new Date(valB) - new Date(valA);
        }
        if (typeof valA === 'string') {
            return sortOrder.value === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
    return result;
});

const buyCount = computed(() => 
    processedRecords.value.filter(r => r.txn_type === 'BUY').length
);
const sellCount = computed(() => 
    processedRecords.value.filter(r => r.txn_type === 'SELL').length
);
const divCount = computed(() => 
    processedRecords.value.filter(r => r.txn_type === 'DIV').length
);

const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return processedRecords.value.slice(start, start + itemsPerPage.value);
});

const totalPages = computed(() => 
    Math.ceil(processedRecords.value.length / itemsPerPage.value) || 1
);

const visiblePages = computed(() => {
    const pages = [];
    const total = totalPages.value;
    const current = currentPage.value;
    
    if (total <= 5) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        pages.push(1);
        if (current > 3) pages.push('...');
        
        let start = Math.max(2, current - 1);
        let end = Math.min(total - 1, current + 1);
        
        for (let i = start; i <= end; i++) pages.push(i);
        
        if (current < total - 2) pages.push('...');
        pages.push(total);
    }
    return pages;
});

const prevPage = () => { 
    if (currentPage.value > 1) {
        currentPage.value--;
        scrollToTop();
    }
};

const nextPage = () => { 
    if (currentPage.value < totalPages.value) {
        currentPage.value++;
        scrollToTop();
    }
};

const goToPage = (page) => {
    if (page !== '...' && page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
        scrollToTop();
    }
};

const scrollToTop = () => {
    // 桌面版滾動表格，手機版滾動到卡片頂部
    if (window.innerWidth > 768 && tableRef.value) {
        tableRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        const el = document.querySelector('.card-header');
        if(el) el.scrollIntoView({ behavior: 'smooth' });
    }
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
    if (sortKey.value !== key) return '⇅';
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
    if (!confirm("確定要刪除這筆紀錄嗎？此操作無法復原。")) return;
    try {
        await store.deleteRecord(id);
        // 若刪除後當前頁無數據，自動跳轉前一頁
        if (paginatedRecords.value.length === 0 && currentPage.value > 1) {
            currentPage.value--;
        }
    } catch (e) {
        console.error(e);
    }
};

watch([searchQuery, filterType, filterYear, itemsPerPage], () => {
    currentPage.value = 1;
});
</script>

<style scoped>
/* Card Header & Controls */
.card-header { margin-bottom: 20px; }
.header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.header-top h3 { margin: 0; padding-left: 12px; border-left: 4px solid var(--primary); font-size: 1.25rem; }

/* Filter Toggle Button (Mobile) */
.btn-toggle-filter { 
    background: transparent; border: 1px solid var(--border-color); padding: 8px 14px; 
    border-radius: 8px; font-size: 0.95rem; color: var(--text-main); 
    display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s;
}
.btn-toggle-filter:active { background: var(--bg-secondary); }
.arrow-icon { font-size: 0.7rem; transition: transform 0.3s; }
.arrow-icon.rotate { transform: rotate(180deg); }

/* Toolbar */
.toolbar { 
    display: flex; gap: 12px; flex-wrap: wrap; align-items: center; 
    background: var(--bg-secondary); padding: 16px; border-radius: 12px; 
    border: 1px solid var(--border-color); transition: all 0.3s ease;
}
.search-box { position: relative; flex: 1; min-width: 220px; }
.search-box .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-sub); }
.search-input { width: 100%; padding: 10px 10px 10px 36px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--bg-card); color: var(--text-main); transition: border 0.2s; }
.search-input:focus { outline: none; border-color: var(--primary); }

.filters { display: flex; gap: 10px; flex-wrap: wrap; }
.filter-select { 
    padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; 
    background: var(--bg-card); color: var(--text-main); font-size: 0.95rem; cursor: pointer; 
}

.btn-refresh { 
    margin-left: auto; background: var(--bg-card); border: 1px solid var(--border-color); 
    padding: 10px 20px; border-radius: 8px; cursor: pointer; color: var(--text-sub); 
    display: flex; align-items: center; gap: 8px; font-weight: 500; transition: all 0.2s;
}
.btn-refresh:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.refresh-icon.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Stats Summary */
.stats-summary { 
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; 
    padding: 20px; background: var(--bg-secondary); border-radius: 12px; 
}
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.stat-label { font-size: 0.85rem; color: var(--text-sub); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
.stat-value { font-size: 1.4rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

/* Desktop Table View */
.table-container { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border-color); max-height: 650px; overflow-y: auto; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { 
    text-align: left; padding: 16px; background: var(--bg-secondary); 
    border-bottom: 2px solid var(--border-color); color: var(--text-sub); 
    font-size: 0.9rem; font-weight: 600; white-space: nowrap; cursor: pointer; 
}
th.sticky-header { position: sticky; top: 0; z-index: 10; }
th:hover { color: var(--primary); background: var(--bg-card); }
td { padding: 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; font-size: 0.95rem; }
tr:last-child td { border-bottom: none; }
.record-row:hover { background-color: var(--bg-secondary); }

/* Badges & Cells */
.date-cell { font-family: 'JetBrains Mono', monospace; color: var(--text-sub); }
.symbol-badge { font-weight: 700; color: var(--primary); background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px; }

.type-badge { padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; }
.type-badge.buy { color: var(--primary); background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); }
.type-badge.sell { color: var(--success); background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); }
.type-badge.div { color: var(--warning); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); }

.actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-icon { border: none; background: transparent; cursor: pointer; padding: 6px; border-radius: 4px; font-size: 1.1rem; color: var(--text-sub); transition: all 0.2s; }
.btn-icon:hover { background: var(--bg-secondary); transform: scale(1.1); }
.btn-icon.edit:hover { color: var(--primary); }
.btn-icon.delete:hover { color: var(--danger); }

/* Mobile Card View */
.mobile-view { display: none; }
.record-card { 
    background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; 
    padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm); 
}
.card-row-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-info-left { display: flex; align-items: center; gap: 10px; }
.symbol-text { font-size: 1.1rem; font-weight: 700; }
.card-date { font-size: 0.85rem; color: var(--text-sub); font-family: 'JetBrains Mono'; }
.card-divider { height: 1px; background: var(--border-color); margin-bottom: 12px; opacity: 0.5; }
.card-body { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.data-pair { display: flex; flex-direction: column; gap: 2px; }
.data-pair.full-width { grid-column: 1 / -1; margin-top: 4px; }
.data-pair .label { font-size: 0.8rem; color: var(--text-sub); }
.data-pair .val { font-size: 1rem; font-family: 'JetBrains Mono'; color: var(--text-main); }
.card-footer { display: flex; gap: 12px; }
.btn-mobile-action { 
    flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); 
    background: var(--bg-secondary); font-weight: 600; cursor: pointer; font-size: 0.95rem; 
}
.btn-mobile-action.edit { color: var(--primary); }
.btn-mobile-action.delete { color: var(--danger); }

/* Pagination */
.pagination { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 24px; }
.page-btn, .page-number { 
    min-width: 36px; height: 36px; border: 1px solid var(--border-color); background: var(--bg-card); 
    border-radius: 8px; display: flex; align-items: center; justify-content: center; 
    cursor: pointer; color: var(--text-main); transition: all 0.2s; 
}
.page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.page-number.active { background: var(--primary); color: white; border-color: var(--primary); font-weight: 700; }
.mobile-page-info { font-family: 'JetBrains Mono'; font-weight: 600; color: var(--text-sub); }

/* Utilities */
.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.text-primary { color: var(--primary); }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }
.mobile-hidden { display: flex; } /* Desktop Default */
.mobile-only { display: none; }
.empty-state { text-align: center; padding: 60px 20px; color: var(--text-sub); }
.empty-icon { font-size: 2.5rem; margin-bottom: 10px; opacity: 0.6; }

/* Responsive Media Queries */
@media (max-width: 768px) {
    .desktop-view { display: none; }
    .mobile-view { display: block; }
    .mobile-only { display: flex; }
    .desktop-only { display: none; }
    .mobile-hidden { display: none; }
    
    .toolbar { flex-direction: column; align-items: stretch; padding: 12px; gap: 12px; }
    .search-box, .filter-select, .btn-refresh { width: 100%; margin-left: 0; }
    
    .stats-summary { grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; }
    .stat-value { font-size: 1.2rem; }
    
    .card-header { margin-bottom: 16px; }
}
</style>
