<template>
  <div class="card">
    <div class="card-header">
        <h3>持倉明細</h3>
        <div class="summary-info">
            市值總計: <strong>{{ formatNumber(totalMarketValue) }}</strong> TWD
        </div>
    </div>
    
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('symbol')" class="sortable">代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span></th>
                    <th @click="sortBy('qty')" class="text-right sortable">股數 <span class="sort-icon">{{ getSortIcon('qty') }}</span></th>
                    <th @click="sortBy('avg_cost_usd')" class="text-right sortable">成本(USD) <span class="sort-icon">{{ getSortIcon('avg_cost_usd') }}</span></th>
                    <th @click="sortBy('current_price_origin')" class="text-right sortable">現價 <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span></th>
                    <th @click="sortBy('market_value_twd')" class="text-right sortable">市值(TWD) <span class="sort-icon">{{ getSortIcon('market_value_twd') }}</span></th>
                    <th @click="sortBy('pnl_twd')" class="text-right sortable">損益 <span class="sort-icon">{{ getSortIcon('pnl_twd') }}</span></th>
                    <th @click="sortBy('pnl_percent')" class="text-right sortable">報酬率 <span class="sort-icon">{{ getSortIcon('pnl_percent') }}</span></th>
                </tr>
            </thead>
            <tbody>
                 <tr v-if="sortedHoldings.length === 0">
                    <td colspan="7" class="empty-state">目前無持倉數據</td>
                </tr>
                <tr v-for="h in sortedHoldings" :key="h.symbol" class="row-item">
                    <td class="col-symbol">
                        <div class="symbol-wrapper">
                            <span class="symbol-text">{{ h.symbol }}</span>
                            <span class="tag-badge">{{ h.tag || 'Stock' }}</span>
                        </div>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(h.qty, 2) }}</td>
                    <td class="text-right font-num text-sub">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                    <td class="text-right font-num">{{ formatNumber(h.current_price_origin, 2) }}</td>
                    <td class="text-right font-num font-bold">{{ formatNumber(h.market_value_twd, 0) }}</td>
                    <td class="text-right font-num" :class="getTrendClass(h.pnl_twd)">
                        {{ formatNumber(h.pnl_twd, 0) }}
                    </td>
                    <td class="text-right font-num" :class="getTrendClass(h.pnl_percent)">
                        <span class="roi-badge" :class="getTrendClass(h.pnl_percent, true)">
                            {{ safeNum(h.pnl_percent) }}%
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const sortKey = ref('market_value_twd'); // 預設依市值排序
const sortOrder = ref('desc'); // 預設降冪

// 安全數字轉換，防止 NaN
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

// 排序邏輯
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

const sortedHoldings = computed(() => {
    return [...store.holdings].sort((a, b) => {
        let valA = a[sortKey.value];
        let valB = b[sortKey.value];
        
        // 處理文字排序 (Symbol)
        if (typeof valA === 'string') {
            return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        
        // 處理數字排序
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
});

const getTrendClass = (val, isBg = false) => {
    const num = Number(val) || 0;
    if (num >= 0) return isBg ? 'bg-green' : 'text-green';
    return isBg ? 'bg-red' : 'text-red';
};
</script>

<style scoped>
/* 樣式與上一版類似，增加 sortable 指標 */
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.summary-info { color: var(--text-sub); font-size: 0.9rem; }
.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { 
    text-align: left; color: var(--text-sub); font-size: 0.85rem; font-weight: 600; 
    padding: 12px 16px; border-bottom: 2px solid var(--border-color); white-space: nowrap;
    cursor: pointer; user-select: none; transition: color 0.2s;
}
th:hover { color: var(--primary); }
.sort-icon { font-size: 0.8rem; margin-left: 4px; opacity: 0.5; }
td { padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 1rem; color: var(--text-main); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background-color: #f8fafc; }

.col-symbol { width: 20%; }
.symbol-wrapper { display: flex; flex-direction: column; }
.symbol-text { font-weight: 700; font-size: 1.1rem; }
.tag-badge { font-size: 0.75rem; color: var(--text-sub); background: #f1f5f9; width: fit-content; padding: 1px 6px; border-radius: 4px; margin-top: 2px; }

.text-right { text-align: right; }
.text-sub { color: var(--text-sub); }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.text-green { color: #059669; }
.text-red { color: #dc2626; }
.roi-badge { padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.9rem; }
.roi-badge.bg-green { background: #d1fae5; color: #065f46; }
.roi-badge.bg-red { background: #fee2e2; color: #991b1b; }
.empty-state { text-align: center; padding: 40px; color: var(--text-sub); }
</style>
