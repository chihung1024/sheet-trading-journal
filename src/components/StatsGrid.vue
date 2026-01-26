<template>
  <div class="stats-grid">
    <div class="stat-card hero-card">
      <div class="card-header">
        <span class="label">Total Net Worth</span>
        <span class="icon-box">💰</span>
      </div>
      
      <div class="card-body">
        <div class="main-value-group">
          <span class="currency">NT$</span>
          <span class="value-hero">{{ displayTotalValue }}</span>
        </div>
        
        <div class="progress-section">
          <div class="progress-info">
            <span class="sub-label">Invested: {{ formatNumber(stats.invested_capital) }}</span>
            <span class="sub-label">{{ capitalRatio.toFixed(1) }}% Utilized</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${capitalRatio}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="stat-card">
      <div class="card-header">
        <span class="label">
          Daily P&L
          <span v-if="isUSMarketOpen" class="live-indicator" title="Market Open"></span>
        </span>
        <span class="icon-box">⚡</span>
      </div>
      <div class="card-body">
        <div class="value-group" :class="getPnlColor(dailyPnL)">
          <span class="value-lg">
            {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
          </span>
          <span class="trend-pill" :class="getPnlBg(dailyRoi)">
            {{ dailyPnL >= 0 ? '▲' : '▼' }} {{ Math.abs(dailyRoi).toFixed(2) }}%
          </span>
        </div>
        <p class="desc-text">{{ isUSMarketOpen ? 'Live Market Data' : 'Previous Close' }}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="card-header">
        <span class="label">Unrealized P&L</span>
        <span class="icon-box">📈</span>
      </div>
      <div class="card-body">
        <div class="value-group" :class="getPnlColor(unrealizedPnL)">
          <span class="value-lg">
            {{ unrealizedPnL >= 0 ? '+' : '' }}{{ displayUnrealized }}
          </span>
          <span class="trend-pill" :class="getPnlBg(roi)">
            {{ roi >= 0 ? '▲' : '▼' }} {{ Math.abs(roi).toFixed(2) }}%
          </span>
        </div>
        <p class="desc-text">Paper value based on holdings</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="card-header">
        <span class="label">Realized P&L</span>
        <span class="icon-box">💵</span>
      </div>
      <div class="card-body">
        <div class="value-group" :class="getPnlColor(realizedPnL)">
          <span class="value-lg">
            {{ realizedPnL >= 0 ? '+' : '' }}{{ displayRealized }}
          </span>
        </div>
        <p class="desc-text">Includes dividends & closed trades</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="card-header">
        <span class="label">TWR (Time-Weighted)</span>
        <span class="icon-box">🎯</span>
      </div>
      <div class="card-body">
        <div class="value-group">
          <span class="value-lg" :class="getPnlColor(stats.twr)">
            {{ (stats.twr || 0) >= 0 ? '+' : '' }}{{ (stats.twr || 0).toFixed(2) }}<small>%</small>
          </span>
        </div>
        <p class="desc-text">Strategy performance excluding cashflows</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="card-header">
        <span class="label">XIRR (Annualized)</span>
        <span class="icon-box">🚀</span>
      </div>
      <div class="card-body">
        <div class="value-group">
          <span class="value-lg" :class="getPnlColor(stats.xirr)">
            {{ (stats.xirr || 0) >= 0 ? '+' : '' }}{{ (stats.xirr || 0).toFixed(2) }}<small>%</small>
          </span>
        </div>
        <p class="desc-text">Money-weighted return rate</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

// Core Data
const stats = computed(() => store.stats || {});
const history = computed(() => store.history || []);

// Computations
const totalPnL = computed(() => stats.value.total_pnl || 0);
const realizedPnL = computed(() => stats.value.realized_pnl || 0);
const unrealizedPnL = computed(() => totalPnL.value - realizedPnL.value);
const dailyPnL = computed(() => store.dailyPnL || 0);

// Ratios
const capitalRatio = computed(() => {
    const total = stats.value.total_value || 1;
    const capital = stats.value.invested_capital || 0;
    if (total === 0) return 0;
    return Math.min((capital / total) * 100, 100);
});

const roi = computed(() => {
  if (!stats.value.invested_capital) return 0;
  return (unrealizedPnL.value / stats.value.invested_capital) * 100;
});

const dailyRoi = computed(() => {
  let baseValue = 0;
  if (!history.value || history.value.length < 2) return 0;
  // Fallback simplified logic for daily ROI base
  baseValue = history.value[history.value.length - 2].total_value || 1;
  return (dailyPnL.value / baseValue) * 100;
});

// Market Status
const isUSMarketOpen = computed(() => {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const hour = now.getHours();
  // Simple check: 21:00 - 05:00
  return hour >= 21 || hour < 5;
});

// Utilities
const formatNumber = (num) => Number(num||0).toLocaleString('en-US');
const getPnlColor = (val) => Number(val) >= 0 ? 'text-success' : 'text-danger';
const getPnlBg = (val) => Number(val) >= 0 ? 'bg-success-light' : 'bg-danger-light';

// Animated Number Hook (EaseOut)
const useAnimatedNumber = (targetVal) => {
  const current = ref(0);
  watch(targetVal, (newVal) => {
    const start = current.value;
    const end = Number(newVal) || 0;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out
      
      current.value = start + (end - start) * ease;

      if (progress < 1) requestAnimationFrame(animate);
      else current.value = end;
    };
    requestAnimationFrame(animate);
  }, { immediate: true });
  
  return computed(() => Math.round(current.value).toLocaleString('en-US'));
};

const displayTotalValue = useAnimatedNumber(computed(() => stats.value.total_value));
const displayUnrealized = useAnimatedNumber(unrealizedPnL);
const displayRealized = useAnimatedNumber(realizedPnL);
const displayDaily = useAnimatedNumber(dailyPnL);

</script>

<style scoped>
/* Grid Layout */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  width: 100%;
}

/* Base Card Style */
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  min-height: 150px;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-hover);
}

/* Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-box {
  width: 32px;
  height: 32px;
  background: var(--bg-app);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: var(--text-secondary);
}

/* Values Typography */
.value-group {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.value-lg {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.2;
}

.currency {
  font-size: 1rem;
  color: var(--text-muted);
  font-weight: 500;
  margin-right: 4px;
}

.desc-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 8px;
}

/* Trend Pills */
.trend-pill {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
}

/* Colors from App.vue variables */
.text-success { color: var(--c-success); }
.text-danger { color: var(--c-danger); }
.bg-success-light { background: rgba(16, 185, 129, 0.1); color: var(--c-success); }
.bg-danger-light { background: rgba(239, 68, 68, 0.1); color: var(--c-danger); }

/* Hero Card Special Styling */
.hero-card {
  grid-column: span 1; /* Default grid flow */
  background: linear-gradient(145deg, var(--bg-card), var(--bg-app));
  border: 1px solid var(--c-brand-light);
  position: relative;
  overflow: hidden;
}

.hero-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; width: 4px; height: 100%;
  background: var(--c-brand);
}

.value-hero {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
}

/* Progress Bar in Hero */
.progress-section {
  margin-top: 16px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.progress-track {
  width: 100%;
  height: 6px;
  background: var(--border-base);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--c-brand);
  border-radius: 3px;
  transition: width 1s ease-out;
}

/* Live Indicator */
.live-indicator {
  width: 6px; height: 6px;
  background: var(--c-danger);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .hero-card { grid-column: span 2; }
}

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: 1fr; gap: 16px; }
  .hero-card { grid-column: auto; }
  .stat-card { padding: 16px; min-height: auto; }
  .value-lg { font-size: 1.4rem; }
  .value-hero { font-size: 1.8rem; }
}
</style>
