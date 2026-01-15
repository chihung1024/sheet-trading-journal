<template>
  <div class="stats-grid">
    <div class="stat-block">
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
            <span class="f-val">{{ formatNumber(summary.invested_capital) }}</span>
        </div>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">未實現損益</span>
        <span class="icon-box">📈</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="unrealizedPnL >= 0 ? 'text-green' : 'text-red'">
          {{ unrealizedPnL >= 0 ? '+' : '' }}{{ displayUnrealized }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="badge" :class="roi >= 0 ? 'badge-green' : 'badge-red'">
            ROI: {{ roi }}%
        </span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">已實現損益</span>
        <span class="icon-box">💵</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="realizedPnL >= 0 ? 'text-green' : 'text-red'">
          {{ realizedPnL >= 0 ? '+' : '' }}{{ displayRealized }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-xs">賣出收益 + 配息收入</span>
      </div>
    </div>
    
    <div class="stat-block" :title="pnlTooltip">
      <div class="stat-top">
        <span class="stat-label">{{ pnlLabel }}</span>
        <span class="icon-box">⚡</span>
      </div>
      <div class="stat-main column-layout">
        <div class="stat-value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
        </div>
        <div class="stat-sub-value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
          ({{ dailyPnL >= 0 ? '+' : '' }}{{ dailyRoi }}%)
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-xs">{{ pnlDescription }}</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">時間加權報酬</span>
        <span class="icon-box">🎯</span>
      </div>
      <div class="stat-main">
        <div class="stat-value">{{ summary.twr || 0 }}<span class="percent">%</span></div>
      </div>
      <div class="stat-footer">
         <span class="text-sub">TWR (策略表現)</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">個人年化報酬</span>
        <span class="icon-box">🚀</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="(summary.xirr || 0) >= 0 ? 'text-green' : 'text-red'">
          {{ (summary.xirr || 0) >= 0 ? '+' : '' }}{{ (summary.xirr || 0).toFixed(2) }}<span class="percent">%</span>
        </div>
      </div>
      <div class="stat-footer">
         <span class="text-sub">XIRR (資金加權)</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();

// 【關鍵修改】對接新的 Store Getter 架構
// 原本是 store.stats，現在改為 store.summary (對應 GroupStats.summary)
const summary = computed(() => store.summary || {});
const holdings = computed(() => store.holdings || []);

// 從 summary 中取得總損益與已實現損益
const totalPnL = computed(() => summary.value.total_pnl || 0);
const realizedPnL = computed(() => summary.value.realized_pnl || 0);

// 計算未實現損益
const unrealizedPnL = computed(() => totalPnL.value - realizedPnL.value);

// 計算 ROI
const roi = computed(() => {
  if (!summary.value.invested_capital) return '0.00';
  return ((unrealizedPnL.value / summary.value.invested_capital) * 100).toFixed(2);
});

// 判斷美股盤中時間 (21:30 - 05:00)
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
const pnlDescription = computed(() => isUSMarketOpen.value ? '包含今日股價、匯率及交易影響' : '包含昨日股價、今日匯率變化');
const pnlTooltip = computed(() => '使用 Modified Dietz 方法計算，正確處理當日交易、股價變動及匯率影響');

// 計算今日損益 (加總所有持倉的 daily_pl_twd)
// 注意：store.holdings 已經是根據當前群組篩選過的，所以這裡的加總也是該群組的今日損益
const dailyPnL = computed(() => {
  return holdings.value.reduce((sum, holding) => {
    return sum + (holding.daily_pl_twd || 0);
  }, 0);
});

// 計算今日 ROI
const dailyRoi = computed(() => {
  const yesterdayValue = summary.value.total_value - dailyPnL.value;
  if (!yesterdayValue || yesterdayValue === 0) return '0.00';
  return ((dailyPnL.value / yesterdayValue) * 100).toFixed(2);
});

// 數字動畫 Hook
const useAnimatedNumber = (targetVal) => {
  const current = ref(0);
  watch(targetVal, (newVal) => {
    if (newVal == null) return;
    current.value = Number(newVal);
  }, { immediate: true });
  return computed(() => Math.round(current.value).toLocaleString('zh-TW'));
};

const displayTotalValue = useAnimatedNumber(computed(() => summary.value.total_value));
const displayUnrealized = useAnimatedNumber(unrealizedPnL);
const displayRealized = useAnimatedNumber(realizedPnL);
const displayDaily = useAnimatedNumber(dailyPnL);

const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW');
</script>

<style scoped>
.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
}

.stat-block {
    background: var(--bg-card);
    padding: 18px 20px;
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

.stat-block:hover { 
    transform: translateY(-2px); 
    box-shadow: var(--shadow-lg); 
}

.stat-top { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 10px; 
}

.stat-label { 
    font-size: 0.9rem; 
    color: var(--text-sub); 
    font-weight: 600; 
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.icon-box { 
    width: 36px; 
    height: 36px; 
    border-radius: 10px; 
    background: var(--bg-secondary);
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-size: 1.2rem;
    transition: transform 0.2s ease;
}

.stat-block:hover .icon-box {
    transform: scale(1.1);
}

.stat-main { 
    display: flex; 
    align-items: baseline; 
    gap: 6px; 
    margin-bottom: 10px; 
    flex-grow: 1;
}

.stat-main.column-layout {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
}

.stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.1;
    letter-spacing: -0.03em;
}

.stat-value.big {
    font-size: 2rem;
}

.stat-sub-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.05rem;
    font-weight: 600;
    opacity: 0.9;
    margin-top: 2px;
}

.stat-sub-text {
    font-size: 0.8rem;
    color: var(--text-sub);
    font-weight: 500;
    margin-top: 2px;
    opacity: 0.9;
}

.unit-text, .percent { 
    font-size: 0.95rem; 
    color: var(--text-sub); 
    font-weight: 500; 
}

.stat-footer {
    padding-top: 10px;
    border-top: 1px solid var(--border-color);
    font-size: 0.85rem;
    display: flex; 
    align-items: center; 
    justify-content: space-between;
}

.footer-item { 
    display: flex; 
    align-items: center; 
    gap: 6px; 
}

.f-label {
    color: var(--text-sub);
}

.f-val { 
    font-weight: 600; 
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-main);
}

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-sub { color: var(--text-sub); }
.text-xs { font-size: 0.8rem; }

.badge { 
    padding: 3px 10px; 
    border-radius: 16px; 
    font-weight: 600; 
    font-size: 0.8rem; 
    display: inline-flex; 
    align-items: center; 
}

.badge-green { 
    background: rgba(16, 185, 129, 0.1); 
    color: var(--success);
    border: 1px solid var(--success);
}

.badge-red { 
    background: rgba(239, 68, 68, 0.1); 
    color: var(--danger);
    border: 1px solid var(--danger);
}

@media (max-width: 1200px) { 
    .stats-grid { 
        grid-template-columns: repeat(2, 1fr);
    } 
}

@media (max-width: 768px) { 
    .stats-grid { 
        grid-template-columns: 1fr;
        gap: 14px;
    }
    
    .stat-block {
        min-height: 110px;
        padding: 16px 18px;
    }
    
    .stat-value {
        font-size: 1.6rem;
    }
    
    .stat-value.big {
        font-size: 1.8rem;
    }
}

@media (max-width: 480px) {
    .icon-box {
        width: 32px;
        height: 32px;
        font-size: 1.1rem;
    }
    
    .stat-label {
        font-size: 0.8rem;
    }
}
</style>
