<template>
  <div class="stats-grid">
    <div class="stat-block primary-block">
      <div class="stat-top">
        <span class="stat-label">總資產淨值</span>
        <div class="icon-box primary-icon">
          <span class="icon">💰</span>
        </div>
      </div>
      <div class="stat-main">
        <div class="stat-value big">{{ displayTotalValue }}</div>
        <div class="unit-text">TWD</div>
      </div>
      <div class="stat-footer">
        <div class="footer-item">
            <span class="f-label">📈 投入成本</span> 
            <span class="f-val">{{ formatNumber(stats.invested_capital) }}</span>
        </div>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">未實現損益</span>
        <div class="icon-box" :class="unrealizedPnL >= 0 ? 'success-icon' : 'danger-icon'">
          <span class="icon">📈</span>
        </div>
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
        <div class="icon-box" :class="realizedPnL >= 0 ? 'success-icon' : 'danger-icon'">
          <span class="icon">💵</span>
        </div>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="realizedPnL >= 0 ? 'text-green' : 'text-red'">
          {{ realizedPnL >= 0 ? '+' : '' }}{{ displayRealized }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub text-xs">🎯 賣出收益 + 配息收入</span>
      </div>
    </div>
    
    <div class="stat-block highlight-block" :title="pnlTooltip">
      <div class="stat-top">
        <span class="stat-label">{{ pnlLabel }}</span>
        <div class="icon-box warning-icon">
          <span class="icon">⚡</span>
        </div>
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
        <span class="text-sub text-xs">🕒 {{ pnlDescription }}</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">時間加權報酬</span>
        <div class="icon-box info-icon">
          <span class="icon">🎯</span>
        </div>
      </div>
      <div class="stat-main">
        <div class="stat-value">{{ stats.twr || 0 }}<span class="percent">%</span></div>
      </div>
      <div class="stat-footer">
         <span class="text-sub">📉 TWR (策略表現)</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">個人年化報酬</span>
        <div class="icon-box" :class="(stats.xirr || 0) >= 0 ? 'success-icon' : 'danger-icon'">
          <span class="icon">🚀</span>
        </div>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="(stats.xirr || 0) >= 0 ? 'text-green' : 'text-red'">
          {{ (stats.xirr || 0) >= 0 ? '+' : '' }}{{ (stats.xirr || 0).toFixed(2) }}<span class="percent">%</span>
        </div>
      </div>
      <div class="stat-footer">
         <span class="text-sub">💸 XIRR (資金加權)</span>
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
    return '昨晚美股交易損益+今日匈率';
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
  
  if (!history.value || history.value.length < 2) {
    return '0.00';
  }
  
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
    box-shadow: var(--shadow-card);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 140px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

/* 🌈 特殊卡片效果 */
.stat-block::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--primary), var(--primary-light));
    opacity: 0;
    transition: opacity 0.3s ease;
}

.stat-block:hover::before {
    opacity: 1;
}

.primary-block::before {
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
}

.highlight-block::before {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.stat-block:hover { 
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary-light);
}

.primary-block {
    background: linear-gradient(135deg, 
        rgba(59, 130, 246, 0.03) 0%, 
        var(--bg-card) 100%);
}

.highlight-block {
    background: linear-gradient(135deg, 
        rgba(245, 158, 11, 0.03) 0%, 
        var(--bg-card) 100%);
}

/* 📊 內容區域 */
.stat-top { 
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
}

.stat-label { 
    font-size: 0.85rem;
    color: var(--text-sub);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

/* 🎨 圖標設計 */
.icon-box { 
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

.icon-box::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.stat-block:hover .icon-box::before {
    opacity: 1;
}

.icon {
    position: relative;
    z-index: 1;
}

.primary-icon {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05));
}

.success-icon {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
}

.danger-icon {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
}

.warning-icon {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
}

.info-icon {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05));
}

.stat-block:hover .icon-box {
    transform: scale(1.08) rotate(5deg);
}

/* 📊 數據區域 */
.stat-main { 
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 14px;
    flex-grow: 1;
}

.stat-main.column-layout {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

.stat-value {
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 1.85rem;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.1;
    letter-spacing: -0.02em;
    transition: color 0.3s ease;
}

.stat-value.big {
    font-size: 2.1rem;
    font-weight: 800;
}

.stat-sub-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.1rem;
    font-weight: 600;
    opacity: 0.85;
    margin-top: 2px;
    transition: all 0.3s ease;
}

.unit-text, .percent { 
    font-size: 0.95rem;
    color: var(--text-sub);
    font-weight: 600;
    opacity: 0.8;
}

/* 📌 Footer */
.stat-footer {
    padding-top: 12px;
    border-top: 1px solid var(--border-light);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.footer-item { 
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.f-label {
    color: var(--text-sub);
    font-size: 0.8rem;
    font-weight: 500;
}

.f-val { 
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-main);
    font-size: 0.85rem;
}

/* 🏷️ Badge */
.badge { 
    padding: 4px 12px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.8rem;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    transition: all 0.2s ease;
}

.badge-green { 
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.06));
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.badge-red { 
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.06));
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.stat-block:hover .badge {
    transform: scale(1.05);
}

/* 🎨 顏色 */
.text-green { 
    color: var(--success);
    text-shadow: 0 1px 2px rgba(16, 185, 129, 0.2);
}

.text-red { 
    color: var(--danger);
    text-shadow: 0 1px 2px rgba(239, 68, 68, 0.2);
}

.text-sub { 
    color: var(--text-sub);
}

.text-xs { 
    font-size: 0.8rem;
}

/* ========================================
   📱 響應式設計
   ======================================== */

/* 💻 大屏幕 */
@media (min-width: 1400px) {
    .stats-grid {
        gap: 28px;
    }
    
    .stat-block {
        min-height: 150px;
        padding: 24px;
    }
}

/* 🖥️ 中屏幕 */
@media (max-width: 1200px) { 
    .stats-grid { 
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
    }
    
    .stat-block {
        min-height: 130px;
    }
}

/* 📱 手機端 */
@media (max-width: 768px) { 
    .stats-grid { 
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .stat-block {
        min-height: 120px;
        padding: 18px;
        border-radius: var(--radius-md);
    }
    
    .stat-block:hover {
        transform: translateY(-2px);
    }
    
    .stat-value {
        font-size: 1.7rem;
    }
    
    .stat-value.big {
        font-size: 1.9rem;
    }
    
    .stat-sub-value {
        font-size: 1rem;
    }
    
    .icon-box {
        width: 40px;
        height: 40px;
        font-size: 1.3rem;
    }
    
    .stat-label {
        font-size: 0.75rem;
    }
    
    .badge {
        padding: 3px 10px;
        font-size: 0.75rem;
    }
    
    .f-label {
        font-size: 0.75rem;
    }
    
    .f-val {
        font-size: 0.8rem;
    }
}

/* 👍 觸控優化 */
@media (max-width: 480px) {
    .stats-grid {
        gap: 14px;
    }
    
    .stat-block {
        padding: 16px;
        min-height: 110px;
        border-radius: 12px;
    }
    
    .icon-box {
        width: 38px;
        height: 38px;
        font-size: 1.2rem;
        border-radius: 10px;
    }
    
    .stat-label {
        font-size: 0.7rem;
        letter-spacing: 0.05em;
    }
    
    .stat-value {
        font-size: 1.6rem;
    }
    
    .stat-value.big {
        font-size: 1.75rem;
    }
    
    .stat-sub-value {
        font-size: 0.95rem;
    }
    
    .stat-footer {
        padding-top: 10px;
        font-size: 0.75rem;
    }
    
    .badge {
        padding: 2px 8px;
        font-size: 0.7rem;
    }
}

/* 觸控設備優化 */
@media (hover: none) and (pointer: coarse) {
    .stat-block:hover {
        transform: none;
    }
    
    .stat-block:active {
        transform: scale(0.98);
        opacity: 0.95;
    }
    
    .stat-block:hover .icon-box {
        transform: none;
    }
    
    .stat-block:hover .badge {
        transform: none;
    }
}
</style>