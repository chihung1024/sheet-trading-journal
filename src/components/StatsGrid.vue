<template>
  <div class="grid">
    <div class="stat">
      <div class="label">Total Value (TWD)</div>
      <div class="val text-primary">{{ format(stats.total_value) }}</div>
      <div class="sub">Cost: {{ format(stats.invested_capital) }}</div>
    </div>
    <div class="stat">
      <div class="label">Unrealized PnL</div>
      <div class="val" :class="pnlClass">{{ format(pnl) }}</div>
      <div class="sub">{{ roi }}%</div>
    </div>
    <div class="stat">
      <div class="label">TWR Return</div>
      <div class="val" :class="stats.twr >= 0 ? 'text-green' : 'text-red'">{{ stats.twr }}%</div>
      <div class="sub text-yellow">SPY: {{ stats.benchmark_twr }}%</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const stats = computed(() => store.stats);
const pnl = computed(() => store.unrealizedPnL);

const roi = computed(() => {
  if(!stats.value.invested_capital) return 0;
  return ((pnl.value / stats.value.invested_capital) * 100).toFixed(2);
});

const pnlClass = computed(() => pnl.value >= 0 ? 'text-green' : 'text-red');
const format = (n) => Number(n || 0).toLocaleString();
</script>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
.stat { background: #1e1e24; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid transparent; }
.label { color: #888; font-size: 0.9rem; margin-bottom: 5px; }
.val { font-size: 1.8rem; font-weight: bold; }
.sub { font-size: 0.8rem; color: #666; margin-top: 5px; }
.text-primary { color: #2979ff; }
.text-green { color: #00e676; }
.text-red { color: #ff5252; }
.text-yellow { color: #ffc400; }
</style>
