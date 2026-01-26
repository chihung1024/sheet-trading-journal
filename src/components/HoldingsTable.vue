<template>
  <div class="card holdings-card">
    <div class="card-header">
        <div class="header-left">
            <h3>💼 持倉明細</h3>
            <div class="summary-info">
                <span class="summary-label">市值總計:</span>
                <strong class="summary-value">{{ formatNumber(totalMarketValue) }}</strong>
                <span class="summary-unit">TWD</span>
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
                <button v-if="searchQuery" @click="searchQuery = ''" class="clear-btn">×</button>
            </div>
            
            <div class="filter-group">
                <label class="filter-label">篩選:</label>
                <select v-model="filterStatus" class="filter-select">
                    <option value="all">全部持倉</option>
                    <option value="profit">📈 獲利</option>
                    <option value="loss">📉 虧損</option>
                </select>
            </div>
        </div>
    </div>
    
    <!-- 🖥️ 桌面端表格模式 -->
    <div class="table-container desktop-table" ref="tableContainer">
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
                        <div class="empty-icon">📈</div>
                        <div class="empty-text">目前無持倉數據</div>
                        <div class="empty-hint">請新增交易紀錄</div>
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
                            <span class="symbol-badge" v-else-if="h.pnl_percent < -30">⚠️</span>
                        </div>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(h.qty, 2) }}</td>
                    <td class="text-right font-num text-sub">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                    <td class="text-right font-num">
                        <div class="price-main">{{ formatNumber(h.current_price_origin, 2) }}</div>
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
    
    <!-- 📱 手機端卡片模式 -->
    <div class="mobile-cards">
        <div v-if="filteredHoldings.length === 0" class="empty-state-mobile">
            <div class="empty-icon">📈</div>
            <div class="empty-text">目前無持倉數據</div>
            <div class="empty-hint">請新增交易紀錄</div>
        </div>
        
        <div 
            v-for="h in visibleHoldings" 
            :key="'mobile-' + h.symbol"
            class="holding-card"
            :class="{ 'profit-card': h.pnl_twd >= 0, 'loss-card': h.pnl_twd < 0 }"
            @click="toggleExpand(h.symbol)"
        >
            <div class="card-top">
                <div class="symbol-section">
                    <div class="symbol-main">
                        <span class="symbol-badge-mobile" :class="getTrendClass(h.pnl_percent, true)">
                            {{ h.symbol }}
                        </span>
                        <span v-if="h.pnl_percent > 50" class="fire-badge">🔥</span>
                        <span v-else-if="h.pnl_percent < -30" class="warn-badge">⚠️</span>
                    </div>
                    <div class="qty-info">
                        <span class="qty-label">持有:</span>
                        <span class="qty-value">{{ formatNumber(h.qty, 2) }}</span> 股
                    </div>
                </div>
                
                <div class="roi-section">
                    <div class="roi-value" :class="getTrendClass(h.pnl_percent)">
                        {{ h.pnl_percent >= 0 ? '+' : '' }}{{ safeNum(h.pnl_percent) }}%
                    </div>
                    <div class="roi-label">報酬率</div>
                </div>
            </div>
            
            <div class="card-middle">
                <div class="info-row">
                    <div class="info-item">
                        <div class="info-label">現價</div>
                        <div class="info-value price-value">
                            ${{ formatNumber(h.current_price_origin, 2) }}
                        </div>
                        <div class="price-change-mobile" :class="getTrendClass(h.daily_change_usd)">
                            {{ h.daily_change_usd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_change_usd, 2) }}
                            ({{ h.daily_change_percent >= 0 ? '+' : '' }}{{ safeNum(h.daily_change_percent) }}%)
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">市值</div>
                        <div class="info-value market-value">
                            {{ formatNumber(h.market_value_twd, 0) }}
                        </div>
                        <div class="info-unit">TWD</div>
                    </div>
                </div>
            </div>
            
            <div class="card-bottom" :class="{ 'expanded': expandedSymbol === h.symbol }">
                <div class="pnl-row">
                    <div class="pnl-item">
                        <span class="pnl-label">當日損益</span>
                        <span class="pnl-amount" :class="getTrendClass(h.daily_pl_twd)">
                            {{ h.daily_pl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.daily_pl_twd, 0) }}
                        </span>
                    </div>
                    <div class="pnl-item">
                        <span class="pnl-label">總損益</span>
                        <span class="pnl-amount" :class="getTrendClass(h.pnl_twd)">
                            {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
                        </span>
                    </div>
                </div>
                
                <div class="expand-details" v-if="expandedSymbol === h.symbol">
                    <div class="detail-row">
                        <span class="detail-label">平均成本</span>
                        <span class="detail-value">${{ formatNumber(h.avg_cost_usd, 2) }} USD</span>
                    </div>
                </div>
            </div>
            
            <div class="expand-hint">
                <span v-if="expandedSymbol !== h.symbol">點擊查看更多 ▼</span>
                <span v-else>收起 ▲</span>
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
const expandedSymbol = ref(null);
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

const toggleExpand = (symbol) => {
    expandedSymbol.value = expandedSymbol.value === symbol ? null : symbol;
};

const handleScroll = () => {
    if (!tableContainer.value) return;
    const { scrollTop: top, scrollHeight, clientHeight } = tableContainer.value;
    
    if (scrollHeight - top - clientHeight < 100 && displayLimit.value < filteredHoldings.value.length) {
        displayLimit.value = Math.min(displayLimit.value + 20, filteredHoldings.value.length);
    }
};

onMounted(() => {
    console.log(`[✅ HoldingsTable] 組件已掛載`);
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
.holdings-card {
    position: relative;
    overflow: visible;
}

.holdings-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.holdings-card:hover::before {
    opacity: 1;
}

.card-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start;
    margin-bottom: 24px; 
    padding-bottom: 20px; 
    border-bottom: 2px solid var(--border-color);
    flex-wrap: wrap;
    gap: 16px;
}

.header-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.header-left h3 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--text-main);
}

.summary-info { 
    font-family: 'JetBrains Mono', monospace; 
    font-size: 1rem; 
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.03));
    padding: 10px 16px; 
    border-radius: 10px; 
    color: var(--text-main);
    border: 1px solid rgba(59, 130, 246, 0.2);
    display: flex;
    align-items: baseline;
    gap: 8px;
}

.summary-label {
    font-size: 0.85rem;
    color: var(--text-sub);
    font-weight: 500;
}

.summary-value {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--primary);
}

.summary-unit {
    font-size: 0.85rem;
    color: var(--text-sub);
}

.header-controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

.search-box {
    position: relative;
    min-width: 220px;
}

.search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.1rem;
    pointer-events: none;
    z-index: 1;
}

.search-input {
    width: 100%;
    padding: 10px 40px 10px 42px;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    font-size: 0.95rem;
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

.clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--text-sub);
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    transition: all 0.2s ease;
}

.clear-btn:hover {
    background: var(--danger);
    transform: translateY(-50%) scale(1.1);
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
}

.filter-label {
    font-size: 0.95rem;
    color: var(--text-sub);
    font-weight: 700;
    white-space: nowrap;
}

.filter-select {
    padding: 10px 14px;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: var(--bg-secondary);
    color: var(--text-main);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.filter-select:hover {
    border-color: var(--primary);
    background: var(--bg-card);
}

.filter-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 🖥️ 桌面端表格 */
.desktop-table {
    display: block;
}

.mobile-cards {
    display: none;
}

.table-container { 
    overflow-x: auto; 
    max-height: 600px;
    overflow-y: auto;
    border-radius: 12px;
    border: 1px solid var(--border-light);
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
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
}

.row-item:hover {
    background-color: var(--bg-secondary) !important;
    transform: scale(1.005);
}

.row-item.highlighted {
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.04));
    animation: pulse-highlight 0.6s ease;
}

@keyframes pulse-highlight {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.01); }
}

.col-symbol { 
    width: 140px; 
}

.symbol-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
}

.symbol-text { 
    font-weight: 700; 
    font-size: 1.05rem; 
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.06));
    color: var(--primary); 
    padding: 8px 14px; 
    border-radius: 10px; 
    display: inline-block;
    border: 1px solid rgba(59, 130, 246, 0.2);
    transition: all 0.2s ease;
}

.row-item:hover .symbol-text {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: white;
    transform: translateX(4px);
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.symbol-badge {
    font-size: 1.1rem;
    animation: bounce 1.5s ease infinite;
}

@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
}

.price-main {
    font-weight: 600;
    margin-bottom: 4px;
}

.price-change {
    font-size: 0.85rem;
    font-weight: 600;
    opacity: 0.9;
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
    transform: scale(1.08);
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
    min-width: 76px; 
    text-align: center; 
    padding: 7px 12px; 
    border-radius: 10px; 
    font-weight: 700; 
    font-size: 0.95rem;
    transition: all 0.2s ease;
}

.row-item:hover .roi-badge {
    transform: scale(1.08);
}

.roi-badge.bg-green { 
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.08));
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.roi-badge.bg-red { 
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.08));
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.empty-state { 
    text-align: center; 
    padding: 80px 20px; 
    color: var(--text-sub);
}

.empty-icon {
    font-size: 4rem;
    margin-bottom: 16px;
    opacity: 0.3;
}

.empty-text {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 8px;
}

.empty-hint {
    font-size: 0.9rem;
    opacity: 0.7;
}

.scroll-hint {
    text-align: center;
    padding: 14px;
    font-size: 0.9rem;
    color: var(--text-sub);
    background: var(--bg-secondary);
    border-radius: 0 0 var(--radius) var(--radius);
    font-family: 'JetBrains Mono', monospace;
    margin-top: 12px;
    border: 1px solid var(--border-light);
}

/* ========================================
   📱 手機端卡片模式
   ======================================== */

@media (max-width: 1024px) {
    .desktop-table {
        display: none;
    }
    
    .mobile-cards {
        display: block;
    }
    
    .card-header {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
        padding-bottom: 16px;
    }
    
    .header-controls {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
    }
    
    .search-box,
    .filter-select {
        width: 100%;
        min-width: auto;
    }
    
    .summary-info {
        flex-wrap: wrap;
        justify-content: center;
    }
}

/* 📱 手機卡片樣式 */
.empty-state-mobile {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-sub);
}

.holding-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 18px;
    margin-bottom: 14px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.holding-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--primary);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.profit-card::before {
    background: linear-gradient(180deg, var(--success), var(--success-light));
}

.loss-card::before {
    background: linear-gradient(180deg, var(--danger), var(--danger-light));
}

.holding-card:active {
    transform: scale(0.98);
}

.holding-card:active::before {
    opacity: 1;
}

.card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border-light);
}

.symbol-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.symbol-main {
    display: flex;
    align-items: center;
    gap: 8px;
}

.symbol-badge-mobile {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.1rem;
    font-weight: 700;
    padding: 8px 14px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
}

.symbol-badge-mobile.bg-green {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.08));
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.symbol-badge-mobile.bg-red {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.08));
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.fire-badge,
.warn-badge {
    font-size: 1.2rem;
    animation: bounce 1.5s ease infinite;
}

.qty-info {
    font-size: 0.85rem;
    color: var(--text-sub);
}

.qty-label {
    font-weight: 500;
}

.qty-value {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    color: var(--text-main);
}

.roi-section {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
}

.roi-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1;
}

.roi-label {
    font-size: 0.75rem;
    color: var(--text-sub);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
}

.card-middle {
    margin-bottom: 14px;
}

.info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.info-item {
    background: var(--bg-secondary);
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--border-light);
}

.info-label {
    font-size: 0.75rem;
    color: var(--text-sub);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
    font-weight: 600;
}

.info-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 4px;
}

.price-value {
    font-size: 1.15rem;
}

.market-value {
    font-size: 1.2rem;
}

.info-unit {
    font-size: 0.75rem;
    color: var(--text-sub);
    font-weight: 500;
}

.price-change-mobile {
    font-size: 0.8rem;
    font-weight: 600;
}

.card-bottom {
    padding-top: 14px;
    border-top: 1px solid var(--border-light);
}

.pnl-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}

.pnl-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px;
    background: var(--bg-secondary);
    border-radius: 8px;
}

.pnl-label {
    font-size: 0.75rem;
    color: var(--text-sub);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
}

.pnl-amount {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.05rem;
    font-weight: 700;
}

.expand-details {
    margin-top: 12px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        max-height: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        max-height: 100px;
        transform: translateY(0);
    }
}

.detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
}

.detail-label {
    font-size: 0.85rem;
    color: var(--text-sub);
    font-weight: 500;
}

.detail-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-main);
}

.expand-hint {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 10px;
    font-weight: 500;
}

@media (max-width: 480px) {
    .holding-card {
        padding: 16px;
        margin-bottom: 12px;
    }
    
    .roi-value {
        font-size: 1.35rem;
    }
    
    .info-value {
        font-size: 1rem;
    }
    
    .price-value {
        font-size: 1.05rem;
    }
    
    .market-value {
        font-size: 1.1rem;
    }
}
</style>