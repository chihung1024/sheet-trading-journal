<template>
  <div class="stats-grid">
    <div class="stat-card primary">
      <div class="card-label">投資組合淨值 (TWD)</div>
      <div class="card-value">NT${{ formatNumber(stats.total_value, 0) }}</div>
      <div class="card-sub">
        <span class="label">投入本金:</span>
        <span class="value">NT${{ formatNumber(stats.invested_capital, 0) }}</span>
      </div>
    </div>

    <div class="stat-card" :class="getPnlClass(stats.total_pnl)">
      <div class="card-label">總損益 (未實現+已實現)</div>
      <div class="card-value">
        {{ stats.total_pnl >= 0 ? '+' : '' }}NT${{ formatNumber(stats.total_pnl, 0) }}
      </div>
      <div class="card-sub">
        <span class="label">報酬率:</span>
        <span class="value">{{ calculateReturn(stats.total_pnl, stats.invested_capital) }}%</span>
      </div>
    </div>

    <div class="stat-card twr">
      <div class="card-label">時間加權報酬率 (TWR)</div>
      <div class="card-value">{{ formatNumber(stats.twr, 2) }}%</div>
      <div class="card-sub">
        <span class="label">基準 ({{ portfolioStore.selectedBenchmark }}):</span>
        <span class="value" :class="getPnlClass(stats.benchmark_twr)">
            {{ formatNumber(stats.benchmark_twr, 2) }}%
        </span>
      </div>
    </div>

    <div class="stat-card xirr">
      <div class="card-label">年化報酬率 (XIRR)</div>
      <div class="card-value">{{ formatNumber(stats.xirr, 2) }}%</div>
      <div class="card-sub">
        <span class="label">現金流加權計算</span>
      </div>
    </div>

    <div class="stat-card realized">
      <div class="card-label">已實現損益 / 配息</div>
      <div class="card-value">NT${{ formatNumber(stats.realized_pnl, 0) }}</div>
      <div class="card-sub">
        <span class="label">累計現金入帳</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const portfolioStore = usePortfolioStore();
const stats = computed(() => portfolioStore.stats || {});

const formatNumber = (num, precision = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });
};

const getPnlClass = (val) => {
  if (!val || val === 0) return '';
  return val > 0 ? 'text-success' : 'text-danger';
};

const calculateReturn = (pnl, invested) => {
  if (!invested || invested === 0) return '0.00';
  return formatNumber((pnl / invested) * 100, 2);
};
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  width: 100%;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

.stat-card.primary {
  border-top: 4px solid var(--primary);
}

.stat-card.text-success {
  border-top: 4px solid var(--success);
}

.stat-card.text-danger {
  border-top: 4px solid var(--danger);
}

.stat-card.twr {
  border-top: 4px solid var(--warning);
}

.stat-card.xirr {
  border-top: 4px solid #8b5cf6;
}

.stat-card.realized {
  border-top: 4px solid #06b6d4;
}

.card-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-value {
  font-size: 1.8rem;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-main);
  line-height: 1.2;
}

.card-sub {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}

.card-sub .label {
  color: var(--text-sub);
}

.card-sub .value {
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.text-success {
  color: var(--success) !important;
}

.text-danger {
  color: var(--danger) !important;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .card-value {
    font-size: 1.4rem;
  }
  .stat-card {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
