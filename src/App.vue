<template>
  <div class="stats-grid">
    <div class="stat-block col-span-full">
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
          總報: {{ totalRoi >= 0 ? '+' : '' }}{{ totalRoi }}%
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
        <span class="text-sub text-tiny">賣出+配息</span>
      </div>
    </div>
    
    <div class="stat-block col-span-full" :title="pnlTooltip">
      <div class="stat-top">
        <span class="stat-label">{{ pnlLabel }}</span>
        <span class="icon-box">⚡</span>
      </div>
      <div class="stat-main row-layout">
        <div class="stat-value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
        </div>
        <div class="stat-roi-text" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
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
         <span class="text-sub text-tiny">策略報酬</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">XIRR</span>
        <span class="icon-box-sm">🚀</span>
      </div>
      <div class="stat-main">
        <div class="stat-value-sm" :class="(stats.xirr || 0) >= 0 ? 'text-green' : 'text-red'">
          {{ (stats.xirr || 0).toFixed(2) }}<span class="percent">%</span>
        </div>
      </div>
      <div class="stat-footer">
         <span class="text-sub text-tiny">年化收益</span>
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

// 基礎損益計算
const totalPnL = computed(() => stats.value.total_pnl || 0);
const realizedPnL = computed(() => stats.value.realized_pnl || 0);
const unrealizedPnL = computed(() => totalPnL.value - realizedPnL.value);

// 計算 ROI (未實現)
const roi = computed(() => {
  if (!stats.value.invested_capital || stats.value.invested_capital === 0) return '0.00';
  return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

// MODIFIED: 新增總資產報酬率 (Total ROI)
const totalRoi = computed(() => {
  if (!stats.value.invested_capital || stats.value.invested_capital === 0) return '0.00';
  return ((totalPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

// 美股開盤邏輯
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
const pnlDescription = computed(() => isUSMarketOpen.value ? '包含今日股價與匯率影響' : '對比昨日收盤變化');
const pnlTooltip = computed(() => '使用當日交易與收盤價進行 Modified Dietz 計算');

// 今日損益加總
const dailyPnL = computed(() => {
  return holdings.value.reduce((sum, h) => sum + (h.daily_pl_twd || 0), 0);
});

// 今日報酬率百分比
const dailyRoi = computed(() => {
  const yesterdayValue = (stats.value.total_value || 0) - dailyPnL.value;
  if (!yesterdayValue || yesterdayValue <= 0) return '0.00';
  return ((dailyPnL.value / yesterdayValue) * 100).toFixed(2);
});

// MODIFIED: 數字動畫優化 - 處理大數與小數
const useAnimatedNumber = (targetVal, isCurrency = true) => {
  const current = ref(0);
  watch(targetVal, (newVal) => {
    if (newVal == null) return;
    current.value = Number(newVal);
  }, { immediate: true });
  
  return computed(() => {
    if (isCurrency) return Math.round(current.value).toLocaleString('zh-TW');
    return current.value.toFixed(2);
  });
};

const displayTotalValue = useAnimatedNumber(computed(() => stats.value.total_value));
const displayUnrealized = useAnimatedNumber(unrealizedPnL);
const displayRealized = useAnimatedNumber(realizedPnL);
const displayDaily = useAnimatedNumber(dailyPnL);

const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW');
</script>

<style scoped>
.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px; /* MODIFIED: 縮小間距提升緊湊感 */
}

.stat-block {
    background: var(--bg-card);
    padding: 16px; /* MODIFIED: 縮小內距 */
    border-radius: 16px; /* MODIFIED: 圓角更柔和 */
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 100px; /* MODIFIED: 降低高度 */
    transition: transform 0.2s, box-shadow 0.2s;
    user-select: none;
}

.stat-block:active { 
    transform: scale(0.98); /* MODIFIED: 增加點擊反饋 */
}

.stat-top { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 8px; 
}

.stat-label { 
    font-size: 0.8rem; /* MODIFIED: 標籤更細小 */
    color: var(--text-sub); 
    font-weight: 700; 
    letter-spacing: 0.02em;
}

.icon-box { 
    width: 32px; height: 32px; 
    border-radius: 8px; 
    background: var(--bg-secondary);
    display: flex; align-items: center; justify-content: center; 
    font-size: 1.1rem;
}

.icon-box-sm {
    font-size: 0.9rem;
    opacity: 0.8;
}

.stat-main { 
    display: flex; 
    align-items: baseline; 
    gap: 4px; 
    margin-bottom: 8px; 
    flex-grow: 1;
}

.stat-main.row-layout {
    flex-direction: row;
    align-items: center;
    gap: 10px;
}

.stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text-main);
}

.stat-value-sm {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-main);
}

.stat-value.big { font-size: 1.8rem; }

.stat-roi-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.1rem;
    font-weight: 700;
}

.unit-text, .percent { font-size: 0.8rem; color: var(--text-sub); }

.stat-footer {
    padding-top: 8px;
    border-top: 1px dashed var(--border-color); /* MODIFIED: 改為虛線更有設計感 */
    font-size: 0.75rem;
    display: flex; 
    align-items: center; 
    justify-content: space-between;
}

.f-val { font-weight: 700; font-family: 'JetBrains Mono', monospace; }

.text-green { color: #10b981; }
.text-red { color: #ef4444; }
.text-tiny { font-size: 0.7rem; color: var(--text-sub); }

.badge-mini { font-weight: 700; }

.badge-compact { 
    padding: 2px 6px; border-radius: 4px; 
    font-weight: 800; font-size: 0.75rem; 
}

.badge-green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.badge-red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

/* MODIFIED: 響應式佈局調整 */
@media (max-width: 1024px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
    .stats-grid { 
        grid-template-columns: repeat(2, 1fr); /* 手機端維持 2 欄 */
        gap: 10px; 
    }
    
    .col-span-full {
        grid-column: span 2; /* 重要指標佔滿全寬 */
    }

    .stat-block {
        padding: 12px;
        min-height: 90px;
    }

    .stat-value { font-size: 1.4rem; }
    .stat-value.big { font-size: 1.6rem; }
    .stat-value-sm { font-size: 1.1rem; }
}
</style>
