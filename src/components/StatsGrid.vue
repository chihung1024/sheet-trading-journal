<template>
  <div class="stats-grid">
    <!-- 1️⃣ 總資產淨值 -->
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
            <span class="f-label">投入成本</span> 
            <span class="f-val">{{ formatNumber(stats.invested_capital) }}</span>
        </div>
      </div>
    </div>
    
    <!-- 2️⃣ 未實現損益 -->
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
    
    <!-- 3️⃣ 已實現損益 -->
    <div class="stat-block" :class="getPnlBgClass(realizedPnL)">
      <div class="stat-top">
        <span class="stat-label">已實現損益</span>
        <span class="icon-box">💵</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(realizedPnL)">
          {{ realizedPnL >= 0 ? '+' : '' }}{{ displayRealized }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-xs footer-desc">賣出收益 + 配息</span>
      </div>
    </div>
    
    <!-- 4️⃣ 當日損益 + 即時匯率變動 -->
    <div class="stat-block daily-pnl-block" :class="getPnlBgClass(totalDailyPnL)" :title="pnlTooltipEnhanced">
      <div class="stat-top">
        <span class="stat-label">{{ pnlLabel }}</span>
        <span class="icon-box" :class="{ 'pulse-icon': isUSMarketOpen }">⚡</span>
      </div>
      <div class="stat-main column-layout">
        <div class="stat-value" :class="getPnlTextClass(totalDailyPnL)">
          {{ totalDailyPnL >= 0 ? '+' : '' }}{{ displayTotalDaily }}
        </div>
        <div class="stat-sub-value" :class="getPnlTextClass(totalDailyPnL)">
          ({{ totalDailyPnL >= 0 ? '+' : '' }}{{ dailyRoi }}%)
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-xs footer-desc">{{ pnlDescription }}</span>
      </div>
    </div>
    
    <!-- 5️⃣ 時間加權報酬率 -->
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">時間加權報酬</span>
        <span class="icon-box">🎯</span>
      </div>
      <div class="stat-main">
        <div class="stat-value">{{ stats.twr || 0 }}<span class="percent">%</span></div>
      </div>
      <div class="stat-footer">
         <span class="text-sub text-xs">TWR (策略表現)</span>
      </div>
    </div>
    
    <!-- 6️⃣ 個人年化報酬率 -->
    <div class="stat-block" :class="getPnlBgClass(stats.xirr)">
      <div class="stat-top">
        <span class="stat-label">個人年化報酬</span>
        <span class="icon-box">🚀</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="getPnlTextClass(stats.xirr)">
          {{ (stats.xirr || 0) >= 0 ? '+' : '' }}{{ (stats.xirr || 0).toFixed(2) }}<span class="percent">%</span>
        </div>
      </div>
      <div class="stat-footer">
         <span class="text-sub text-xs">XIRR (資金加權)</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

// ✅ 直接從 store 獲取數據，不再重複計算
const stats = computed(() => store.stats || {});
const history = computed(() => store.history || []);

// ✅ 總損益：從後端獲取
const totalPnL = computed(() => stats.value.total_pnl || 0);

// ✅ 已實現損益：從後端獲取
const realizedPnL = computed(() => stats.value.realized_pnl || 0);

// ✅ 未實現損益 = 總損益 - 已實現損益
const unrealizedPnL = computed(() => totalPnL.value - realizedPnL.value);

// ✅ ROI 計算
const roi = computed(() => {
  if (!stats.value.invested_capital) return '0.00';
  return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

// ✅ 當日損益：統一使用 store.dailyPnL
const dailyPnL = computed(() => store.dailyPnL || 0);
const dailyPnlBreakdown = computed(() => stats.value.daily_pnl_breakdown || null);

// ✅ [v3.18.1] 即時匯率變動追蹤
const liveMtmDelta = computed(() => store.liveMtmDelta || 0);
const liveMtmBreakdown = computed(() => store.liveMtmDeltaBreakdown || null);
const liveMtmRefDate = computed(() => store.liveMtmRefTimestamp || '');

// ✅ [v3.18.1] 當日損益總額 = 交易損益 + 匯率變動
const totalDailyPnL = computed(() => dailyPnL.value + liveMtmDelta.value);

const formatSigned = (val) => {
  const n = Number(val) || 0;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Math.round(n).toLocaleString('zh-TW')}`;
};

// ✅ 判斷目前是否為美股盤中時間 (台灣時間 21:30 - 05:00)
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

// 動態標題
const pnlLabel = computed(() => {
  return isUSMarketOpen.value ? '美股盤中損益' : '當日損益';
});

// 動態說明
const pnlDescription = computed(() => {
  if (isUSMarketOpen.value) {
    return '盤中損益(含交易+即時價格)';
  } else {
    return '台股損益+美股損益+匯率因素';
  }
});

// ✅ [v3.18.1] 增強版 Tooltip：顯示台/美分量 + 匯率變動
const pnlTooltipEnhanced = computed(() => {
  const lines = [];
  
  // 交易損益分量
  if (dailyPnlBreakdown.value) {
    const tw = dailyPnlBreakdown.value.tw_pnl_twd ?? 0;
    const us = dailyPnlBreakdown.value.us_pnl_twd ?? 0;
    lines.push(`交易損益 - 台股: ${formatSigned(tw)} | 美股: ${formatSigned(us)}`);
  }
  
  // 匯率變動分量
  if (liveMtmBreakdown.value && (liveMtmBreakdown.value.tw !== 0 || liveMtmBreakdown.value.us !== 0)) {
    const tw = liveMtmBreakdown.value.tw ?? 0;
    const us = liveMtmBreakdown.value.us ?? 0;
    lines.push(`匯率變動 - 台股: ${formatSigned(tw)} | 美股: ${formatSigned(us)}`);
    if (liveMtmRefDate.value) {
      lines.push(`(vs ${liveMtmRefDate.value})`);
    }
  }
  
  return lines.join('\n');
});

// ✅ 計算今日損益百分比（使用總額）
const dailyRoi = computed(() => {
  let baseValue = 0;
  
  if (!history.value || history.value.length < 2) {
    return '0.00';
  }
  
  if (isUSMarketOpen.value) {
    // 使用昨日收盤
    baseValue = history.value[history.value.length - 2].total_value || 0;
  } else {
    // 使用前日收盤
    if (history.value.length >= 3) {
      baseValue = history.value[history.value.length - 3].total_value || 0;
    } else {
      baseValue = history.value[history.value.length - 2].total_value || 0;
    }
  }
  
  if (!baseValue || baseValue === 0) return '0.00';
  return ((totalDailyPnL.value / baseValue) * 100).toFixed(2);
});

// 數字動畫
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
const displayTotalDaily = useAnimatedNumber(totalDailyPnL);

const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW');

// 樣式輔助函數
const getPnlTextClass = (val) => {
    const num = Number(val) || 0;
    return num >= 0 ? 'text-green' : 'text-red';
};

const getPnlBgClass = (val) => {
    const num = Number(val) || 0;
    if (num === 0) return '';
    return num > 0 ? 'bg-gradient-green' : 'bg-gradient-red';
};
</script>

<style scoped>
/* 核心 Grid 佈局 */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr); /* 桌面版 3 欄 */
    gap: 20px;
}

.stat-block {
    background: var(--bg-card);
    padding: 20px;
    border-radius: var(--radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-card);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 120px;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
}

/* 懸停效果 */
.stat-block:hover { 
    transform: translateY(-3px); 
    box-shadow: var(--shadow-lg); 
}

/* 特殊卡片樣式：總資產 */
.primary-block {
    border-left: 4px solid var(--primary);
}

/* 背景微漸層 */
.bg-gradient-green {
    background: linear-gradient(145deg, var(--bg-card) 40%, rgba(16, 185, 129, 0.05) 100%);
    border-bottom: 2px solid rgba(16, 185, 129, 0.2);
}

.bg-gradient-red {
    background: linear-gradient(145deg, var(--bg-card) 40%, rgba(239, 68, 68, 0.05) 100%);
    border-bottom: 2px solid rgba(239, 68, 68, 0.2);
}

/* 頂部區域 */
.stat-top { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 12px; 
}

.stat-label { 
    font-size: 0.9rem; 
    color: var(--text-sub); 
    font-weight: 600; 
    text-transform: uppercase;
    letter-spacing: 0.02em;
}

/* Icon Box 優化 */
.icon-box { 
    width: 38px; 
    height: 38px; 
    border-radius: 10px; 
    background: var(--bg-secondary);
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-size: 1.25rem;
    transition: transform 0.2s ease, background 0.2s;
}

.icon-box.highlight {
    background: rgba(59, 130, 246, 0.1);
}

.pulse-icon {
    animation: pulse-light 2s infinite;
}

@keyframes pulse-light {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
}

/* 主要數值區 */
.stat-main { 
    display: flex; 
    align-items: baseline; 
    gap: 6px; 
    margin-bottom: 8px; 
    flex-grow: 1;
}

.stat-main.column-layout {
    flex-direction: column;
    align-items: flex-start;
    gap: 0px;
}

.stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.1;
    letter-spacing: -0.02em;
}

.stat-value.big {
    font-size: 2.2rem;
}

/* 總資產的特殊漸層效果 */
.primary-block .stat-value.big {
    background: linear-gradient(90deg, var(--text-main), var(--text-sub));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
}

.stat-sub-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    font-weight: 600;
    opacity: 0.85;
    margin-top: 4px;
}

.unit-text, .percent { 
    font-size: 0.85rem; 
    color: var(--text-sub); 
    font-weight: 500; 
}

/* 底部區域 */
.stat-footer {
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
    font-size: 0.85rem;
    display: flex; 
    align-items: center; 
    justify-content: space-between;
    min-height: 32px;
}

.footer-item { 
    display: flex; 
    align-items: center; 
    gap: 6px; 
    width: 100%;
    justify-content: space-between;
}

.f-label { color: var(--text-sub); }
.f-val { 
    font-weight: 600; 
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-main);
}

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-sub { color: var(--text-sub); }
.text-xs { font-size: 0.8rem; }

/* 徽章樣式 */
.badge { 
    padding: 2px 8px; 
    border-radius: 6px; 
    font-weight: 600; 
    font-size: 0.8rem; 
    display: inline-flex; 
    align-items: center; 
}

.badge-green { 
    background: rgba(16, 185, 129, 0.12); 
    color: var(--success);
}

.badge-red { 
    background: rgba(239, 68, 68, 0.12); 
    color: var(--danger);
}

/* RWD: 中尺寸螢幕 (Tablets) */
@media (max-width: 1024px) { 
    .stats-grid { 
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    } 
    .stat-value.big { font-size: 2rem; }
}

/* RWD: 手機版優化 (Mobile) - 使用 order 重新排序 */
@media (max-width: 768px) { 
    .stats-grid { 
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
    
    .stat-block {
        padding: 14px;
        min-height: 100px;
    }
    
    /* ✅ 使用 CSS Grid order 重新排序，保持 DOM 結構不變 */
    /* 1️⃣ 總資產淨值 - 第一行獨佔 */
    .stat-block:nth-child(1) {
        order: 1;
        grid-column: span 2;
    }
    
    /* 2️⃣ 當日損益 - 第二行獨佔（提升為第二重要） */
    .stat-block.daily-pnl-block {
        order: 2;
        grid-column: span 2;
        border-left: 4px solid var(--warning);
    }
    
    /* 3️⃣ 未實現損益 - 第三行左側 */
    .stat-block:nth-child(2) {
        order: 3;
    }
    
    /* 4️⃣ 已實現損益 - 第三行右側 */
    .stat-block:nth-child(3) {
        order: 4;
    }
    
    /* 5️⃣ TWR - 第四行左側 */
    .stat-block:nth-child(5) {
        order: 5;
    }
    
    /* 6️⃣ XIRR - 第四行右側 */
    .stat-block:nth-child(6) {
        order: 6;
    }
    
    /* 當日損益在手機版放大字體 */
    .daily-pnl-block .stat-value {
        font-size: 1.8rem;
    }

    .stat-top { margin-bottom: 8px; }
    .stat-label { font-size: 0.75rem; }
    
    .icon-box { 
        width: 30px; 
        height: 30px; 
        font-size: 1rem;
        border-radius: 8px;
    }
    
    .stat-value { font-size: 1.4rem; }
    .stat-value.big { font-size: 1.8rem; }
    .stat-sub-value { font-size: 0.9rem; }
    
    .stat-footer { 
        padding-top: 8px; 
        min-height: auto;
    }
    
    /* 手機上隱藏過長說明 */
    .footer-desc {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        display: block;
    }
}
</style>
