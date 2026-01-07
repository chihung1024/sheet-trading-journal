<template>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">總淨值 (TWD)</div>
      <div class="stat-value" style="color:var(--primary)">{{ formatNumber(stats.total_value) }}</div>
      <div class="stat-sub" style="color:#888">成本: {{ formatNumber(stats.invested_capital) }}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">未實現損益</div>
      <div class="stat-value" :class="unrealizedPnL >= 0 ? 'text-green' : 'text-red'">
        {{ unrealizedPnL >= 0 ? '+' : '' }}{{ formatNumber(unrealizedPnL) }}
      </div>
      <div class="stat-sub">
        {{ roi }}%
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">今日損益 (估計)</div>
      <div class="stat-value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
        {{ dailyPnL >= 0 ? '+' : '' }}{{ formatNumber(dailyPnL) }}
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">TWR 總報酬率</div>
      <div class="stat-value" :class="stats.twr >= 0 ? 'text-green' : 'text-red'">
        {{ stats.twr }}%
      </div>
      <div class="stat-sub" style="color:var(--yellow)">SPY: {{ stats.benchmark_twr || '-' }}%</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const stats = computed(() => store.stats || {});
const history = computed(() => store.history || []);

// 未實現損益 = 市值 - 投入成本
const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));

// ROI %
const roi = computed(() => {
  if (!stats.value.invested_capital) return 0;
  return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

// 單日損益計算邏輯 (移植自 index.html)
const dailyPnL = computed(() => {
  if (history.value.length < 2) return 0;
  const last = history.value[history.value.length - 1];
  const prev = history.value[history.value.length - 2];
  // 今日淨值變動 - 今日入金變動 = 純交易損益
  return (last.total_value - last.invested) - (prev.total_value - prev.invested);
});

const formatNumber = (num) => {
  if (num === undefined || num === null) return '-';
  return Number(num).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
</script>

<style scoped>
.stats-grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); 
    gap: 15px; 
    margin-bottom: 20px; 
}
.stat-card { 
    background: var(--card-bg); 
    padding: 20px; 
    border-radius: 12px; 
    border: 1px solid var(--border); 
    text-align: center; 
}
.stat-label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; }
.stat-value { font-size: 1.6rem; font-weight: bold; line-height: 1.2; }
.stat-sub { font-size: 0.85rem; margin-top: 6px; color: #888; }
</style>
