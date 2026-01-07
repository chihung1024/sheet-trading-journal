<template>
  <div class="stats-grid">
    <div class="stat-card accent-blue">
      <div class="label">總資產淨值</div>
      <div class="value main-value">{{ formatCurrency(stats.total_value) }}</div>
      <div class="sub-info">
        <span>投入成本</span>
        <span class="white">{{ formatCurrency(stats.invested_capital) }}</span>
      </div>
    </div>

    <div class="stat-card" :class="unrealizedPnL >= 0 ? 'accent-green' : 'accent-red'">
      <div class="label">未實現損益</div>
      <div class="value">
        {{ unrealizedPnL >= 0 ? '▲' : '▼' }} {{ formatCurrency(Math.abs(unrealizedPnL)) }}
      </div>
      <div class="sub-info">
        <span class="percent-tag" :class="unrealizedPnL >= 0 ? 'bg-green' : 'bg-red'">
            {{ roi }}%
        </span>
      </div>
    </div>

    <div class="stat-card">
      <div class="label">今日損益 (預估)</div>
      <div class="value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
        {{ dailyPnL >= 0 ? '+' : '' }}{{ formatCurrency(dailyPnL) }}
      </div>
      <div class="sub-info">24H 變動</div>
    </div>

    <div class="stat-card accent-gold">
      <div class="label">TWR 總報酬率</div>
      <div class="value twr-font" :class="stats.twr >= 0 ? 'text-green' : 'text-red'">
        {{ stats.twr }}%
      </div>
      <div class="sub-info benchmark">
        <span>SPY 基準</span>
        <span class="yellow">{{ stats.benchmark_twr || '-' }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const stats = computed(() => store.stats || {});
const history = computed(() => store.history || []);
const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));
const roi = computed(() => stats.value.invested_capital ? ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2) : '0.00');

const dailyPnL = computed(() => {
  if (history.value.length < 2) return 0;
  const last = history.value[history.value.length - 1];
  const prev = history.value[history.value.length - 2];
  return (last.total_value - last.invested) - (prev.total_value - prev.invested);
});

const formatCurrency = (num) => {
  if (num === undefined || num === null) return '$ -';
  return '$' + Number(num).toLocaleString('zh-TW');
};
</script>

<style scoped>
.stats-grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); 
    gap: 20px; 
    margin-bottom: 24px; 
}
.stat-card { 
    background: rgba(45, 45, 50, 0.4); 
    border: 1px solid var(--border);
    padding: 24px; border-radius: 16px;
    position: relative; overflow: hidden;
}
.stat-card::before {
    content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
    background: transparent;
}
.accent-blue::before { background: var(--primary); }
.accent-green::before { background: var(--green); }
.accent-red::before { background: var(--red); }
.accent-gold::before { background: #fbbf24; }

.label { font-size: 0.85rem; color: #9ca3af; margin-bottom: 12px; font-weight: 500; }
.value { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.5px; }
.main-value { color: var(--primary); }
.twr-font { font-family: 'Roboto Mono', monospace; }

.sub-info { 
    margin-top: 15px; display: flex; justify-content: space-between; 
    font-size: 0.85rem; color: #6b7280; align-items: center;
}
.percent-tag {
    padding: 2px 8px; border-radius: 6px; color: white; font-weight: 600; font-size: 0.75rem;
}
.bg-green { background: #059669; }
.bg-red { background: #dc2626; }
.white { color: #fff; }
.yellow { color: #fbbf24; }
</style>
