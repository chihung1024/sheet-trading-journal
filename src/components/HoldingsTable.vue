<template>
  <div class="card">
    <div class="card-header">
        <div class="header-left">
            <h3>持倉明細</h3>
            <div class="summary-info">
                <span class="desktop-only">市值總計: </span><strong>{{ formatNumber(totalMarketValue) }}</strong> TWD
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
            
            <div class="filter-group desktop-only">
                <label class="filter-label">顯示:</label>
                <select v-model="filterStatus" class="filter-select">
                    <option value="all">全部</option>
                    <option value="profit">獲利</option>
                    <option value="loss">虧損</option>
                </select>
            </div>
        </div>
    </div>
    
    <div class="mobile-list" ref="mobileContainer">
        <div v-if="filteredHoldings.length === 0" class="empty-state">目前無持倉數據</div>
        <div 
            v-for="h in visibleHoldings" 
            :key="h.symbol" 
            class="mobile-holding-card"
            :class="{ 'profit': h.pnl_twd >= 0, 'loss': h.pnl_twd < 0 }"
        >
            <div class="card-header-row">
                <div class="symbol-box">
                    <span class="symbol-text">{{ h.symbol }}</span>
                    <span class="qty-text">{{ formatNumber(h.qty, 2) }} 股</span>
                </div>
                <div class="mkt-val-box">
                    <div class="label">市值 (TWD)</div>
                    <div class="val">{{ formatNumber(h.market_value_twd, 0) }}</div>
                </div>
            </div>
            <div class="card-data-grid">
                <div class="data-item">
                    <div class="label">當日損益</div>
                    <div :class="getTrendClass(h.daily_pl_twd)">
                        {{ h.daily_pl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_pl_twd, 0) }}
                    </div>
                </div>
                <div class="data-item text-right">
                    <div class="label">總損益 / 報酬率</div>
                    <div :class="getTrendClass(h.pnl_twd)">
                        {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
                        <span class="roi-small" :class="getTrendClass(h.pnl_percent, true)">
                            {{ h.pnl_percent >= 0 ? '+' : '' }}{{ safeNum(h.pnl_percent) }}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="table-container desktop-only" ref="tableContainer">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('symbol')" class="sortable">代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span></th>
                    <th @click="sortBy('qty')" class="text-right sortable">股數 <span class="sort-icon">{{ getSortIcon('qty') }}</span></th>
                    <th @click="sortBy('avg_cost_usd')" class="text-right sortable">成本 (USD) <span class="sort-icon">{{ getSortIcon('avg_cost_usd') }}</span></th>
                    <th @click="sortBy('current_price_origin')" class="text-right sortable">現價 / 變動 <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span></th>
                    <th @click="sortBy('market_value_twd')" class="text-right sortable">市值 (TWD) <span class="sort-icon">{{ getSortIcon('market_value_twd') }}</span></th>
                    <th @click="sortBy('daily_pl_twd')" class="text-right sortable">當日損益 <span class="sort-icon">{{ getSortIcon('daily_pl_twd') }}</span></th>
                    <th @click="sortBy('pnl_twd')" class="text-right sortable">總損益 <span class="sort-icon">{{ getSortIcon('pnl_twd') }}</span></th>
                    <th @click="sortBy('pnl_percent')" class="text-right sortable">報酬率 <span class="sort-icon">{{ getSortIcon('pnl_percent') }}</span></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="h in visibleHoldings" :key="h.symbol" class="row-item">
                    <td class="col-symbol"><span class="symbol-text">{{ h.symbol }}</span></td>
                    <td class="text-right font-num">{{ formatNumber(h.qty, 2) }}</td>
                    <td class="text-right font-num text-sub">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                    <td class="text-right font-num">
                        <div>{{ formatNumber(h.current_price_origin, 2) }}</div>
                        <div class="price-change" :class="getTrendClass(h.daily_change_usd)">
                            {{ h.daily_change_usd >= 0 ? '+' : '' }}{{ safeNum(h.daily_change_percent) }}%
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
const displayLimit = ref(50);

const safeNum = (val) => (val == null || isNaN(val)) ? '0.00' : Number(val).toFixed(2);
const formatNumber = (num, d=0) => (num == null || isNaN(num)) ? '-' : Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const totalMarketValue = computed(() => store.holdings.reduce((sum, h) => sum + (h.market_value_twd || 0), 0));

const sortBy = (key) => {
    if (sortKey.value === key) { sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'; } 
    else { sortKey.value = key; sortOrder.value = 'desc'; }
};

const getSortIcon = (key) => sortKey.value !== key ? '⇕' : (sortOrder.value === 'asc' ? '↑' : '↓');

const filteredHoldings = computed(() => {
    let result = store.holdings;
    if (searchQuery.value) result = result.filter(h => h.symbol.toLowerCase().includes(searchQuery.value.toLowerCase()));
    if (filterStatus.value === 'profit') result = result.filter(h => h.pnl_twd > 0);
    else if (filterStatus.value === 'loss') result = result.filter(h => h.pnl_twd < 0);
    return [...result].sort((a, b) => {
        let valA = a[sortKey.value], valB = b[sortKey.value];
        if (typeof valA === 'string') return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortOrder.value === 'asc' ? (Number(valA)||0) - (Number(valB)||0) : (Number(valB)||0) - (Number(valA)||0);
    });
});

const visibleHoldings = computed(() => filteredHoldings.value.slice(0, displayLimit.value));

const getTrendClass = (val, isBg = false) => {
    const num = Number(val) || 0;
    if (num >= 0) return isBg ? 'bg-green' : 'text-green';
    return isBg ? 'bg-red' : 'text-red';
};

const handleScroll = () => {
    const target = tableContainer.value || document.documentElement;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
        if (displayLimit.value < filteredHoldings.value.length) displayLimit.value += 20;
    }
};

onMounted(() => { window.addEventListener('scroll', handleScroll, true); });
onUnmounted(() => { window.removeEventListener('scroll', handleScroll, true); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); gap: 16px; }
.summary-info { font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; background: var(--bg-secondary); padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); }
.header-controls { display: flex; gap: 12px; align-items: center; }
.search-box { position: relative; min-width: 180px; }
.search-input { width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.9rem; background: var(--bg-secondary); color: var(--text-main); }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); opacity: 0.5; }
.filter-select { padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); font-size: 0.9rem; }

/* 桌面表格 */
.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 12px; font-size: 0.8rem; color: var(--text-sub); border-bottom: 2px solid var(--border-color); cursor: pointer; white-space: nowrap; }
td { padding: 14px 12px; border-bottom: 1px solid var(--border-color); }
.symbol-text { font-weight: 700; color: var(--primary); background: var(--bg-secondary); padding: 4px 8px; border-radius: 6px; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.text-right { text-align: right; }
.text-green { color: var(--success); font-weight: 600; }
.text-red { color: var(--danger); font-weight: 600; }
.roi-badge { padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; }
.bg-green { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.bg-red { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

/* ✅ 手機版列表樣式 */
.mobile-list { display: none; }

@media (max-width: 768px) {
    .desktop-only { display: none; }
    .mobile-list { display: block; }
    .card-header { flex-direction: column; align-items: stretch; }
    .search-box { min-width: unset; }
    
    .mobile-holding-card {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        border-left: 5px solid var(--border-color);
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .mobile-holding-card.profit { border-left-color: var(--success); }
    .mobile-holding-card.loss { border-left-color: var(--danger); }
    
    .card-header-row { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .symbol-box { display: flex; flex-direction: column; gap: 4px; }
    .symbol-text { font-size: 1.1rem; padding: 2px 6px; }
    .qty-text { font-size: 0.8rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
    
    .mkt-val-box .val { font-size: 1.1rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; text-align: right; }
    .mkt-val-box .label { font-size: 0.7rem; color: var(--text-sub); text-align: right; }
    
    .card-data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); }
    .data-item .label { font-size: 0.7rem; color: var(--text-sub); margin-bottom: 2px; }
    .roi-small { font-size: 0.75rem; padding: 1px 4px; border-radius: 4px; margin-left: 4px; }
}

.scroll-hint { text-align: center; padding: 12px; font-size: 0.8rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.empty-state { text-align: center; padding: 40px; color: var(--text-sub); }
</style>
