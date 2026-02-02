<template>
  <div class="stats-grid">
    <div class="stat-block primary-block">
      <div class="stat-top">
        <span class="stat-label">總資產淨值</span>
        <span class="icon-box highlight">💰</span>
      </div>
      <div class="stat-main">
        <div class="stat-value big">{{ displayTotalValue }}</div>
        <div class="unit-text">TWD</div>
      </div>
      <div class="stat-footer">
        <div class="footer-item">
            <span class="f-label">投入淨成本</span> 
            <span class="f-val">{{ formatNumber(stats.invested_capital) }}</span>
        </div>
        <div class="footer-item fx-hint" v-if="stats.daily_pnl_curr_fx">
            <span class="f-label">觀測匯率:</span>
            <span class="f-val">{{ stats.daily_pnl_curr_fx.toFixed(2) }}</span>
        </div>
      </div>
    </div>
    
    <div class="stat-block daily-pnl-block" :class="getPnlBgClass(dailyPnL)">
      <div class="stat-top">
        <span class="stat-label">當日資產變動 (NAV)</span>
        <span class="icon-box" :class="dailyPnL >= 0 ? 'profit' : 'loss'">
            {{ dailyPnL >= 0 ? '🚀' : '📉' }}
        </span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(dailyPnL)">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDailyPnL }}
        </div>
      </div>
      <div class="stat-footer multi-line" v-if="stats.daily_pnl_breakdown">
        <div class="breakdown-item">
            <span class="b-label">台股:</span>
            <span class="b-val" :underline="stats.daily_pnl_breakdown.tw_pnl_twd !== 0">
                {{ formatNumber(stats.daily_pnl_breakdown.tw_pnl_twd) }}
            </span>
        </div>
        <div class="breakdown-item">
            <span class="b-label">美股/匯率:</span>
            <span class="b-val" :underline="stats.daily_pnl_breakdown.us_pnl_twd !== 0">
                {{ formatNumber(stats.daily_pnl_breakdown.us_pnl_twd) }}
            </span>
        </div>
      </div>
    </div>

    <div class="stat-block" :class="getPnlBgClass(unrealizedPnL)">
      <div class="stat-top">
        <span class="stat-label">未實現損益</span>
        <span class="icon-box">📈</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(unrealizedPnL)">
          {{ unrealizedPnL >= 0 ? '+' : '' }}{{ displayUnrealized }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="badge" :class="roi >= 0 ? 'badge-green' : 'badge-red'">
            ROI: {{ roi }}%
        </span>
      </div>
    </div>
    
    <div class="stat-block" :class="getPnlBgClass(stats.realized_pnl)">
      <div class="stat-top">
        <span class="stat-label">已實現損益</span>
        <span class="icon-box">💵</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(stats.realized_pnl)">
          {{ stats.realized_pnl >= 0 ? '+' : '' }}{{ formatNumber(stats.realized_pnl) }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="f-label text-xs">累計結算金額</span>
      </div>
    </div>

    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">TWR 報酬率</span>
        <span class="icon-box">⏱️</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(stats.twr)">
            {{ stats.twr >= 0 ? '+' : '' }}{{ stats.twr }}%
        </div>
      </div>
      <div class="stat-footer">
        <span class="f-label">指數對比 (SPY):</span>
        <span class="f-val ml-1" :class="getPnlTextClass(stats.benchmark_twr)">
            {{ stats.benchmark_twr }}%
        </span>
      </div>
    </div>

    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">年化 XIRR</span>
        <span class="icon-box">📊</span>
      </div>
      <div class="stat-main">
        <div class="stat-value highlight-blue">
            {{ stats.xirr >= 0 ? '+' : '' }}{{ stats.xirr }}%
        </div>
      </div>
      <div class="stat-footer">
        <span class="f-label">反映資金利用效率</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const portfolioStore = usePortfolioStore();

// 從 Store 獲取彙總數據 (v14.0 會根據當前 Group 自動切換)
const stats = computed(() => portfolioStore.stats || {
  total_value: 0,
  invested_capital: 0,
  total_pnl: 0,
  twr: 0,
  xirr: 0,
  realized_pnl: 0,
  benchmark_twr: 0,
  daily_pnl_twd: 0,
  daily_pnl_breakdown: { tw_pnl_twd: 0, us_pnl_twd: 0 }
});

const dailyPnL = computed(() => portfolioStore.dailyPnL);
const unrealizedPnL = computed(() => portfolioStore.unrealizedPnL);

// --- 顯示轉換 ---
const displayTotalValue = computed(() => formatNumber(stats.value.total_value));
const displayDailyPnL = computed(() => formatNumber(dailyPnL.value));
const displayUnrealized = computed(() => formatNumber(unrealizedPnL.value));

const roi = computed(() => {
    if (!stats.value.invested_capital || stats.value.invested_capital === 0) return '0.00';
    return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

// --- 工具函式 ---
function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return Math.round(num).toLocaleString();
}

function getPnlBgClass(val) {
  if (val > 100) return 'bg-profit-soft';
  if (val < -100) return 'bg-loss-soft';
  return '';
}

function getPnlTextClass(val) {
  if (val > 0.01) return 'text-profit';
  if (val < -0.01) return 'text-loss';
  return '';
}
</script>

<style scoped>
:root {
    --primary-bg: #f8fafc;
    --profit: #22c55e;
    --profit-soft: #f0fdf4;
    --loss: #ef4444;
    --loss-soft: #fef2f2;
    --warning: #f59e0b;
    --text-main: #1e293b;
    --text-sub: #64748b;
    --border-color: #e2e8f0;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.stat-block {
    background: white;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 140px;
    transition: transform 0.2s, box-shadow 0.2s;
}

.stat-block:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
}

.primary-block {
    background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
    border-left: 5px solid #6366f1;
}

.daily-pnl-block {
    border-bottom: 4px solid transparent;
}

.stat-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.stat-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-sub);
}

.icon-box {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 1.1rem;
}

.icon-box.highlight {
    background: #e0e7ff;
}

.stat-main {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8px;
}

.stat-value {
    font-size: 1.6rem;
    font-weight: 800;
    font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
    letter-spacing: -0.5px;
}

.stat-value.big {
    font-size: 2rem;
    color: #1e1b4b;
}

.unit-text {
    font-size: 0.8rem;
    font-weight: 700;
    color: #94a3b8;
}

.stat-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #f1f5f9;
}

.multi-line {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

.footer-item, .breakdown-item {
    font-size: 0.75rem;
    display: flex;
    gap: 6px;
}

.f-label, .b-label { color: #64748b; }
.f-val, .b-val { font-weight: 700; color: #334155; }

.fx-hint {
    background: #fffbeb;
    padding: 2px 6px;
    border-radius: 4px;
}

.badge {
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
}

.badge-green { background: #dcfce7; color: #15803d; }
.badge-red { background: #fee2e2; color: #b91c1c; }

.text-profit { color: #15803d; }
.text-loss { color: #b91c1c; }
.highlight-blue { color: #2563eb; }

.bg-profit-soft { background-color: #f0fdf4; border-color: #bcf0da; }
.bg-loss-soft { background-color: #fef2f2; border-color: #fecaca; }

/* 手機版適配 */
@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
    
    .stat-block {
        padding: 14px;
        min-height: 120px;
    }
    
    /* 使用 Order 重新排序 */
    .stat-block:nth-child(1) { order: 1; grid-column: span 2; }
    .stat-block.daily-pnl-block { order: 2; grid-column: span 2; }
    .stat-block:nth-child(2) { order: 3; }
    .stat-block:nth-child(3) { order: 4; }
}
</style>
