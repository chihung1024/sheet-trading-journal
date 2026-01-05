<template>
  <div class="card">
    <h3>持倉明細 (Live)</h3>
    <table v-if="store.holdings.length > 0">
        <thead>
            <tr>
                <th>代碼</th>
                <th>標籤</th>
                <th>股數</th>
                <th>平均成本 (USD)</th>
                <th>現價 (USD)</th>
                <th>市值 (TWD)</th>
                <th>報酬率</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="h in store.holdings" :key="h.symbol">
                <td><strong>{{ h.symbol }}</strong></td>
                <td><span class="tag">{{ h.tag || 'Stock' }}</span></td>
                <td>{{ formatNumber(h.qty, 2) }}</td>
                <td>{{ formatNumber(h.avg_cost_usd, 2) }}</td>
                <td>{{ formatNumber(h.current_price_origin, 2) }}</td>
                <td>{{ formatNumber(h.market_value_twd, 0) }}</td>
                <td :class="h.pnl_percent >= 0 ? 'text-green' : 'text-red'">
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
.empty { text-align: center; padding: 20px; color: #666; }
</style>
