<template>
  <div class="card">
    <h3>💼 持倉明細 <span class="badge">Live</span></h3>
    <table v-if="store.holdings.length > 0">
        <thead class="desktop-only">
            <tr>
                <th>代碼</th>
                <th>標籤</th>
                <th>股數</th>
                <th>平均成本 (USD)</th>
                <th>現價 (USD)</th>
                <th>市值 (TWD)</th>
                <th>未平倉損益</th>
                <th>報酬率</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="h in store.holdings" :key="h.symbol" class="holding-row">
                <td data-label="代碼">
                    <div class="symbol-cell">
                        <strong>{{ h.symbol }}</strong>
                        <span class="tag-mobile">{{ h.tag || 'Stock' }}</span>
                    </div>
                </td>
                <td class="desktop-only"><span class="tag">{{ h.tag || 'Stock' }}</span></td>
                <td data-label="股數">{{ formatNumber(h.qty, 2) }}</td>
                <td data-label="平均成本" class="desktop-only">{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                <td data-label="現價">{{ formatNumber(h.current_price_origin, 2) }}</td>
                <td data-label="市值 (TWD)" class="highlight-val">{{ formatNumber(h.market_value_twd, 0) }}</td>
                <td data-label="損益" :class="h.pnl_twd >= 0 ? 'text-green' : 'text-red'">
                    {{ formatNumber(h.pnl_twd, 0) }}
                </td>
                <td data-label="報酬率" :class="h.pnl_percent >= 0 ? 'text-green' : 'text-red'">
                    {{ h.pnl_percent }}%
                </td>
            </tr>
        </tbody>
    </table>
    <div v-else class="empty">目前無持倉</div>
  </div>
</template>

<script setup>
import { usePortfolioStore } from '../stores/portfolio';
const store = usePortfolioStore();
const formatNumber = (num, d=0) => Number(num||0).toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
</script>

<style scoped>
.badge { background: rgba(64, 169, 255, 0.2); color: var(--primary); font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 8px; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; background: rgba(255,255,255,0.1); color: #ccc; }
.tag-mobile { display: none; font-size: 0.7rem; color: #888; background: #333; padding: 1px 4px; border-radius: 3px; margin-left: 6px; }
.highlight-val { font-weight: 600; color: #e0e0e0; }
.empty { text-align: center; padding: 30px; color: var(--text-muted); }

/* Mobile RWD */
@media (max-width: 768px) {
    .desktop-only { display: none; }
    
    .holding-row {
        display: flex; flex-direction: column;
        padding: 16px; border-bottom: 1px solid var(--card-border);
    }
    .holding-row td { 
        display: flex; justify-content: space-between; border: none; padding: 4px 0; 
    }
    .holding-row td::before {
        content: attr(data-label);
        color: var(--text-muted); font-size: 0.85rem;
    }
    .symbol-cell { display: flex; align-items: center; }
    .tag-mobile { display: inline-block; }
}
</style>
