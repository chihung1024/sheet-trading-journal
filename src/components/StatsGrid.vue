<template>
  <div class="stats-grid">
    <div class="stat-card" v-for="stat in stats" :key="stat.label">
      <div class="stat-header">
        <span class="stat-label">{{ stat.label }}</span>
        <span class="stat-icon">{{ stat.icon }}</span>
      </div>
      <div class="stat-value" :class="stat.colorClass">
        {{ stat.value }}
      </div>
      <div v-if="stat.subValue" class="stat-sub" :class="stat.colorClass">
        {{ stat.subValue }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

const formatCurrency = (val) => {
  if (!val || isNaN(val)) return '0';
  return new Intl.NumberFormat('zh-TW', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(val);
};

const formatPercent = (val) => {
  if (!val || isNaN(val)) return '0.00%';
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
};

const getColorClass = (val) => {
  if (!val || isNaN(val) || val === 0) return '';
  return val > 0 ? 'positive' : 'negative';
};

const stats = computed(() => [
  {
    label: '總資產 (TWD)',
    icon: '💰',
    value: formatCurrency(store.summary?.total_value || 0),
    colorClass: ''
  },
  {
    label: '當日損益',
    icon: '⚡',
    value: formatCurrency(store.summary?.daily_pl || 0),
    subValue: formatPercent(store.summary?.daily_pl_percent || 0),
    colorClass: getColorClass(store.summary?.daily_pl || 0)
  },
  {
    label: '未實現損益',
    icon: '📈',
    value: formatCurrency(store.summary?.unrealized_pl || 0),
    colorClass: getColorClass(store.summary?.unrealized_pl || 0)
  },
  {
    label: '已實現損益',
    icon: '💵',
    value: formatCurrency(store.summary?.realized_pl || 0),
    colorClass: getColorClass(store.summary?.realized_pl || 0)
  },
  {
    label: '總報酬率',
    icon: '📉',
    value: formatPercent(store.summary?.total_return || 0),
    colorClass: getColorClass(store.summary?.total_return || 0)
  },
  {
    label: 'XIRR 年化報酬',
    icon: '🎯',
    value: formatPercent(store.summary?.xirr || 0),
    colorClass: getColorClass(store.summary?.xirr || 0)
  }
]);
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-sub);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.stat-icon {
  font-size: 1.3rem;
  opacity: 0.8;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 4px;
}

.stat-sub {
  font-size: 1rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.positive {
  color: var(--success);
}

.negative {
  color: var(--danger);
}

/* ✅ 手機版：3列 2行 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .stat-card {
    padding: 14px;
  }
  
  .stat-label {
    font-size: 0.7rem;
  }
  
  .stat-icon {
    font-size: 1.1rem;
  }
  
  .stat-value {
    font-size: 1.3rem;
  }
  
  .stat-sub {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    gap: 10px;
  }
  
  .stat-card {
    padding: 12px;
  }
  
  .stat-label {
    font-size: 0.65rem;
  }
  
  .stat-value {
    font-size: 1.2rem;
  }
  
  .stat-sub {
    font-size: 0.8rem;
  }
}
</style>