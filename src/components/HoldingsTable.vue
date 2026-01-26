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
                    <option value="profit">獲利中</option>
                    <option value="loss">虧損中</option>
                </select>
            </div>
        </div>
    </div>
    
    <div class="table-container desktop-view" ref="tableContainer">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('symbol')" class="sortable sticky-th">
                        代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('qty')" class="text-right sortable sticky-th">
                        股數 <span class="sort-icon">{{ getSortIcon('qty') }}</span>
                    </th>
                    <th @click="sortBy('avg_cost_usd')" class="text-right sortable sticky-th">
                        成本(USD) <span class="sort-icon">{{ getSortIcon('avg_cost_usd') }}</span>
                    </th>
                    <th @click="sortBy('current_price_origin')" class="text-right sortable sticky-th">
                        現價/漲跌 <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span>
                    </th>
                    <th @click="sortBy('market_value_twd')" class="text-right sortable sticky-th">
                        市值(TWD) <span class="sort-icon">{{ getSortIcon('market_value_twd') }}</span>
                    </th>
                    <th @click="sortBy('daily_pl_twd')" class="text-right sortable sticky-th">
                        當日損益 <span class="sort-icon">{{ getSortIcon('daily_pl_twd') }}</span>
                    </th>
                    <th @click="sortBy('pnl_twd')" class="text-right sortable sticky-th">
                        總損益 <span class="sort-icon">{{ getSortIcon('pnl_twd') }}</span>
                    </th>
                    <th @click="sortBy('pnl_percent')" class="text-right sortable sticky-th">
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
        
        <div 
            v-for="h in visibleHoldings" 
            :key="h.symbol + '_mob'" 
            class="mobile-card"
            @click="highlightRow(h.symbol)"
        >
            <div class="m-card-header">
                <div class="m-symbol-group">
                    <span class="m-symbol">{{ h.symbol }}</span>
                    <span class="m-fire" v-if="h.pnl_percent > 50">🔥</span>
                </div>
                <div class="m-price-group">
                    <span class="m-price">{{ formatNumber(h.current_price_origin, 2) }}</span>
                    <span class="m-change" :class="getTrendClass(h.daily_change_usd)">
                         {{ h.daily_change_percent >= 0 ? '+' : '' }}{{ safeNum(h.daily_change_percent) }}%
                    </span>
                </div>
            </div>

            <div class="m-card-grid">
                <div class="m-grid-item">
                    <span class="m-label">持有股數</span>
                    <span class="m-val">{{ formatNumber(h.qty, 2) }}</span>
                </div>
                <div class="m-grid-item text-right">
                    <span class="m-label">平均成本</span>
                    <span class="m-val">{{ formatNumber(h.avg_cost_usd, 2) }}</span>
                </div>
                <div class="m-grid-item">
                    <span class="m-label">台幣市值</span>
                    <span class="m-val font-bold">{{ formatNumber(h.market_value_twd, 0) }}</span>
                </div>
                <div class="m-grid-item text-right">
                    <span class="m-label">總報酬率</span>
                    <span class="m-badge-sm" :class="getTrendClass(h.pnl_percent, true)">
                        {{ h.pnl_percent >= 0 ? '+' : '' }}{{ safeNum(h.pnl_percent) }}%
                    </span>
                </div>
            </div>

            <div class="m-card-footer">
                <div class="m-footer-item">
                    <span class="m-footer-label">當日</span>
                    <span class="m-footer-val" :class="getTrendClass(h.daily_pl_twd)">
                        {{ h.daily_pl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_pl_twd, 0) }}
                    </span>
                </div>
                <div class="m-divider"></div>
                <div class="m-footer-item right">
                    <span class="m-footer-label">總損益</span>
                    <span class="m-footer-val" :class="getTrendClass(h.pnl_twd)">
                        {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
                    </span>
                </div>
            </div>
        </div>
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

// 使用 store 計算好的數據
const filteredHoldings = computed(() => {
    let result = store.holdings;
    
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

const handleScroll = () => {
    // 檢測桌面版表格捲動
    if (tableContainer.value) {
        const { scrollTop: top, scrollHeight, clientHeight } = tableContainer.value;
        if (scrollHeight - top - clientHeight < 100 && displayLimit.value < filteredHoldings.value.length) {
            displayLimit.value = Math.min(displayLimit.value + 20, filteredHoldings.value.length);
        }
    }
    // 注意：手機版使用 Window 捲動檢測通常在 App.vue 或更高層處理，這裡簡化處理
    if (window.innerWidth < 768 && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
         if (displayLimit.value < filteredHoldings.value.length) {
            displayLimit.value = Math.min(displayLimit.value + 20, filteredHoldings.value.length);
         }
    }
};

onMounted(() => {
    if (tableContainer.value) {
        tableContainer.value.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
    if (tableContainer.value) {
        tableContainer.value.removeEventListener('scroll', handleScroll);
    }
    window.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped>
/* 共用樣式 */
.card-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-end;
    margin-bottom: 16px; 
    padding-bottom: 16px; 
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    gap: 16px;
}
.header-left { display: flex; flex-direction: column; gap: 8px; }
.header-controls { display: flex; gap: 12px; align-items: center; }

h3 { margin: 0; font-size: 1.125rem; }

.summary-info { 
    font-family: 'JetBrains Mono', monospace; 
    font-size: 0.95rem; 
    background: var(--bg-secondary); 
    padding: 6px 12px; 
    border-radius: 6px; 
    color: var(--text-main);
    border: 1px solid var(--border-color);
    display: inline-block;
}

.search-box { position: relative; width: 220px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-sub); pointer-events: none; }
.search-input { width: 100%; padding: 8px 10px 8px 32px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--bg-secondary); color: var(--text-main); }
.search-input:focus { outline: none; border-color: var(--primary); background: var(--bg-card); }

.filter-select { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-main); font-size: 0.95rem; cursor: pointer; }

/* 桌面版表格 (Desktop Table) */
.table-container { overflow-x: auto; max-height: 600px; overflow-y: auto; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { text-align: left; padding: 12px 16px; border-bottom: 2px solid var(--border-color); color: var(--text-sub); font-size: 0.85rem; font-weight: 600; background: var(--bg-card); z-index: 10; white-space: nowrap; }
.sticky-th { position: sticky; top: 0; } /* 固定表頭 */
td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-size: 0.95rem; }
.row-item { transition: background 0.2s; cursor: pointer; }
.row-item:hover { background-color: var(--bg-secondary); }

.symbol-text { font-weight: 700; color: var(--primary); font-family: 'JetBrains Mono', monospace; }
.symbol-badge { margin-left: 6px; font-size: 0.8rem; }
.price-change { font-size: 0.85rem; margin-top: 2px; }

/* 數字格式 */
.text-right { text-align: right; }
.text-sub { color: var(--text-sub); }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.bg-green { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
.bg-red { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }

.roi-badge { padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; display: inline-block; min-width: 68px; text-align: center; }

/* 手機版視圖 (Mobile View) - 預設隱藏 */
.mobile-view { display: none; }

/* Mobile Card Styling */
.mobile-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    transition: transform 0.2s;
}
.mobile-card:active { transform: scale(0.98); background: var(--bg-secondary); }

.m-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); }
.m-symbol { font-size: 1.2rem; font-weight: 700; color: var(--primary); font-family: 'JetBrains Mono', monospace; }
.m-price-group { text-align: right; }
.m-price { display: block; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; }
.m-change { font-size: 0.85rem; font-weight: 500; }

.m-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.m-grid-item { display: flex; flex-direction: column; }
.m-label { font-size: 0.75rem; color: var(--text-sub); margin-bottom: 2px; }
.m-val { font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; color: var(--text-main); }
.m-badge-sm { font-size: 0.85rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-block; }

.m-card-footer { background: var(--bg-secondary); margin: 0 -16px -16px -16px; padding: 10px 16px; border-radius: 0 0 12px 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); }
.m-footer-item { display: flex; align-items: baseline; gap: 6px; }
.m-footer-item.right { flex-direction: row-reverse; }
.m-footer-label { font-size: 0.8rem; color: var(--text-sub); }
.m-footer-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 1rem; }
.m-divider { width: 1px; height: 16px; background: var(--border-color); }

.scroll-hint { text-align: center; padding: 12px; font-size: 0.9rem; color: var(--text-sub); }
.empty-state { text-align: center; padding: 40px; color: var(--text-sub); }
.empty-icon { font-size: 2.5rem; margin-bottom: 8px; opacity: 0.5; }

/* RWD Media Queries */
@media (max-width: 768px) {
    .desktop-view { display: none; } /* 隱藏桌面表格 */
    .mobile-view { display: block; } /* 顯示手機卡片 */
    
    .card-header { flex-direction: column; align-items: stretch; gap: 12px; }
    .header-left { flex-direction: row; justify-content: space-between; align-items: center; }
    .summary-info { font-size: 0.85rem; padding: 4px 8px; margin: 0; }
    .header-controls { flex-direction: column; width: 100%; }
    .search-box { width: 100%; }
    .filter-select { width: 100%; }
}
</style>
