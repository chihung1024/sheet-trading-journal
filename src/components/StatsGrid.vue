<template>
  <div class="stats-grid">
    <div 
      v-for="stat in stats"
      :key="stat.id"
      class="stat-card"
      :class="{ 
        'stat-positive': stat.trend === 'up', 
        'stat-negative': stat.trend === 'down',
        'stat-neutral': stat.trend === 'neutral'
      }"
    >
      <div class="stat-header">
        <div class="stat-icon">{{ stat.icon }}</div>
        <h4 class="stat-title">{{ stat.title }}</h4>
      </div>

      <div class="stat-body">
        <p class="stat-value">{{ stat.value }}</p>
        
        <div v-if="stat.subtitle" class="stat-subtitle">
          {{ stat.subtitle }}
        </div>

        <div v-if="stat.change" class="stat-change" :class="{ positive: stat.trend === 'up', negative: stat.trend === 'down' }">
          <span class="change-icon">{{ stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '—' }}</span>
          <span class="change-value">{{ stat.change }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

const stats = computed(() => {
  const portfolio = store.portfolio || {};
  const records = store.records || [];
  const holdings = store.holdings || [];

  // 計算本月交易次數
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const monthlyTrades = records.filter(r => {
    const date = new Date(r.txn_date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  // 計算平均單筆收益
  const avgReturn = records.length > 0 
    ? records.reduce((sum, r) => sum + (r.total_amount || 0), 0) / records.length
    : 0;

  // 計算持倉平均收益率
  const avgHoldingReturn = holdings.length > 0
    ? holdings.reduce((sum, h) => sum + (h.gainPercent || 0), 0) / holdings.length
    : 0;

  return [
    {
      id: 'total-value',
      icon: '💰',
      title: '投資組合總值',
      value: formatCurrency(portfolio.totalValue || 0),
      subtitle: holdings.length ? `${holdings.length} 檔持倉` : '暫無持倉',
      trend: portfolio.totalReturn >= 0 ? 'up' : 'down',
      change: portfolio.totalReturn >= 0 ? `+$${formatCurrency(portfolio.totalReturn || 0)}` : `-$${formatCurrency(Math.abs(portfolio.totalReturn || 0))}`
    },
    {
      id: 'total-cost',
      icon: '💸',
      title: '總投入',
      value: formatCurrency(portfolio.totalCost || 0),
      subtitle: `平均成本 $${formatPrice((portfolio.totalCost || 0) / (portfolio.totalQty || 1))}`,
      trend: 'neutral'
    },
    {
      id: 'total-return',
      icon: '📈',
      title: '總收益率',
      value: formatPercent(portfolio.totalReturnPercent || 0),
      trend: portfolio.totalReturnPercent >= 0 ? 'up' : 'down',
      change: portfolio.totalReturnPercent >= 0 ? `+${formatPercent(portfolio.totalReturnPercent || 0)}` : `${formatPercent(portfolio.totalReturnPercent || 0)}`
    },
    {
      id: 'trade-count',
      icon: '💹',
      title: '交易次數',
      value: records.length.toString(),
      subtitle: `本月: ${monthlyTrades.length} 次`,
      trend: monthlyTrades.length > 0 ? 'up' : 'neutral'
    },
    {
      id: 'holding-count',
      icon: '🎯',
      title: '持倉數量',
      value: holdings.length.toString(),
      subtitle: `平均收益率 ${formatPercent(avgHoldingReturn)}`,
      trend: avgHoldingReturn >= 0 ? 'up' : 'down'
    },
    {
      id: 'avg-transaction',
      icon: '📊',
      title: '平均單筆',
      value: formatCurrency(avgReturn),
      subtitle: `基於 ${records.length} 筆交易`,
      trend: avgReturn >= 0 ? 'up' : 'neutral'
    },
    {
      id: 'best-performer',
      icon: '⭐',
      title: '最佳表現',
      value: getBestPerformer().symbol || '—',
      subtitle: getBestPerformer().symbol ? `+${formatPercent(getBestPerformer().gain)}` : '暫無數據',
      trend: 'up'
    },
    {
      id: 'worst-performer',
      icon: '📉',
      title: '最差表現',
      value: getWorstPerformer().symbol || '—',
      subtitle: getWorstPerformer().symbol ? `${formatPercent(getWorstPerformer().gain)}` : '暫無數據',
      trend: 'down'
    }
  ];
});

// 格式化函數
const formatCurrency = (value) => {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPrice = (value) => {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
};

const formatPercent = (value) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const getBestPerformer = () => {
  const holdings = store.holdings || [];
  return holdings.length > 0
    ? holdings.reduce((best, h) => (h.gainPercent || 0) > (best.gainPercent || 0) ? h : best)
    : {};
};

const getWorstPerformer = () => {
  const holdings = store.holdings || [];
  return holdings.length > 0
    ? holdings.reduce((worst, h) => (h.gainPercent || 0) < (worst.gainPercent || 0) ? h : worst)
    : {};
};
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  transition: all 300ms ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--border);
  transition: all 300ms ease;
}

.stat-card.stat-positive::before {
  background: #4cb050;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.stat-card.stat-negative::before {
  background: var(--error-light);
  box-shadow: 0 2px 8px rgba(248, 81, 73, 0.3);
}

.stat-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(31, 110, 251, 0.15);
  transform: translateY(-2px);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.stat-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
}

.stat-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-value {
  margin: 0;
  color: var(--text);
  font-size: 1.5rem;
  font-weight: 700;
  font-family: 'Monaco', 'Menlo', monospace;
  word-break: break-word;
}

.stat-subtitle {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 0;
}

.stat-change {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
  font-weight: 600;
  width: fit-content;
}

.stat-change.positive {
  color: #4cb050;
}

.stat-change.negative {
  color: var(--error-light);
}

.change-icon {
  font-size: 1rem;
}

.change-value {
  font-family: 'Monaco', 'Menlo', monospace;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-value {
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
