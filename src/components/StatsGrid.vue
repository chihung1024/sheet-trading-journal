<template>
  <div class="stats-grid">
    <div class="stat-block primary-card full-width">
      <div class="stat-top">
        <span class="stat-label">總資產淨值</span>
        <span class="icon-box">💰</span>
      </div>
      <div class="stat-main">
        <div class="stat-value big">{{ displayTotalValue }}</div>
        <div class="unit-text">TWD</div>
      </div>
      <div class="stat-footer">
        <div class="footer-item">
            <span class="f-label">投入成本</span> 
            <span class="f-val">{{ formatNumber(stats.invested_capital) }}</span>
        </div>
        <span class="badge-mini" :class="totalRoi >= 0 ? 'text-green' : 'text-red'">
          {{ totalRoi >= 0 ? '+' : '' }}{{ totalRoi }}%
        </span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">未實現損益</span>
        <span class="icon-box-sm">📈</span>
      </div>
      <div class="stat-main">
        <div class="stat-value-sm" :class="unrealizedPnL >= 0 ? 'text-green' : 'text-red'">
          {{ unrealizedPnL >= 0 ? '+' : '' }}{{ displayUnrealized }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="badge-compact" :class="roi >= 0 ? 'badge-green' : 'badge-red'">
            {{ roi }}%
        </span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">已實現損益</span>
        <span class="icon-box-sm">💵</span>
      </div>
      <div class="stat-main">
        <div class="stat-value-sm" :class="realizedPnL >= 0 ? 'text-green' : 'text-red'">
          {{ realizedPnL >= 0 ? '+' : '' }}{{ displayRealized }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-tiny">收益+配息</span>
      </div>
    </div>
    
    <div class="stat-block primary-card full-width highlight" :title="pnlTooltip">
      <div class="stat-top">
        <span class="stat-label label-bold">{{ pnlLabel }}</span>
        <span class="icon-box">⚡</span>
      </div>
      <div class="stat-main row-layout">
        <div class="stat-value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
        </div>
        <div class="stat-roi-badge" :class="dailyPnL >= 0 ? 'bg-green-soft' : 'bg-red-soft'">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ dailyRoi }}%
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-xs">{{ pnlDescription }}</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">TWR</span>
        <span class="icon-box-sm">🎯</span>
      </div>
      <div class="stat-main">
        <div class="stat-value-sm">{{ (stats.twr || 0).toFixed(2) }}<span class="percent">%</span></div>
      </div>
      <div class="stat-footer">
         <span class="text-sub text-tiny">策略表現</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">XIRR</span>
        <span class="icon-box-sm">🚀</span>
      </div>
      <div class="stat-main">
        <div class="stat-value-sm" :class="(stats.xirr || 0) >= 0 ? 'text-green' : 'text-red'">
          {{ (stats.xirr || 0) >= 0 ? '+' : '' }}{{ (stats.xirr || 0).toFixed(2) }}<span class="percent">%</span>
        </div>
      </div>
      <div class="stat-footer">
         <span class="text-sub text-tiny">年化報酬</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const stats = computed(() => store.stats || {});
const holdings = computed(() => store.holdings || []);

// 損益邏輯計算
const totalPnL = computed(() => stats.value.total_pnl || 0);
const realizedPnL = computed(() => stats.value.realized_pnl || 0);
const unrealizedPnL = computed(() => totalPnL.value - realizedPnL.value);

// MODIFIED: 增加總資產報酬率計算屬性
const totalRoi = computed(() => {
  if (!stats.value.invested_capital || stats.value.invested_capital === 0) return '0.00';
  return ((totalPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

const roi = computed(() => {
  if (!stats.value.invested_capital || stats.value.invested_capital === 0) return '0.00';
  return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

// 美股開盤偵測邏輯
const isUSMarketOpen = computed(() => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (hour >= 21 || hour < 5) {
    if (hour === 21 && minute < 30) return false;
    return true;
  }
  return false;
});

const pnlLabel = computed(() => isUSMarketOpen.value ? '美股盤中損益' : '今日損益');
const pnlDescription = computed(() => isUSMarketOpen.value ? '包含股價、匯率即時波動' : '對比昨日收盤之總變動');
const pnlTooltip = computed(() => '採用 Modified Dietz 方法，精確對齊當日交易與匯率變化');

const dailyPnL = computed(() => {
  return holdings.value.reduce((sum, holding) => sum + (holding.daily_pl_twd || 0), 0);
});

const dailyRoi = computed(() => {
  const yesterdayValue = stats.value.total_value - dailyPnL.value;
  // MODIFIED: 增加防禦性除零檢查
  if (!yesterdayValue || yesterdayValue <= 0) return '0.00';
  return ((dailyPnL.value / yesterdayValue) * 100).toFixed(2);
});

// 數值動畫 Hook 優化
const useAnimatedNumber = (targetVal) => {
  const current = ref(0);
  watch(targetVal, (newVal) => {
    if (newVal == null) return;
    current.value = Number(newVal);
  }, { immediate: true });
  return computed(() => Math.round(current.value).toLocaleString('zh-TW'));
};

const displayTotalValue = useAnimatedNumber(computed(() => stats.value.total_value));
const displayUnrealized = useAnimatedNumber(unrealizedPnL);
const displayRealized = useAnimatedNumber(realizedPnL);
const displayDaily = useAnimatedNumber(dailyPnL);

const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW');
</script>

<style scoped>
/* MODIFIED: 全方位響應式樣式調整 */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px; /* 縮小間距使畫面不鬆散 */
}

.stat-block {
    background: var(--bg-card);
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 110px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    user-select: none; /* 防止點擊時選中文字 */
}

/* MODIFIED: 新增行動端觸碰回饋 */
.stat-block:active {
    transform: scale(0.96);
    background: var(--bg-secondary);
}

.stat-block.primary-card {
    border-left: 4px solid var(--primary);
}

.stat-block.highlight {
    border-left: 4px solid var(--warning);
    background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
}

.stat-top { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 6px; 
}

.stat-label { 
    font-size: 0.75rem; 
    color: var(--text-sub); 
    font-weight: 700; 
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.stat-label.label-bold {
    color: var(--text-main);
}

.icon-box, .icon-box-sm { 
    width: 32px; 
    height: 32px; 
    border-radius: 8px; 
    background: var(--bg-secondary);
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-size: 1.1rem;
}

.icon-box-sm {
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
    opacity: 0.7;
}

.stat-main { 
    display: flex; 
    align-items: baseline; 
    gap: 4px; 
    margin-bottom: 8px; 
}

.stat-main.row-layout {
    flex-direction: row;
    align-items: center;
    gap: 12px;
}

.stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text-main);
    line-height: 1;
    letter-spacing: -0.04em;
}

.stat-value-sm {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.25rem;
    font-weight: 700;
}

.stat-value.big {
    font-size: 1.85rem;
}

/* MODIFIED: 新增數值變動百分比樣式 */
.stat-roi-badge {
    padding: 2px 8px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    font-weight: 700;
}

.bg-green-soft { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.bg-red-soft { background: rgba(239, 68, 68, 0.15); color: var(--danger); }

.unit-text, .percent { 
    font-size: 0.8rem; 
    color: var(--text-sub); 
    font-weight: 600; 
}

.stat-footer {
    padding-top: 8px;
    border-top: 1px dashed var(--border-color); /* 改為虛線增加設計感 */
    font-size: 0.75rem;
    display: flex; 
    align-items: center; 
    justify-content: space-between;
}

.footer-item { display: flex; align-items: center; gap: 4px; }
.f-val { font-weight: 700; font-family: 'JetBrains Mono', monospace; }

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-tiny { font-size: 0.7rem; opacity: 0.8; }

.badge-mini { font-weight: 800; font-size: 0.7rem; }

.badge-compact { 
    padding: 1px 6px; 
    border-radius: 4px; 
    font-weight: 700; 
    font-size: 0.75rem; 
}

.badge-green { background: var(--success); color: white; }
.badge-red { background: var(--danger); color: white; }

/* MODIFIED: 手機端佈局邏輯重構 */
@media (max-width: 1024px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .full-width { grid-column: span 2; }
}

@media (max-width: 480px) {
    .stats-grid { gap: 8px; }
    .stat-block { padding: 12px; min-height: 100px; }
    .stat-value { font-size: 1.4rem; }
    .stat-value.big { font-size: 1.6rem; }
    .stat-value-sm { font-size: 1.15rem; }
}
</style>
