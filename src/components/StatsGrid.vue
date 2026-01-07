<template>
  <div class="stats-grid">
    <div
      v-for="(stat, index) in statsData"
      :key="index"
      class="stat-card"
      :style="{ animationDelay: `${index * 100}ms` }"
    >
      <div class="stat-header">
        <h3 class="stat-label">{{ stat.label }}</h3>
        <span v-if="stat.icon" class="stat-icon">{{ stat.icon }}</span>
      </div>

      <div :class="['stat-value', stat.valueClass]">
        {{ stat.value }}
      </div>

      <div v-if="stat.subtext" class="stat-sub">
        {{ stat.subtext }}
      </div>

      <div v-if="stat.trend" :class="['stat-trend', stat.trend.direction]">
        <span class="trend-arrow">{{ stat.trend.direction === 'up' ? '↑' : '↓' }}</span>
        <span>{{ stat.trend.text }}</span>
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

// 未實現損益 = 市值 - 投入成本
const unrealizedPnL = computed(
  () => (stats.value.total_value || 0) - (stats.value.invested_capital || 0)
);

// ROI %
const roi = computed(() => {
  if (!stats.value.invested_capital) return '0.00%';
  const roiValue = ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
  return `${roiValue}%`;
});

// 單日損益計算
const dailyPnL = computed(() => {
  if (history.value.length < 2) return 0;
  const last = history.value[history.value.length - 1];
  const prev = history.value[history.value.length - 2];
  return (last.total_value - last.invested) - (prev.total_value - prev.invested);
});

// 計算趨勢
const calculateTrend = (current, previous) => {
  if (current > previous) {
    return { direction: 'up', text: `+${((current - previous) / Math.abs(previous) * 100).toFixed(1)}%` };
  } else if (current < previous) {
    return { direction: 'down', text: `-${((previous - current) / Math.abs(previous) * 100).toFixed(1)}%` };
  }
  return null;
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return '-';
  return Number(num).toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const statsData = computed(() => [
  {
    label: '總淨值 (TWD)',
    value: formatNumber(stats.value.total_value),
    subtext: `成本: ${formatNumber(stats.value.invested_capital)}`,
    valueClass: 'text-primary',
    icon: '💰',
    trend:
      history.value.length >= 2
        ? calculateTrend(
            history.value[history.value.length - 1].total_value,
            history.value[history.value.length - 2].total_value
          )
        : null,
  },
  {
    label: '未實現損益',
    value: `${unrealizedPnL.value >= 0 ? '+' : ''}${formatNumber(unrealizedPnL.value)}`,
    subtext: roi.value,
    valueClass: unrealizedPnL.value >= 0 ? 'text-success' : 'text-error',
    icon: '📈',
    trend:
      history.value.length >= 2
        ? calculateTrend(unrealizedPnL.value, history.value[history.value.length - 2].total_value)
        : null,
  },
  {
    label: '今日損益 (估計)',
    value: `${dailyPnL.value >= 0 ? '+' : ''}${formatNumber(dailyPnL.value)}`,
    valueClass: dailyPnL.value >= 0 ? 'text-success' : 'text-error',
    icon: '📊',
    trend: null,
  },
  {
    label: 'TWR 總報酬率',
    value: `${stats.value.twr || 0}%`,
    subtext: `SPY: ${stats.value.benchmark_twr || '-'}%`,
    valueClass: (stats.value.twr || 0) >= 0 ? 'text-success' : 'text-error',
    icon: '🎯',
    trend: null,
  },
]);
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: var(--space-lg);
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.stat-card {
  background: var(--card-bg);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-normal) var(--easing-ease-in-out);
  animation: fadeInUp 500ms var(--easing-ease-out) both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.
