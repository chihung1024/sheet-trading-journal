<template>
  <div class="stats-grid">
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">總資產淨值</span>
        <span class="icon-box net-worth">💰</span>
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
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">未實現損益</span>
        <span class="icon-box unrealized">📈</span>
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
        <span class="icon-box realized">💵</span>
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
        <span class="icon-box daily">⚡</span>
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
        <span class="icon-box twr">🎯</span>
      </div>
      <div class="stat-main">
        <div class="stat-value">{{ stats.twr || 0 }}<span class="percent">%</span></div>
      </div>
      <div class="stat-footer">
         <span class="text-sub">TWR (策略表現)</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">個人年化報酬</span>
        <span class="icon-box xirr">🚀</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="(stats.xirr || 0) >= 0 ? 'text-green' : 'text-red'">
          {{ (stats.xirr || 0) >= 0 ? '+' : '' }}{{ (stats.xirr || 0).toFixed(2) }}<span class="percent">%</span>
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

const stats = computed(() => store.stats || {});
const history = computed(() => store.history || []);

const totalPnL = computed(() => stats.value.total_pnl || 0);
const realizedPnL = computed(() => stats.value.realized_pnl || 0);
const unrealizedPnL = computed(() => totalPnL.value - realizedPnL.value);

const roi = computed(() => {
  if (!stats.value.invested_capital) return '0.00';
  return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

const dailyPnL = computed(() => store.dailyPnL || 0);

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

const pnlLabel = computed(() => {
  return isUSMarketOpen.value ? '美股盤中損益' : '當日損益';
});

const pnlDescription = computed(() => {
  if (isUSMarketOpen.value) {
    return '盤中損益(含交易+即時價格)';
  } else {
    return '昨晚美股交易損益+今日匯率';
  }
});

const pnlTooltip = computed(() => {
  if (isUSMarketOpen.value) {
    return '美股盤中:今日市值 - 昨日市值 - 今日現金流';
  } else {
    return '美股收盤:今日市值 - 前日市值 - 昨晚現金流';
  }
});

const dailyRoi = computed(() => {
  let baseValue = 0;
  if (!history.value || history.value.length < 2) return '0.00';
  
  if (isUSMarketOpen.value) {
    baseValue = history.value[history.value.length - 2].total_value || 0;
  } else {
    if (history.value.length >= 3) {
      baseValue = history.value[history.value.length - 3].total_value || 0;
    } else {
      baseValue = history.value[history.value.length - 2].total_value || 0;
    }
  }
  
  if (!baseValue || baseValue === 0) return '0.00';
  return ((dailyPnL.value / baseValue) * 100).toFixed(2);
});

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
.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
}

.stat-block {
    background: var(--bg-card);
    padding: 20px;
    border-radius: var(--radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 140px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

.stat-block:hover { 
    transform: translateY(-4px); 
    box-shadow: var(--shadow-lg); 
    border-color: var(--primary);
}

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
    letter-spacing: 0.05em;
}

.icon-box { 
    width: 40px; 
    height: 40px; 
    border-radius: 12px; 
    background: var(--bg-secondary);
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-size: 1.25rem;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.stat-block:hover .icon-box { transform: scale(1.15) rotate(5deg); }

/* Icon specific bg colors for better visuals */
.icon-box.net-worth { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.icon-box.unrealized { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.icon-box.realized { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.icon-box.daily { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

.stat-main { 
    display: flex; 
    align-items: baseline; 
    gap: 6px; 
    margin-bottom: 16px; 
    flex-grow: 1;
}

.stat-main.column-layout {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

.stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.1;
    letter-spacing: -0.03em;
}

.stat-value.big { font-size: 2rem; }

.stat-sub-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    font-weight: 600;
    opacity: 0.9;
}

.unit-text, .percent { font-size: 0.9rem; color: var(--text-sub); font-weight: 500; margin-left: 4px; }

.stat-footer {
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
    font-size: 0.85rem;
    display: flex; 
    align-items: center; 
    justify-content: space-between;
}

.footer-item { display: flex; align-items: center; gap: 6px; }
.f-label { color: var(--text-sub); }
.f-val { font-weight: 600; font-family: 'JetBrains Mono', monospace; color: var(--text-main); }

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-sub { color: var(--text-sub); }
.text-xs { font-size: 0.8rem; }

.badge { 
    padding: 2px 8px; 
    border-radius: 6px; 
    font-weight: 600; 
    font-size: 0.8rem; 
    display: inline-flex; 
    align-items: center; 
}

.badge-green { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.badge-red { background: rgba(239, 68, 68, 0.15); color: var(--danger); }

@media (max-width: 1024px) { 
    .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; } 
}

@media (max-width: 640px) { 
    .stats-grid { grid-template-columns: 1fr; gap: 16px; }
    .stat-block { padding: 16px; min-height: 120px; }
    .stat-value { font-size: 1.6rem; }
    .stat-value.big { font-size: 1.8rem; }
}
</style>
