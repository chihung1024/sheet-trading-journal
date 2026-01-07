<template>
  <div class="card">
    <div class="card-header">
        <h3>持倉明細</h3>
        <div class="summary-info">
            共 {{ store.holdings.length }} 檔標的
        </div>
    </div>
    
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th class="col-symbol">代碼</th>
                    <th class="col-qty text-right">持有股數</th>
                    <th class="col-cost text-right">平均成本</th>
                    <th class="col-price text-right">現價</th>
                    <th class="col-mkt text-right">市值 (TWD)</th>
                    <th class="col-pnl text-right">損益試算</th>
                    <th class="col-roi text-right">報酬率</th>
                </tr>
            </thead>
            <tbody>
                 <tr v-if="store.holdings.length === 0">
                    <td colspan="7" class="empty-state">目前無持倉數據</td>
                </tr>
                <tr v-for="h in store.holdings" :key="h.symbol" class="row-item">
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
                            {{ h.pnl_percent }}%
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
  </div>
</template>

<script setup>
import { usePortfolioStore } from '../stores/portfolio';
const store = usePortfolioStore();

const formatNumber = (num, d=0) => Number(num||0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const getTrendClass = (val, isBg = false) => {
    if (val >= 0) return isBg ? 'bg-green' : 'text-green';
    return isBg ? 'bg-red' : 'text-red';
};
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.summary-info { color: var(--text-sub); font-size: 0.9rem; }

.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { 
    text-align: left; color: var(--text-sub); font-size: 0.85rem; font-weight: 600; 
    padding: 12px 16px; border-bottom: 2px solid var(--border-color); white-space: nowrap;
}
td { 
    padding: 16px; border-bottom: 1px solid var(--border-color); 
    font-size: 1rem; color: var(--text-main); vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background-color: #f8fafc; }

.col-symbol { width: 20%; }
.symbol-wrapper { display: flex; flex-direction: column; }
.symbol-text { font-weight: 700; font-size: 1.1rem; color: var(--text-main); }
.tag-badge { font-size: 0.75rem; color: var(--text-sub); background: #f1f5f9; width: fit-content; padding: 1px 6px; border-radius: 4px; margin-top: 2px; }

.text-right { text-align: right; }
.text-sub { color: var(--text-sub); }
.font-num { font-family: 'JetBrains Mono', 'Roboto Mono', monospace; letter-spacing: -0.5px; }
.font-bold { font-weight: 700; }

.text-green { color: #059669; }
.text-red { color: #dc2626; }
.roi-badge { padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.9rem; }
.roi-badge.bg-green { background: #d1fae5; color: #065f46; }
.roi-badge.bg-red { background: #fee2e2; color: #991b1b; }

.empty-state { text-align: center; padding: 40px; color: var(--text-sub); font-style: italic; }
</style>
