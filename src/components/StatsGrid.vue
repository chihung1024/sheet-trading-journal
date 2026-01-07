<template>
  <div class="stats-grid">
    <div
      v-for="stat in stats"
      :key="stat.id"
      class="stat-card"
      :class="getStatClass(stat)"
    >
      <!-- Card Header -->
      <div class="stat-header">
        <div class="stat-icon">{{ stat.icon }}</div>
        <h3 class="stat-title">{{ stat.title }}</h3>
      </div>

      <!-- Card Body -->
      <div class="stat-body">
        <p class="stat-value">{{ formatValue(stat.value) }}</p>

        <!-- Subtitle if available -->
        <div v-if="stat.subtitle" class="stat-subtitle">
          {{ stat.subtitle }}
        </div>
      </div>

      <!-- Change indicator -->
      <div v-if="stat.change !== undefined" class="stat-change" :class="{
        positive: stat.trend === 'up',
        negative: stat.trend === 'down',
        neutral: stat.trend === 'neutral'
      }">
        <span class="change-icon">{{ stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→' }}</span>
        <span class="change-value">{{ Math.abs(stat.change) }}%</span>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { usePortfolioStore } from '@/stores/portfolio';

export default {
  name: 'StatsGrid',
  setup() {
    const portfolioStore = usePortfolioStore();

    const stats = computed(() => [
      {
        id: 'total-value',
        icon: '💰',
        title: 'Total Value',
        value: portfolioStore.totalValue,
        change: portfolioStore.valueChange,
        trend: portfolioStore.valueChange >= 0 ? 'up' : 'down',
        subtitle: 'Portfolio worth'
      },
      {
        id: 'total-return',
        icon: '📈',
        title: 'Total Return',
        value: portfolioStore.totalReturn,
        change: portfolioStore.returnChange,
        trend: portfolioStore.returnChange >= 0 ? 'up' : 'down',
        subtitle: 'YTD performance'
      },
      {
        id: 'win-rate',
        icon: '🎯',
        title: 'Win Rate',
        value: portfolioStore.winRate,
        change: portfolioStore.winRateChange,
        trend: portfolioStore.winRateChange >= 0 ? 'up' : 'down',
        subtitle: 'Winning trades'
      },
      {
        id: 'total-trades',
        icon: '📊',
        title: 'Total Trades',
        value: portfolioStore.totalTrades,
        change: portfolioStore.tradeChange,
        trend: portfolioStore.tradeChange >= 0 ? 'up' : 'neutral',
        subtitle: 'Executed trades'
      }
    ]);

    const getStatClass = (stat) => {
      return {
        'stat-positive': stat.trend === 'up',
        'stat-negative': stat.trend === 'down',
        'stat-neutral': stat.trend === 'neutral'
      };
    };

    const formatValue = (value) => {
      if (typeof value === 'number') {
        if (value >= 1000000) {
          return (value / 1000000).toFixed(2) + 'M';
        } else if (value >= 1000) {
          return (value / 1000).toFixed(2) + 'K';
        } else if (value < 1 && value > 0) {
          return value.toFixed(4);
        }
        return value.toFixed(2);
      }
      return value;
    };

    return {
      stats,
      getStatClass,
      formatValue
    };
  }
};
</script>

<style scoped>
:root {
  --stat-bg: #f8f9fa;
  --stat-border: #e0e0e0;
  --stat-text: #1a1a1a;
  --stat-icon-bg: #e3f2fd;
  --stat-positive-color: #4caf50;
  --stat-negative-color: #f44336;
  --stat-neutral-color: #9e9e9e;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 20px;
}

[data-theme='dark'] {
  --stat-bg: #2d2d2d;
  --stat-border: #3d3d3d;
  --stat-text: #ffffff;
  --stat-icon-bg: #1a3a52;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-lg);
  width: 100%;
}

.stat-card {
  background-color: var(--stat-bg);
  border: 1px solid var(--stat-border);
  border-radius: 12px;
  padding: var(--spacing-md);
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #2196f3;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #2196f3, #4caf50);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card:hover::before {
  transform: scaleX(1);
}

.stat-positive {
  border-color: rgba(76, 175, 80, 0.3);
}

.stat-negative {
  border-color: rgba(244, 67, 54, 0.3);
}

.stat-neutral {
  border-color: rgba(158, 158, 158, 0.3);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--stat-icon-bg);
  border-radius: 8px;
  font-size: 24px;
  flex-shrink: 0;
}

.stat-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--stat-text);
  line-height: 1.4;
}

.stat-body {
  margin-bottom: var(--spacing-md);
}

.stat-value {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--stat-text);
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.stat-subtitle {
  margin-top: 6px;
  font-size: 0.85rem;
  color: #999;
  font-weight: 400;
}

.stat-change {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  background-color: rgba(0, 0, 0, 0.05);
}

.stat-change.positive {
  color: var(--stat-positive-color);
  background-color: rgba(76, 175, 80, 0.1);
}

.stat-change.negative {
  color: var(--stat-negative-color);
  background-color: rgba(244, 67, 54, 0.1);
}

.stat-change.neutral {
  color: var(--stat-neutral-color);
  background-color: rgba(158, 158, 158, 0.1);
}

.change-icon {
  display: inline-block;
  font-size: 1rem;
}

.change-value {
  font-family: 'Monaco', 'Menlo', monospace;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }

  .stat-card {
    padding: var(--spacing-sm);
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-sm);
  }

  .stat-header {
    gap: 8px;
    margin-bottom: 12px;
  }

  .stat-value {
    font-size: 1.25rem;
  }

  .stat-title {
    font-size: 0.9rem;
  }
}
</style>
