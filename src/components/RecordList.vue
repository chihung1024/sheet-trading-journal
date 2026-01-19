<template>
  <div class="card">
    <div class="card-header">
        <h3>交易紀錄列表</h3>
        
        <div class="toolbar">
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
                
                <select v-model="itemsPerPage" class="filter-select">
                    <option :value="10">每頁 10 筆</option>
                    <option :value="20">每頁 20 筆</option>
                    <option :value="50">每頁 50 筆</option>
                    <option :value="100">每頁 100 筆</option>
                </select>
             </div>
             
             <button class="btn-refresh" @click="refreshData" :disabled="isRefreshing">
                <span class="refresh-icon" :class="{ spinning: isRefreshing }">↺</span>
                刷新
             </button>
        </div>
    </div>

    <div class="stats-summary">
        <div class="stat-item">
            <span class="stat-label">總交易筆數</span>
            <span class="stat-value">{{ processedRecords.length }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">買入筆數</span>
            <span class="stat-value text-primary">{{ buyCount }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">賣出筆數</span>
            <span class="stat-value text-success">{{ sellCount }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">配息筆數</span>
            <span class="stat-value text-warning">{{ divCount }}</span>
        </div>
    </div>

    <div class="table-container" ref="tableRef">
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
                    <td colspan="7" class="empty-state">
                        <div class="empty-icon">📋</div>
                        <div>無符合條件的紀錄</div>
                    </td>
                </tr>
                <tr 
                    v-for="r in paginatedRecords" 
                    :key="r.id"
                    class="record-row"
                    :class="{ 'editing': editingId === r.id }"
                >
                    <td class="date-cell">
                        <span class="date-text">{{ formatDate(r.txn_date) }}</span>
                    </td>
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
                        <button 
                            class="btn-icon edit" 
                            @click="editRecord(r)"
                            title="編輯"
                        >
                            ✎
                        </button>
                        <button 
                            class="btn-icon delete" 
                            @click="handleDelete(r.id)"
                            title="刪除"
                        >
                            ✕
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" @click="goToPage(1)" :disabled="currentPage === 1">
            ««
        </button>
        <button class="page-btn" @click="prevPage" :disabled="currentPage === 1">
            ←
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
        
        <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">
            →
        </button>
        <button class="page-btn" @click="goToPage(totalPages)" :disabled="currentPage === totalPages">
            »»
        </button>
        
        <span class="page-info">
            第 {{ currentPage }} / {{ totalPages }} 頁
        </span>
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

// 取得匯率
const fxRateMap = computed(() => {
    const map = {};
    if (store.portfolio?.history && store.portfolio.history.length > 0) {
        store.portfolio.history.forEach(item => {
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
        if (dates[i] <= dateStr) return fxRateMap.value[dates[i]];
    }
    return 32.0;
};

const calculateTotalAmountUSD = (record) => {
    const qty = Number(record.qty) || 0;
    const price = Number(record.price) || 0;
    const commission = Number(record.commission) || 0;
    const tax = Number(record.tax) || 0;
    return Math.abs(qty * price) + commission + tax;
};

const getTotalAmountTWD = (record) => {
    const usdAmount = calculateTotalAmountUSD(record);
    const fxRate = getFxRateByDate(record.txn_date);
    return usdAmount * fxRate;
};

const availableYears = computed(() => {
    const years = new Set(
        store.records.map(r => r.txn_date.substring(0, 4))
    );
    return Array.from(years).sort().reverse();
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
            return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
    
    return result;
});

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
    if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
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

const goToPage = (page) => {
    if (page !== '...' && page >= 1 && page <= totalPages.value) {
        currentPage.value = page;
        if (tableRef.value) tableRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

const prevPage = () => goToPage(currentPage.value - 1);
const nextPage = () => goToPage(currentPage.value + 1);

const refreshData = async () => {
    isRefreshing.value = true;
    try {
        await Promise.all([store.fetchRecords(), store.fetchPortfolio()]);
        addToast('數據已更新', 'success');
    } catch (e) {
        addToast('刷新失敗', 'error');
    } finally {
        setTimeout(() => isRefreshing.value = false, 500);
    }
};

const editRecord = (record) => {
    editingId.value = record.id;
    emit('edit', record);
    setTimeout(() => { editingId.value = null; }, 2000);
};

/**
 * 改善方案關鍵：呼叫 Store 的 deleteRecord 觸發連動更新
 */
const handleDelete = async (id) => {
    if (!confirm("確定要刪除這筆紀錄嗎？")) return;
    
    const success = await store.deleteRecord(id);
    if (success) {
        addToast("刪除成功", "success");
    } else {
        addToast(store.error || "刪除失敗", "error");
    }
};

watch([searchQuery, filterType, filterYear, itemsPerPage], () => {
    currentPage.value = 1;
});

watch(() => store.currentGroup, () => {
    currentPage.value = 1;
});
</script>

<style scoped>
/* 樣式部分維持不變，僅提供完整程式碼以利複製 */
.card-header { display: flex; flex-direction: column; gap: 20px; margin-bottom: 24px; }
.card-header h3 { margin: 0; padding-left: 12px; border-left: 4px solid var(--primary); }
.toolbar { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; background: var(--bg-secondary); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); }
.search-box { position: relative; flex: 1 1 240px; min-width: 200px; }
.search-box .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-sub); pointer-events: none; }
.search-input { width: 100%; padding: 10px 10px 10px 36px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1rem; background: var(--bg-card); color: var(--text-main); transition: all 0.2s ease; }
.search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.filters { display: flex; gap: 12px; flex-wrap: wrap; }
.filter-select { padding: 10px 16px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); font-size: 1rem; color: var(--text-main); cursor: pointer; transition: all 0.2s ease; }
.filter-select:hover { border-color: var(--primary); }
.btn-refresh { margin-left: auto; background: var(--bg-card); border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 8px; cursor: pointer; color: var(--text-sub); font-size: 1rem; font-weight: 500; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; }
.btn-refresh:hover:not(:disabled) { color: var(--primary); border-color: var(--primary); background: rgba(59, 130, 246, 0.05); }
.refresh-icon { display: inline-block; font-size: 1.2rem; transition: transform 0.3s ease; }
.refresh-icon.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.stats-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius-sm); }
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.stat-label { font-size: 0.9rem; color: var(--text-sub); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 1.7rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--text-main); }
.stat-value.text-primary { color: var(--primary); }
.stat-value.text-success { color: var(--success); }
.stat-value.text-warning { color: var(--warning); }
.table-container { overflow-x: auto; border-radius: var(--radius-sm); }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { text-align: left; padding: 16px 20px; border-bottom: 2px solid var(--border-color); color: var(--text-sub); font-size: 0.9rem; font-weight: 700; white-space: nowrap; background: var(--bg-secondary); }
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--primary); background: var(--bg-card); }
td { padding: 16px 20px; border-bottom: 1px solid var(--border-color); font-size: 1rem; }
.record-row:hover { background-color: var(--bg-secondary); }
.symbol-badge { display: inline-block; font-weight: 700; font-size: 1.05rem; padding: 6px 12px; background: var(--bg-secondary); color: var(--primary); border-radius: 8px; }
.type-badge { font-size: 0.9rem; padding: 6px 12px; border-radius: 8px; font-weight: 700; text-transform: uppercase; display: inline-block; }
.type-badge.buy { background: rgba(59, 130, 246, 0.15); color: var(--primary); border: 1px solid var(--primary); }
.type-badge.sell { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success); }
.type-badge.div { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid var(--warning); }
.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-icon { border: none; background: var(--bg-secondary); cursor: pointer; color: var(--text-sub); font-size: 1.1rem; padding: 8px 10px; border-radius: 6px; transition: all 0.2s ease; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.btn-icon:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
.btn-icon.delete:hover { background: var(--danger); color: white; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 30px; }
.page-btn, .page-number { min-width: 36px; height: 36px; border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-sub); }
.page-number.active { background: var(--primary); color: white; border-color: var(--primary); }
.page-info { font-size: 1rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; margin-left: 8px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px; }
.empty-state { text-align: center; padding: 80px 20px; color: var(--text-sub); }
@media (max-width: 768px) {
    .toolbar { flex-direction: column; }
    .stats-summary { grid-template-columns: repeat(2, 1fr); }
}
</style>
