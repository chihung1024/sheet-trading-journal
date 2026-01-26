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
                <select v-model="filterStatus" class="filter-select">
                    <option value="all">全部持倉</option>
                    <option value="profit">獲利中 (Profit)</option>
                    <option value="loss">虧損中 (Loss)</option>
                </select>
            </div>
        </div>
    </div>
    
    <div class="table-container desktop-view" ref="tableContainer">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('symbol')" class="sortable sticky-col left-sticky">
                        代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('qty')" class="text-right sortable">
                        股數 <span class="sort-icon">{{ getSortIcon('qty') }}</span>
                    </th>
                    <th @click="sortBy('avg_cost_usd')" class="text-right sortable">
                        成本 (USD) <span class="sort-icon">{{ getSortIcon('avg_cost_usd') }}</span>
                    </th>
                    <th @click="sortBy('current_price_origin')" class="text-right sortable">
                        現價 / 變動 <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span>
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
                    <td class="col-symbol sticky-col left-sticky">
                        <div class="symbol-wrapper">
                            <span class="symbol-text">{{ h.symbol }}</span>
                            <span class="symbol-badge fire" v-if="h.pnl_percent > 30">🔥</span>
                        </div>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(h.qty, 2) }}</td>
                    <td class="text-right font-num text-sub">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                    <td class="text-right font-num">
                        <div>{{ formatNumber(h.current_price_origin, 2) }}</div>
                        <div class="price-change text-xs" :class="getTrendClass(h.daily_change_usd)">
                            {{ h.daily_change_usd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_change_usd, 2) }}
                        </div>
                    </td>
                    <td class="text-right font-num font-bold">{{ formatNumber(h.market_value_twd, 0) }}</td>
                    <td class="text-right font-num" :class="getTrendClass(h.daily_pl_twd)">
                        {{ h.daily_pl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_pl_twd, 0) }}
                    </td>
                    <td class="text-right font-num" :class="getTrendClass(h.pnl_twd)">
                        {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
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

    <div class="mobile-view">
         <div v-if="filteredHoldings.length === 0" class="empty-state">
            <div class="empty-icon">📊</div>
            <div>目前無持倉數據</div>
        </div>
        
        <div v-for="h in visibleHoldings" :key="`mob-${h.symbol}`" class="holding-card" @click="highlightRow(h.symbol)">
            <div class="card-top">
                <div class="symbol-section">
                    <span class="symbol-text">{{ h.symbol }}</span>
                    <span class="qty-badge">{{ formatNumber(h.qty, 0) }} 股</span>
                </div>
                <div class="price-section">
                    <div class="current-price">{{ formatNumber(h.current_price_origin, 2) }} USD</div>
                    <div class="roi-badge-sm" :class="getTrendClass(h.pnl_percent, true)">
                         {{ h.pnl_percent >= 0 ? '+' : '' }}{{ safeNum(h.pnl_percent) }}%
                    </div>
                </div>
            </div>
            
            <div class="card-divider"></div>
            
            <div class="card-grid">
                <div class="grid-item">
                    <span class="label">市值 (TWD)</span>
                    <span class="value font-bold">{{ formatNumber(h.market_value_twd, 0) }}</span>
                </div>
                <div class="grid-item text-right">
                    <span class="label">總損益</span>
                    <span class="value font-bold" :class="getTrendClass(h.pnl_twd)">
                        {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
                    </span>
                </div>
                <div class="grid-item">
                    <span class="label">成本均價</span>
                    <span class="value text-sub">{{ formatNumber(h.avg_cost_usd, 2) }}</span>
                </div>
                <div class="grid-item text-right">
                    <span class="label">當日損益</span>
                    <span class="value" :class="getTrendClass(h.daily_pl_twd)">
                        {{ h.daily_pl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_pl_twd, 0) }}
                    </span>
                </div>
            </div>
        </div>
    </div>
    
    <div class="scroll-hint" v-if="filteredHoldings.length > displayLimit">
        顯示 {{ visibleHoldings.length }} / {{ filteredHoldings.length }} 筆
        <button class="btn-load-more mobile-only" @click="loadMore">載入更多</button>
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
const displayLimit = ref(20); // 預設顯示數量

const safeNum = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return Number(val).toFixed(2);
};

const formatNumber = (num, d=0) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const totalMarketValue = computed(() => {
    return store.holdings.reduce((sum, h) => sum + (h.market_value_twd || 0), 0);
});

// 資料過濾與排序
const filteredHoldings = computed(() => {
    let result = store.holdings;
    
    // 搜尋
    if (searchQuery.value) {
        result = result.filter(h => 
            h.symbol.toLowerCase().includes(searchQuery.value.toLowerCase())
        );
    }
    
    // 狀態過濾
    if (filterStatus.value === 'profit') {
        result = result.filter(h => (h.pnl_twd || 0) > 0);
    } else if (filterStatus.value === 'loss') {
        result = result.filter(h => (h.pnl_twd || 0) < 0);
    }
    
    // 排序
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

// 分頁/顯示限制
const visibleHoldings = computed(() => {
    if (filteredHoldings.value.length <= displayLimit.value) {
        return filteredHoldings.value;
    }
    return filteredHoldings.value.slice(0, displayLimit.value);
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

const loadMore = () => {
    displayLimit.value += 20;
};

const handleScroll = () => {
    // 桌面版表格無限捲動
    if (tableContainer.value) {
        const { scrollTop, scrollHeight, clientHeight } = tableContainer.value;
        if (scrollHeight - scrollTop - clientHeight < 100 && displayLimit.value < filteredHoldings.value.length) {
            displayLimit.value = Math.min(displayLimit.value + 20, filteredHoldings.value.length);
        }
    }
};

onMounted(() => {
    if (tableContainer.value) {
        tableContainer.value.addEventListener('scroll', handleScroll);
    }
    
    // 手機版全域捲動監聽
    window.addEventListener('scroll', () => {
        if(window.innerWidth <= 768) {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
                 if(displayLimit.value < filteredHoldings.value.length) {
                     displayLimit.value += 10;
                 }
            }
        }
    });
});

onUnmounted(() => {
    if (tableContainer.value) {
        tableContainer.value.removeEventListener('scroll', handleScroll);
    }
    // 移除 window scroll listener (建議實作 debounce，此處簡化)
});
</script>

<style scoped>
.card-header { 
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap; gap: 16px;
}
.header-left { display: flex; flex-direction: column; gap: 8px; }
.header-controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.search-box { position: relative; min-width: 200px; }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-sub); }
.search-input { width: 100%; padding: 8px 12px 8px 36px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--bg-secondary); color: var(--text-main); }
.search-input:focus { outline: none; border-color: var(--primary); background: var(--bg-card); }

.filter-select {
    padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; 
    background: var(--bg-secondary); color: var(--text-main); font-size: 0.95rem; cursor: pointer;
}

.summary-info { 
    font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; 
    background: var(--bg-secondary); padding: 6px 12px; border-radius: 6px; 
    color: var(--text-main); border: 1px solid var(--border-color);
}

/* Table View (Desktop) */
.table-container { overflow-x: auto; max-height: 600px; overflow-y: auto; border-radius: 8px; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { position: sticky; top: 0; z-index: 10; padding: 12px 16px; background: var(--bg-secondary); border-bottom: 2px solid var(--border-color); white-space: nowrap; font-size: 0.85rem; color: var(--text-sub); cursor: pointer; }
th.sticky-col { z-index: 11; } 
td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
td.sticky-col { z-index: 9; }

/* Sticky Left Column */
.left-sticky { position: sticky; left: 0; background: var(--bg-card); border-right: 1px solid var(--border-color); }
th.left-sticky { background: var(--bg-secondary); }
tr:hover td { background-color: var(--bg-secondary); }
tr:hover td.left-sticky { background-color: var(--bg-secondary); }

.symbol-wrapper { display: flex; align-items: center; gap: 6px; }
.symbol-text { font-weight: 700; color: var(--primary); background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px; font-size: 0.95rem; }
.symbol-badge.fire { font-size: 0.9rem; animation: pulse 1.5s infinite; }

.price-change { font-size: 0.8rem; margin-top: 2px; }

.roi-badge { display: inline-block; min-width: 70px; text-align: center; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.9rem; }
.roi-badge.bg-green { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.roi-badge.bg-red { background: rgba(239, 68, 68, 0.15); color: var(--danger); }

.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-sub { color: var(--text-sub); }
.font-bold { font-weight: 700; }
.text-xs { font-size: 0.8rem; }

/* Mobile Card View */
.mobile-view { display: none; }
.holding-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow-sm); transition: transform 0.2s; }
.holding-card:active { transform: scale(0.98); }

.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.symbol-section { display: flex; align-items: center; gap: 8px; }
.qty-badge { font-size: 0.85rem; color: var(--text-sub); background: var(--bg-secondary); padding: 2px 8px; border-radius: 99px; }
.price-section { text-align: right; }
.current-price { font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 1rem; color: var(--text-main); }
.roi-badge-sm { font-size: 0.85rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 2px; }

.card-divider { height: 1px; background: var(--border-color); margin-bottom: 12px; opacity: 0.5; }

.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
.grid-item { display: flex; flex-direction: column; gap: 2px; }
.grid-item .label { font-size: 0.8rem; color: var(--text-sub); }
.grid-item .value { font-family: 'JetBrains Mono', monospace; font-size: 1rem; }

.empty-state { text-align: center; padding: 40px; color: var(--text-sub); }
.empty-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; }
.scroll-hint { text-align: center; padding: 16px 0; color: var(--text-sub); font-size: 0.85rem; display: flex; flex-direction: column; align-items: center; gap: 8px; }

.btn-load-more { padding: 8px 24px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 99px; color: var(--text-main); font-size: 0.9rem; cursor: pointer; }

/* Utilities */
.mobile-only { display: none; }

@media (max-width: 768px) {
    .desktop-view { display: none; }
    .mobile-view { display: block; }
    .mobile-only { display: block; }
    
    .header-controls { flex-direction: column; width: 100%; align-items: stretch; }
    .search-box, .filter-select { width: 100%; }
    .card-header { gap: 12px; flex-direction: column; align-items: stretch; }
}
</style>
