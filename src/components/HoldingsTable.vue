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
                    <th @click="sortBy('avg_cost_usd')" class="text-right sortable">成本 (USD) <span class="sort-icon">{{ getSortIcon('avg_cost_usd') }}</span></th>
                    <th @click="sortBy('current_price_origin')" class="text-right sortable">現價 <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span></th>
                    <th @click="sortBy('market_value_twd')" class="text-right sortable">市值 (TWD) <span class="sort-icon">{{ getSortIcon('market_value_twd') }}</span></th>
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
                        </div>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(h.qty, 2) }}</td>
                    <td class="text-right font-num text-sub">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                    <td class="text-right font-num">{{ formatNumber(h.current_price_origin, 2) }}</td>
                    <td class="text-right font-num font-bold">{{ formatNumber(h.market_value_twd, 0) }}</td>
                    <td class="text-right font-num" :class="getTrendClass(h.pnl_twd)">
                        {{ formatNumber(h.pnl_twd, 0) }}
                    </td>
                    <td class="text-right font-num">
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
const sortKey = ref('market_value_twd'); 
const sortOrder = ref('desc'); 

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
        if (typeof valA === 'string') return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        valA = Number(valA) || 0; valB = Number(valB) || 0;
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
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
.summary-info { font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; background: #f1f5f9; padding: 6px 12px; border-radius: 8px; color: var(--text-main); }

.table-container { overflow-x: auto; }

/* 表格樣式細節 */
.sort-icon { font-size: 0.8rem; margin-left: 4px; opacity: 0.5; }
th.sortable { cursor: pointer; transition: color 0.2s; }
th.sortable:hover { color: var(--primary); }

.col-symbol { width: 120px; }
.symbol-text { 
    font-weight: 700; font-size: 0.95rem; 
    background: #eff6ff; color: #1e40af; 
    padding: 4px 10px; border-radius: 6px; 
    display: inline-block;
}

.text-right { text-align: right; }
.text-sub { color: #94a3b8; font-size: 0.85rem; }
.font-num { font-family: 'JetBrains Mono', monospace; letter-spacing: -0.02em; }
.font-bold { font-weight: 700; }

.text-green { color: #166534; }
.text-red { color: #b91c1c; }
.roi-badge { display: inline-block; width: 64px; text-align: center; padding: 4px 0; border-radius: 6px; font-weight: 600; font-size: 0.85rem; }
.roi-badge.bg-green { background: #dcfce7; color: #166534; }
.roi-badge.bg-red { background: #fee2e2; color: #991b1b; }

.empty-state { text-align: center; padding: 60px; color: var(--text-sub); font-style: italic; }
</style>
