<template>
  <div class="card">
    <div class="card-header">
        <div class="header-left">
            <h3>持倉明細</h3>
            <div class="summary-info">
                市值總計: <strong>{{ formatNumber(totalMarketValue) }}</strong> TWD
            </div>
        </div>
        
        <div class="header-controls">
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="搜尋股票代碼..."
                    class="search-input"
                >
            </div>
            
            <div class="filter-group">
                <label class="filter-label">顯示:</label>
                <select v-model="filterStatus" class="filter-select">
                    <option value="all">全部持倉</option>
                    <option value="profit">獲利</option>
                    <option value="loss">虧損</option>
                </select>
            </div>
        </div>
    </div>
    
    <div class="table-container" ref="tableContainer">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('symbol')" class="sortable">
                        代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('qty')" class="text-right sortable">
                        股數 <span class="sort-icon">{{ getSortIcon('qty') }}</span>
                    </th>
                    <th @click="sortBy('avg_cost_usd')" class="text-right sortable">
                        成本 (USD) <span class="sort-icon">{{ getSortIcon('avg_cost_usd') }}</span>
                    </th>
                    <th @click="sortBy('current_price_origin')" class="text-right sortable">
                        現價 / 當日變動 <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span>
                    </th>
                    <th @click="sortBy('market_value_twd')" class="text-right sortable">
                        市值 (TWD) <span class="sort-icon">{{ getSortIcon('market_value_twd') }}</span>
                    </th>
                    <th @click="sortBy('daily_pl_twd')" class="text-right sortable">
                        當日損益 <span class="sort-icon">{{ getSortIcon('daily_pl_twd') }}</span>
                    </th>
                    <th @click="sortBy('pnl_twd')" class="text-right sortable">
                        總損益 <span class="sort-icon">{{ getSortIcon('pnl_twd') }}</span>
                    </th>
                    <th @click="sortBy('pnl_percent')" class="text-right sortable">
                        報酬率 <span class="sort-icon">{{ getSortIcon('pnl_percent') }}</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                 <tr v-if="filteredHoldings.length === 0">
                    <td colspan="8" class="empty-state">
                        <div class="empty-icon">📊</div>
                        <div>目前無持倉數據</div>
                    </td>
                </tr>
                <tr 
                    v-for="h in visibleHoldings" 
                    :key="h.symbol" 
                    class="row-item"
                    @click="highlightRow(h.symbol)"
                    :class="{ 'highlighted': highlightedSymbol === h.symbol }"
                >
                    <td class="col-symbol">
                        <div class="symbol-wrapper">
                            <span class="symbol-text">{{ h.symbol }}</span>
                            <span class="symbol-badge" v-if="h.pnl_percent > 50">🔥</span>
                        </div>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(h.qty, 2) }}</td>
                    <td class="text-right font-num text-sub">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                    <td class="text-right font-num">
                        <div>{{ formatNumber(h.current_price_origin, 2) }}</div>
                        <div class="price-change" :class="getTrendClass(h.daily_change_usd)">
                            {{ h.daily_change_usd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_change_usd, 2) }}
                            ({{ h.daily_change_percent >= 0 ? '+' : '' }}{{ safeNum(h.daily_change_percent) }}%)
                        </div>
                    </td>
                    <td class="text-right font-num font-bold">{{ formatNumber(h.market_value_twd, 0) }}</td>
                    <td class="text-right font-num" :class="getTrendClass(h.daily_pl_twd)">
                        <div class="daily-pnl-wrapper">
                            <span class="pnl-value">
                                {{ h.daily_pl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_pl_twd, 0) }}
                            </span>
                        </div>
                    </td>
                    <td class="text-right font-num" :class="getTrendClass(h.pnl_twd)">
                        <span class="pnl-value">
                            {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
                        </span>
                    </td>
                    <td class="text-right font-num">
                        <span class="roi-badge" :class="getTrendClass(h.pnl_percent, true)">
                            {{ h.pnl_percent >= 0 ? '+' : '' }}{{ safeNum(h.pnl_percent) }}%
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    
    <div class="scroll-hint" v-if="filteredHoldings.length > displayLimit">
        顯示 {{ visibleHoldings.length }} / {{ filteredHoldings.length }} 筆
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const tableContainer = ref(null);
const sortKey = ref('market_value_twd'); 
const sortOrder = ref('desc');
const searchQuery = ref('');
const filterStatus = ref('all');
const highlightedSymbol = ref(null);

const displayLimit = ref(50);
const scrollTop = ref(0);

const safeNum = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return Number(val).toFixed(2);
};

const formatNumber = (num, d=0) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// ✅ 修改：使用 currentSnapshot.holdings 支援群組切換
const holdings = computed(() => store.currentSnapshot.holdings || []);

const totalMarketValue = computed(() => {
    return holdings.value.reduce((sum, h) => sum + (h.market_value_twd || 0), 0);
});

const sortBy = (key) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'desc';
    }
};

const getSortIcon = (key) => {
    if (sortKey.value !== key) return '⇕';
    return sortOrder.value === 'asc' ? '↑' : '↓';
};

const filteredHoldings = computed(() => {
    let result = holdings.value;  // ✅ 使用當前群組的持倉
    
    if (searchQuery.value) {
        result = result.filter(h => 
            h.symbol.toLowerCase().includes(searchQuery.value.toLowerCase())
        );
    }
    
    if (filterStatus.value === 'profit') {
        result = result.filter(h => (h.pnl_twd || 0) > 0);
    } else if (filterStatus.value === 'loss') {
        result = result.filter(h => (h.pnl_twd || 0) < 0);
    }
    
    return [...result].sort((a, b) => {
        let valA = a[sortKey.value];
        let valB = b[sortKey.value];
        if (typeof valA === 'string') {
            return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
});

const visibleHoldings = computed(() => {
    if (filteredHoldings.value.length <= displayLimit.value) {
        return filteredHoldings.value;
    }
    return filteredHoldings.value.slice(0, displayLimit.value);
});

const getTrendClass = (val, isBg = false) => {
    const num = Number(val) || 0;
    if (num >= 0) return isBg ? 'bg-green' : 'text-green';
    return isBg ? 'bg-red' : 'text-red';
};

const highlightRow = (symbol) => {
    highlightedSymbol.value = symbol;
    setTimeout(() => {
        highlightedSymbol.value = null;
    }, 2000);
};

const handleScroll = () => {
    if (!tableContainer.value) return;
    const { scrollTop: top, scrollHeight, clientHeight } = tableContainer.value;
    
    if (scrollHeight - top - clientHeight < 100 && displayLimit.value < filteredHoldings.value.length) {
        displayLimit.value = Math.min(displayLimit.value + 20, filteredHoldings.value.length);
    }
};

onMounted(() => {
    if (tableContainer.value) {
        tableContainer.value.addEventListener('scroll', handleScroll);
    }
});

onUnmounted(() => {
    if (tableContainer.value) {
        tableContainer.value.removeEventListener('scroll', handleScroll);
    }
});
</script>

<style scoped>
.card-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start;
    margin-bottom: 24px; 
    padding-bottom: 16px; 
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    gap: 16px;
}

.header-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.header-controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

.search-box {
    position: relative;
    min-width: 200px;
}

.search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-sub);
    pointer-events: none;
}

.search-input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--bg-secondary);
    color: var(--text-main);
    transition: all 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--bg-card);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.filter-label {
    font-size: 0.95rem;
    color: var(--text-sub);
    font-weight: 600;
}

.filter-select {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-main);
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.filter-select:hover {
    border-color: var(--primary);
}

.filter-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.summary-info { 
    font-family: 'JetBrains Mono', monospace; 
    font-size: 1rem; 
    background: var(--bg-secondary); 
    padding: 8px 14px; 
    border-radius: 8px; 
    color: var(--text-main);
    border: 1px solid var(--border-color);
}

.table-container { 
    overflow-x: auto; 
    max-height: 600px;
    overflow-y: auto;
}

.table-container::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.table-container::-webkit-scrollbar-track {
    background: var(--bg-secondary);
    border-radius: 4px;
}

.table-container::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
}

.table-container::-webkit-scrollbar-thumb:hover {
    background: var(--text-sub);
}

.sort-icon { 
    font-size: 0.85rem; 
    margin-left: 4px; 
    opacity: 0.5; 
    transition: opacity 0.2s;
}

th.sortable { 
    cursor: pointer; 
    transition: all 0.2s;
    user-select: none;
}

th.sortable:hover { 
    color: var(--primary); 
    background: var(--bg-card);
}

th.sortable:hover .sort-icon {
    opacity: 1;
}

.row-item {
    transition: all 0.2s ease;
    cursor: pointer;
}

.row-item:hover {
    background-color: var(--bg-secondary) !important;
    transform: scale(1.01);
}

.row-item.highlighted {
    background: rgba(59, 130, 246, 0.1);
    animation: pulse-highlight 0.5s ease;
}

@keyframes pulse-highlight {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
}

.col-symbol { 
    width: 120px; 
}

.symbol-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
}

.symbol-text { 
    font-weight: 700; 
    font-size: 1.05rem; 
    background: var(--bg-secondary); 
    color: var(--primary); 
    padding: 6px 12px; 
    border-radius: 8px; 
    display: inline-block;
    transition: all 0.2s ease;
}

.row-item:hover .symbol-text {
    background: var(--primary);
    color: white;
    transform: translateX(4px);
}

.symbol-badge {
    font-size: 1rem;
    animation: bounce 1s ease infinite;
}

@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
}

.price-change {
    font-size: 0.85rem;
    margin-top: 4px;
    font-weight: 600;
}

.daily-pnl-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.text-right { text-align: right; }
.text-sub { color: var(--text-sub); font-size: 0.95rem; }
.font-num { font-family: 'JetBrains Mono', monospace; letter-spacing: -0.02em; }
.font-bold { font-weight: 700; }

.pnl-value {
    display: inline-block;
    transition: all 0.2s ease;
}

.row-item:hover .pnl-value {
    transform: scale(1.1);
    font-weight: 700;
}

.text-green { 
    color: var(--success);
    font-weight: 600;
}

.text-red { 
    color: var(--danger);
    font-weight: 600;
}

.roi-badge { 
    display: inline-block; 
    min-width: 72px; 
    text-align: center; 
    padding: 6px 10px; 
    border-radius: 8px; 
    font-weight: 600; 
    font-size: 0.95rem;
    transition: all 0.2s ease;
}

.row-item:hover .roi-badge {
    transform: scale(1.05);
}

.roi-badge.bg-green { 
    background: rgba(16, 185, 129, 0.15); 
    color: var(--success);
    border: 1px solid var(--success);
}

.roi-badge.bg-red { 
    background: rgba(239, 68, 68, 0.15); 
    color: var(--danger);
    border: 1px solid var(--danger);
}

.empty-state { 
    text-align: center; 
    padding: 80px 20px; 
    color: var(--text-sub);
}

.empty-icon {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.5;
}

.scroll-hint {
    text-align: center;
    padding: 12px;
    font-size: 0.95rem;
    color: var(--text-sub);
    background: var(--bg-secondary);
    border-radius: 0 0 var(--radius) var(--radius);
    font-family: 'JetBrains Mono', monospace;
}

@media (max-width: 768px) {
    .card-header {
        flex-direction: column;
        align-items: stretch;
    }
    
    .header-controls {
        flex-direction: column;
        align-items: stretch;
    }
    
    .search-box,
    .filter-select {
        width: 100%;
    }
    
    .table-container {
        max-height: 400px;
    }
}
</style>