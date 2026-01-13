<template>
  <div class="stats-grid">
    <div class="stat-card" v-for="(stat, i) in stats" :key="i">
      <div class="stat-header">
        <span class="stat-label">{{ stat.label }}</span>
        <span class="stat-icon">{{ stat.icon }}</span>
      </div>
      <div class="stat-value" :class="stat.colorClass">{{ stat.value }}</div>
      <div class="stat-change" v-if="stat.change" :class="stat.changeClass">{{ stat.change }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

const formatNumber = (val) => {
  if (!val || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
};

const formatPercent = (val) => {
  if (!val || isNaN(val)) return '0.00%';
  return `${(val * 100).toFixed(2)}%`;
};

const stats = computed(() => [
  { label: '總資產 (USD)', icon: '💰', value: formatNumber(store.portfolio?.total_value), colorClass: 'text-primary' },
  { label: '當日損益', icon: '⚡', value: formatNumber(store.portfolio?.daily_pl), colorClass: store.portfolio?.daily_pl >= 0 ? 'text-success' : 'text-danger', change: formatPercent(store.portfolio?.daily_pl_pct) },
  { label: '未實現損益', icon: '📈', value: formatNumber(store.portfolio?.unrealized_pl), colorClass: store.portfolio?.unrealized_pl >= 0 ? 'text-success' : 'text-danger' },
  { label: '已實現損益', icon: '💵', value: formatNumber(store.portfolio?.realized_pl), colorClass: store.portfolio?.realized_pl >= 0 ? 'text-success' : 'text-danger' },
  { label: '總報酬率', icon: '🎯', value: formatPercent(store.portfolio?.total_return), colorClass: store.portfolio?.total_return >= 0 ? 'text-success' : 'text-danger' },
  { label: 'XIRR 年化', icon: '📅', value: formatPercent(store.portfolio?.xirr), colorClass: store.portfolio?.xirr >= 0 ? 'text-success' : 'text-danger' },
]);
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }
.stat-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px; box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; }
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
.stat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.stat-label { font-size: 0.75rem; font-weight: 600; color: var(--text-sub); text-transform: uppercase; letter-spacing: 0.05em; }
.stat-icon { font-size: 1.2rem; opacity: 0.7; }
.stat-value { font-size: 1.5rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-bottom: 4px; }
.stat-change { font-size: 0.8rem; font-weight: 600; }
.text-primary { color: var(--primary); }
.text-success { color: var(--success); }
.text-danger { color: var(--danger); }
.changeClass { font-weight: 500; }

/* ✅ 平板版：4列 */
@media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }
/* ✅ 手機版：3列 2行 */
@media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(3, 1fr); gap: 12px; } .stat-card { padding: 14px; } .stat-value { font-size: 1.3rem; } }
/* ✅ 小手機：2列 3行 */
@media (max-width: 640px) { .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } .stat-card { padding: 12px; } .stat-label { font-size: 0.7rem; } .stat-icon { font-size: 1rem; } .stat-value { font-size: 1.2rem; } .stat-change { font-size: 0.75rem; } }
</style>