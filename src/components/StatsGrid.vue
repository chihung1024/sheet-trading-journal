<template>
  <div class="stats-grid">
    <div class="stat-block hero-block hover-lift">
      <div class="stat-content">
        <div class="stat-top">
          <span class="stat-label">總資產淨值 (Net Worth)</span>
          <span class="icon-box glow-icon">💰</span>
        </div>
        <div class="stat-main">
          <div class="stat-value hero-text">{{ displayTotalValue }}</div>
          <span class="currency-tag">TWD</span>
        </div>
        <div class="stat-footer">
          <div class="footer-row">
            <span class="f-label">投入成本</span> 
            <span class="f-val">{{ formatNumber(stats.invested_capital) }}</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :style="{ width: capitalRatio + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="stat-block hover-lift" :class="getPnlClass(unrealizedPnL)">
      <div class="stat-top">
        <span class="stat-label">未實現損益 (Unrealized)</span>
        <span class="icon-box">📈</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(unrealizedPnL)">
          <span class="trend-arrow">{{ getTrendArrow(unrealizedPnL) }}</span>
          {{ displayUnrealized }}
        </div>
      </div>
      <div class="stat-footer">
        <div class="roi-badge" :class="getPnlClass(roi)">
          ROI: {{ roi }}%
        </div>
      </div>
    </div>
    
    <div class="stat-block hover-lift">
      <div class="stat-top">
        <span class="stat-label">已實現損益 (Realized)</span>
        <span class="icon-box">💵</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(realizedPnL)">
          <span class="trend-arrow">{{ getTrendArrow(realizedPnL) }}</span>
          {{ displayRealized }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-xs">含賣出價差 + 股息收入</span>
      </div>
    </div>
    
    <div class="stat-block hover-lift" :title="pnlTooltip">
      <div class="stat-top">
        <span class="stat-label">
          {{ pnlLabel }}
          <span v-if="isUSMarketOpen" class="live-dot"></span>
        </span>
        <span class="icon-box">⚡</span>
      </div>
      <div class="stat-main column-layout">
        <div class="stat-value" :class="getPnlTextClass(dailyPnL)">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
        </div>
        <div class="stat-sub-value" :class="getPnlTextClass(dailyPnL)">
          {{ dailyPnL >= 0 ? '▲' : '▼' }} {{ Math.abs(dailyRoi) }}%
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-xs">{{ pnlDescription }}</span>
      </div>
    </div>
    
    <div class="stat-block hover-lift">
      <div class="stat-top">
        <span class="stat-label">時間加權報酬 (TWR)</span>
        <span class="icon-box">🎯</span>
      </div>
      <div class="stat-main">
        <div class="stat-value">{{ stats.twr || 0 }}<span class="percent">%</span></div>
      </div>
      <div class="stat-footer">
         <span class="text-sub text-xs">排除資金進出影響的策略表現</span>
      </div>
    </div>
    
    <div class="stat-block hover-lift">
      <div class="stat-top">
        <span class="stat-label">年化報酬率 (XIRR)</span>
        <span class="icon-box">🚀</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(stats.xirr)">
          {{ (stats.xirr || 0) >= 0 ? '+' : '' }}{{ (stats.xirr || 0).toFixed(2) }}<span class="percent">%</span>
        </div>
      </div>
      <div class="stat-footer">
         <span class="text-sub text-xs">考量資金時間價值的真實回報</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

// 核心數據
const stats = computed(() => store.stats || {});
const history = computed(() => store.history || []);

// 計算屬性
const totalPnL = computed(() => stats.value.total_pnl || 0);
const realizedPnL = computed(() => stats.value.realized_pnl || 0);
const unrealizedPnL = computed(() => totalPnL.value - realizedPnL.value);

// 資金比例 (用於進度條：成本佔總值比例)
const capitalRatio = computed(() => {
    const total = stats.value.total_value || 1;
    const capital = stats.value.invested_capital || 0;
    if (total === 0) return 0;
    return Math.min((capital / total) * 100, 100);
});

const roi = computed(() => {
  if (!stats.value.invested_capital) return '0.00';
  return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

const dailyPnL = computed(() => store.dailyPnL || 0);

// 市場狀態判斷
const isUSMarketOpen = computed(() => {
  const now = new Date();
  const day = now.getDay();
  // 週末不開盤
  if (day === 0 || day === 6) return false;
  
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // 簡單判斷美股時段 (夏令 21:30 - 04:00, 冬令 22:30...)
  // 這裡採用寬鬆判斷：21:00 ~ 05:00
  if (hour >= 21 || hour < 5) {
    return true;
  }
  return false;
});

const pnlLabel = computed(() => isUSMarketOpen.value ? '美股盤中損益' : '當日損益');
const pnlDescription = computed(() => isUSMarketOpen.value ? '即時報價計算中' : '昨日收盤結算');
const pnlTooltip = computed(() => isUSMarketOpen.value ? '今日市值 - 昨日市值 - 今日現金流' : '今日市值 - 前日市值 - 昨晚現金流');

const dailyRoi = computed(() => {
  let baseValue = 0;
  if (!history.value || history.value.length < 2) return '0.00';
  
  if (isUSMarketOpen.value) {
    baseValue = history.value[history.value.length - 2].total_value || 0;
  } else {
    // 若已有今日收盤資料(長度不變但資料更新)，base 應為前一筆
    // 這裡簡化邏輯：取倒數第二筆作為基準
    baseValue = history.value[history.value.length - 2].total_value || 0;
  }
  
  if (!baseValue || baseValue === 0) return '0.00';
  return ((dailyPnL.value / baseValue) * 100).toFixed(2);
});

// 工具函數
const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW');
const getPnlClass = (val) => Number(val) >= 0 ? 'status-up' : 'status-down';
const getPnlTextClass = (val) => Number(val) >= 0 ? 'text-green' : 'text-red';
const getTrendArrow = (val) => Number(val) >= 0 ? '▲' : '▼';

// 數字動畫 Hook
const useAnimatedNumber = (targetVal) => {
  const current = ref(0);
  watch(targetVal, (newVal) => {
    if (newVal == null) return;
    const start = current.value;
    const end = Number(newVal);
    const duration = 800;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // EaseOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      
      current.value = start + (end - start) * ease;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        current.value = end;
      }
    };
    requestAnimationFrame(animate);
  }, { immediate: true });
  
  return computed(() => Math.round(current.value).toLocaleString('zh-TW'));
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
    gap: 20px;
    margin-bottom: 24px;
}

/* Card Base Styles */
.stat-block {
    background: var(--bg-card);
    padding: 20px 24px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 140px;
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-block:hover {
    box-shadow: var(--shadow-card);
    border-color: var(--border-highlight);
}

/* Hero Block Special Styling */
.hero-block {
    background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
    border: 1px solid var(--primary-light);
    box-shadow: 0 4px 20px rgba(37, 99, 235, 0.08);
}
.hero-block::before {
    content: '';
    position: absolute;
    top: 0; left: 0; width: 4px; height: 100%;
    background: var(--primary);
}

/* Typography & Layout */
.stat-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.stat-label {
    font-size: 0.85rem;
    color: var(--text-sub);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.icon-box {
    width: 40px; height: 40px;
    border-radius: 10px;
    background: var(--bg-secondary);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem;
    color: var(--text-main);
    transition: transform 0.3s ease;
}
.stat-block:hover .icon-box { transform: rotate(10deg) scale(1.1); }
.glow-icon { text-shadow: 0 0 15px rgba(255, 215, 0, 0.4); }

.stat-main {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 16px;
    flex-grow: 1;
}
.stat-main.column-layout { flex-direction: column; gap: 4px; }

.stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.1;
    letter-spacing: -0.02em;
}
.hero-text { font-size: 2.2rem; color: var(--primary-dark); }
html.dark .hero-text { color: var(--primary); }

.currency-tag, .percent {
    font-size: 0.9rem;
    color: var(--text-sub);
    font-weight: 600;
}

.stat-sub-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    font-weight: 600;
}

/* Trend Colors */
.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.status-up .icon-box { background: var(--success-bg); color: var(--success); }
.status-down .icon-box { background: var(--danger-bg); color: var(--danger); }
.trend-arrow { font-size: 0.8em; margin-right: 4px; }

/* Footer & Badges */
.stat-footer {
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.footer-row { display: flex; justify-content: space-between; align-items: center; }

.roi-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 99px;
    font-weight: 700;
    font-size: 0.8rem;
    font-family: 'JetBrains Mono', monospace;
}
.roi-badge.status-up { background: var(--success-bg); color: var(--success); }
.roi-badge.status-down { background: var(--danger-bg); color: var(--danger); }

/* Progress Bar */
.progress-bar-bg {
    width: 100%; height: 4px;
    background: var(--bg-secondary);
    border-radius: 2px;
    overflow: hidden;
}
.progress-bar-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 2px;
    transition: width 1s ease-out;
}

/* Live Indicator */
.live-dot {
    display: inline-block;
    width: 8px; height: 8px;
    background: var(--danger);
    border-radius: 50%;
    margin-left: 6px;
    animation: pulse 1.5s infinite;
}

/* Animations */
@keyframes pulse {
    0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    70% { transform: scale(1.1); opacity: 0.7; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
    100% { transform: scale(1); opacity: 1; }
}

/* Responsive */
@media (max-width: 1280px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .hero-block { grid-column: span 2; }
}

@media (max-width: 768px) {
    .stats-grid { grid-template-columns: 1fr; gap: 16px; }
    .hero-block { grid-column: auto; }
    .stat-block { padding: 16px; min-height: auto; }
    .stat-value { font-size: 1.5rem; }
    .hero-text { font-size: 2rem; }
}
</style>
