<template>
  <div class="card holdings-card">
    <h3>💼 持倉明細</h3>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>代碼</th>
            <th class="text-right">股數</th>
            <th class="text-right">平均成本</th>
            <th class="text-right">現價</th>
            <th class="text-right hide-mobile">市值</th>
            <th class="text-right">損益</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in holdings" :key="h.symbol">
            <td class="font-mono font-bold">{{ h.symbol }}</td>
            <td class="text-right">{{ formatNumber(h.qty) }}</td>
            <td class="text-right">${{ formatNumber(h.avg_cost) }}</td>
            <td class="text-right">${{ formatNumber(h.current_price) }}</td>
            <td class="text-right hide-mobile">${{ formatNumber(h.market_value) }}</td>
            <td class="text-right" :class="h.unrealized_pl >= 0 ? 'positive' : 'negative'">
              {{ formatNumber(h.unrealized_pl) }}
              <div class="text-xs">({{ formatPercent(h.unrealized_pl_percent) }})</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const holdings = computed(() => store.holdings || []);

const formatNumber = (val) => {
  if (!val || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
};

const formatPercent = (val) => {
  if (!val || isNaN(val)) return '0%';
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
};
</script>

<style scoped>
.holdings-card h3 { margin-bottom: 16px; }
.table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.text-right { text-align: right; }
.font-mono { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 600; }
.positive { color: var(--success); }
.negative { color: var(--danger); }
.text-xs { font-size: 0.75rem; }

@media (max-width: 768px) {
  .hide-mobile { display: none; }
  .holdings-card h3 { font-size: 1rem; margin-bottom: 12px; }
}
</style>