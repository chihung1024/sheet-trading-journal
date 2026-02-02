<template>
  <div class="card">
    <div class="card-header">
        <div class="header-left">
            <h3>持倉明細 <span class="group-badge" v-if="portfolioStore.currentGroup !== 'all'"># {{ portfolioStore.currentGroup }}</span></h3>
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
                    <th @click="sortBy('current_price_origin')" class="text-right sortable sticky-th">
                        現價 (T1) <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span>
                    </th>
                    <th class="text-right sticky-th">適用匯率</th>
                    <th @click="sortBy('market_value_twd')" class="text-right sortable sticky-th">
                        台幣市值 <span class="sort-icon">{{ getSortIcon('market_value_twd') }}</span>
                    </th>
                    <th @click="sortBy('daily_pl_twd')" class="text-right sortable sticky-th highlight-col">
                        今日盈虧 (NAV) <span class="sort-icon">{{ getSortIcon('daily_pl_twd') }}</span>
                    </th>
                    <th @click="sortBy('pnl_twd')" class="text-right sortable sticky-th">
                        累計損益 <span class="sort-icon">{{ getSortIcon('pnl_twd') }}</span>
                    </th>
                    <th @click="sortBy('pnl_percent')" class="text-right sortable sticky-th">
                        報酬率 <span class="sort-icon">{{ getSortIcon('pnl_percent') }}</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="item in sortedHoldings" :key="item.symbol" :class="{ 'row-profit': item.pnl_twd > 0, 'row-loss': item.pnl_twd < 0 }">
                    <td class="font-bold">
                        <div class="symbol-cell">
                            {{ item.symbol }}
                            <span class="currency-tag" :class="item.currency.toLowerCase()">{{ item.currency }}</span>
                        </div>
                    </td>
                    <td class="text-right font-mono">{{ formatNumber(item.qty) }}</td>
                    <td class="text-right font-mono">
                        <div class="price-cell">
                            <span class="curr-p">{{ formatCurrency(item.current_price_origin, item.currency) }}</span>
                            <span class="prev-p">昨收: {{ item.prev_close_price }}</span>
                        </div>
                    </td>
                    <td class="text-right font-mono">
                        <div class="fx-cell" v-if="item.currency !== 'TWD'">
                            <span class="fx-val">{{ item.curr_fx_rate.toFixed(2) }}</span>
                            <span class="fx-delta" :class="getFxChangeClass(item)">
                                {{ item.curr_fx_rate > item.prev_fx_rate ? '▲' : '▼' }}
                            </span>
                        </div>
                        <span v-else class="text-muted">-</span>
                    </td>
                    <td class="text-right font-mono font-bold">{{ formatNumber(item.market_value_twd) }}</td>
                    
                    <td class="text-right font-mono highlight-col" :class="getDailyColorClass(item.daily_pl_twd)">
                        <div class="nav-pnl-cell" :title="getNavTooltip(item)">
                            <div class="pnl-amt">{{ item.daily_pl_twd > 0 ? '+' : '' }}{{ formatNumber(item.daily_pl_twd) }}</div>
                            <div class="pnl-pct">{{ item.daily_change_percent > 0 ? '+' : '' }}{{ item.daily_change_percent.toFixed(2) }}%</div>
                        </div>
                    </td>
                    
                    <td class="text-right font-mono" :class="getColorClass(item.pnl_twd)">
                        {{ item.pnl_twd > 0 ? '+' : '' }}{{ formatNumber(item.pnl_twd) }}
                    </td>
                    <td class="text-right">
                        <span class="pnl-badge" :class="getBadgeClass(item.pnl_percent)">
                            {{ item.pnl_percent > 0 ? '+' : '' }}{{ item.pnl_percent.toFixed(2) }}%
                        </span>
                    </td>
                </tr>
                <tr v-if="sortedHoldings.length === 0">
                    <td colspan="8" class="empty-state">
                        <div class="empty-content">
                            <span class="empty-icon">📂</span>
                            <p>沒有找到符合條件的持倉數據</p>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="mobile-view">
        <div v-for="item in sortedHoldings" :key="'mob-' + item.symbol" class="m-card">
            <div class="m-card-header">
                <div class="m-symbol">
                    <span class="m-name">{{ item.symbol }}</span>
                    <span class="currency-tag sm" :class="item.currency.toLowerCase()">{{ item.currency }}</span>
                </div>
                <div class="m-daily-pnl" :class="getDailyColorClass(item.daily_pl_twd)">
                    今日 {{ item.daily_pl_twd > 0 ? '+' : '' }}{{ formatNumber(item.daily_pl_twd) }}
                </div>
            </div>
            
            <div class="m-card-body">
                <div class="m-row">
                    <div class="m-col">
                        <div class="m-label">股數</div>
                        <div class="m-val">{{ formatNumber(item.qty) }}</div>
                    </div>
                    <div class="m-col">
                        <div class="m-label">現價 (T1)</div>
                        <div class="m-val">{{ formatCurrency(item.current_price_origin, item.currency) }}</div>
                    </div>
                    <div class="m-col text-right">
                        <div class="m-label">市值 (TWD)</div>
                        <div class="m-val bold">{{ formatNumber(item.market_value_twd) }}</div>
                    </div>
                </div>
                
                <div class="m-row mt-2">
                    <div class="m-col">
                        <div class="m-label">累計損益</div>
                        <div class="m-val" :class="getColorClass(item.pnl_twd)">
                            {{ item.pnl_twd > 0 ? '+' : '' }}{{ formatNumber(item.pnl_twd) }}
                        </div>
                    </div>
                    <div class="m-col text-right">
                        <div class="m-label">報酬率</div>
                        <div class="m-badge-sm" :class="getBadgeClass(item.pnl_percent)">
                            {{ item.pnl_percent > 0 ? '+' : '' }}{{ item.pnl_percent.toFixed(2) }}%
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="card-footer">
        <div class="footer-item">
            <span class="footer-label">持倉標的數:</span>
            <span class="footer-val">{{ sortedHoldings.length }}</span>
        </div>
        <div class="m-divider"></div>
        <div class="footer-item">
            <span class="footer-label">今日資產淨變動 (NAV):</span>
            <span class="footer-val" :class="getDailyColorClass(portfolioStore.dailyPnL)">
                {{ portfolioStore.dailyPnL > 0 ? '+' : '' }}{{ formatNumber(portfolioStore.dailyPnL) }} TWD
            </span>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const portfolioStore = usePortfolioStore();

// --- 狀態定義 ---
const searchQuery = ref('');
const filterStatus = ref('all');
const sortKey = ref('market_value_twd');
const sortOrder = ref('desc');

// --- 格式化工具 ---
const formatNumber = (val) => {
    if (val === undefined || val === null) return '0';
    return Math.round(val).toLocaleString();
};

const formatCurrency = (val, currency) => {
    const symbol = currency === 'TWD' ? 'NT$' : '$';
    return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- 邏輯判定 ---
const getDailyColorClass = (val) => {
    if (val > 0) return 'text-profit';
    if (val < 0) return 'text-loss';
    return '';
};

const getColorClass = (val) => {
    if (val > 1) return 'text-profit';
    if (val < -1) return 'text-loss';
    return '';
};

const getBadgeClass = (val) => {
    if (val > 0.1) return 'badge-profit';
    if (val < -0.1) return 'badge-loss';
    return 'badge-neutral';
};

const getFxChangeClass = (item) => {
    if (item.curr_fx_rate > item.prev_fx_rate) return 'fx-up';
    if (item.curr_fx_rate < item.prev_fx_rate) return 'fx-down';
    return 'fx-stable';
};

/**
 * 🚀 [v14.0] 產生 NAV 計算邏輯的詳細工具提示
 */
const getNavTooltip = (item) => {
    if (item.currency === 'TWD') return `台股損益 = Q * (P1 - P0)`;
    return `NAV 變動分析:\n` +
           `T0 價值: ${item.qty} * ${item.prev_close_price} * ${item.prev_fx_rate.toFixed(2)}\n` +
           `T1 價值: ${item.qty} * ${item.current_price_origin} * ${item.curr_fx_rate.toFixed(2)}\n` +
           `匯率影響: ${((item.curr_fx_rate / item.prev_fx_rate - 1) * 100).toFixed(2)}%`;
};

// --- 排序與過濾邏輯 ---
const sortBy = (key) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'desc';
    }
};

const getSortIcon = (key) => {
    if (sortKey.value !== key) return '↕';
    return sortOrder.value === 'asc' ? '↑' : '↓';
};

const totalMarketValue = computed(() => {
    return portfolioStore.holdings.reduce((sum, h) => sum + h.market_value_twd, 0);
});

const sortedHoldings = computed(() => {
    let result = [...portfolioStore.holdings];
    
    // 1. 搜尋過濾
    if (searchQuery.value) {
        const q = searchQuery.value.toUpperCase();
        result = result.filter(h => h.symbol.includes(q));
    }
    
    // 2. 盈虧狀態過濾
    if (filterStatus.value === 'profit') {
        result = result.filter(h => h.pnl_twd > 0);
    } else if (filterStatus.value === 'loss') {
        result = result.filter(h => h.pnl_twd < 0);
    }
    
    // 3. 排序
    result.sort((a, b) => {
        let valA = a[sortKey.value];
        let valB = b[sortKey.value];
        
        if (typeof valA === 'string') {
            return sortOrder.value === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        }
        
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
    
    return result;
});
</script>

<style scoped>
.card {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    margin-bottom: 24px;
    overflow: hidden;
    border: 1px solid #eee;
}

.card-header {
    padding: 20px 24px;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
}

.header-left h3 {
    margin: 0 0 4px 0;
    font-size: 1.25rem;
    color: #1a1a1a;
}

.group-badge {
    font-size: 0.8rem;
    background: #eff6ff;
    color: #2563eb;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
}

.summary-info {
    font-size: 0.9rem;
    color: #666;
}

.header-controls {
    display: flex;
    gap: 12px;
}

.search-box {
    position: relative;
    display: flex;
    align-items: center;
}

.search-icon {
    position: absolute;
    left: 12px;
    color: #999;
}

.search-input {
    padding: 8px 12px 8px 36px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 0.9rem;
    width: 200px;
    transition: all 0.2s;
}

.search-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.filter-select {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: white;
    font-size: 0.9rem;
    cursor: pointer;
}

/* 表格樣式 */
.table-container {
    width: 100%;
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    min-width: 900px;
}

th {
    background: #f8fafc;
    padding: 14px 16px;
    text-align: left;
    font-size: 0.85rem;
    font-weight: 600;
    color: #64748b;
    border-bottom: 2px solid #edf2f7;
    white-space: nowrap;
}

.sticky-th {
    position: sticky;
    top: 0;
    z-index: 10;
}

.sortable {
    cursor: pointer;
    user-select: none;
}

.sortable:hover {
    background: #f1f5f9;
    color: #1e293b;
}

td {
    padding: 16px;
    font-size: 0.95rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
}

tr:hover {
    background-color: #f8fafc;
}

/* 核心欄位視覺引導 */
.highlight-col {
    background-color: rgba(99, 102, 241, 0.02);
}

.symbol-cell {
    display: flex;
    align-items: center;
    gap: 8px;
}

.currency-tag {
    font-size: 0.7rem;
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 700;
    text-transform: uppercase;
}

.currency-tag.twd { background: #dcfce7; color: #166534; }
.currency-tag.usd { background: #fef9c3; color: #854d0e; }

.price-cell, .nav-pnl-cell, .fx-cell {
    display: flex;
    flex-direction: column;
}

.prev-p, .fx-delta {
    font-size: 0.75rem;
    color: #94a3b8;
}

.pnl-pct {
    font-size: 0.8rem;
    font-weight: 600;
}

.fx-up { color: #ef4444; }
.fx-down { color: #22c55e; }

.pnl-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 0.85rem;
    min-width: 70px;
    text-align: center;
}

.badge-profit { background: #dcfce7; color: #15803d; }
.badge-loss { background: #fee2e2; color: #b91c1c; }
.badge-neutral { background: #f1f5f9; color: #64748b; }

.text-profit { color: #15803d; }
.text-loss { color: #b91c1c; }
.text-muted { color: #94a3b8; }

.text-right { text-align: right; }
.font-mono { font-family: 'JetBrains Mono', 'Roboto Mono', monospace; }
.font-bold { font-weight: 700; }

/* 行動端與註腳樣式 */
.mobile-view { display: none; }

@media (max-width: 1024px) {
    .desktop-view { display: none; }
    .mobile-view { display: block; padding: 12px; }
    
    .m-card {
        background: #fff;
        border: 1px solid #eee;
        border-radius: 12px;
        margin-bottom: 12px;
        padding: 16px;
    }
    
    .m-card-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        border-bottom: 1px solid #f9f9f9;
        padding-bottom: 8px;
    }
    
    .m-name { font-weight: 800; font-size: 1.1rem; margin-right: 8px; }
    .m-row { display: flex; justify-content: space-between; }
    .m-label { font-size: 0.75rem; color: #888; margin-bottom: 2px; }
    .m-val { font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; }
}

.card-footer {
    padding: 16px 24px;
    background: #f8fafc;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 24px;
    border-top: 1px solid #f0f0f0;
}

.footer-label { font-size: 0.85rem; color: #64748b; }
.footer-val { font-weight: 800; font-size: 1.1rem; }
</style>
