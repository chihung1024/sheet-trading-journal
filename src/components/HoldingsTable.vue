<template>
  <div class="card">
    <h3>Current Holdings</h3>
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Market Val</th>
          <th>PnL</th>
          <th>%</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="h in store.holdings" :key="h.symbol">
          <td style="font-weight:bold">{{ h.symbol }}</td>
          <td>{{ n(h.qty, 2) }}</td>
          <td>{{ n(h.current_price_origin, 2) }}</td>
          <td>{{ n(h.market_value_twd) }}</td>
          <td :class="color(h.pnl_twd)">{{ n(h.pnl_twd) }}</td>
          <td :class="color(h.pnl_percent)">{{ h.pnl_percent }}%</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { usePortfolioStore } from '../stores/portfolio';
const store = usePortfolioStore();
const n = (v, d=0) => Number(v||0).toLocaleString(undefined, {minimumFractionDigits:d, maximumFractionDigits:d});
const color = (v) => v >= 0 ? 'text-green' : 'text-red';
</script>

<style scoped>
table { width: 100%; border-collapse: collapse; }
th, td { text-align: right; padding: 10px; border-bottom: 1px solid #333; }
th:first-child, td:first-child { text-align: left; }
.text-green { color: #00e676; }
.text-red { color: #ff5252; }
</style>
