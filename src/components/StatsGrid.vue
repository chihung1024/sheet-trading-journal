<template>
  <div class="stats-grid">
    <!-- 1. 總資產 -->
    <div class="stat-block primary">
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
      </div>
    </div>
    
    <!-- 2. 未實現損益 -->
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
    
    <!-- 3. 今日損益（基於持倉計算） -->
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
    
    <!-- 4. 總報酬率 -->
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">總報酬率 (TWR)</span>
        <span class="icon-box">🎯</span>
      </div>
      <div class="stat-main">
        <div class="stat-value">{{ stats.twr || 0 }}<span class="percent">%</span></div>
      </div>
      <div class="stat-footer">
         <span class="text-sub">SPY: </span>
         <strong>{{ stats.benchmark_twr || '-' }}%</strong>
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
const holdings = computed(() => store.holdings || []);

// 計算未實現損益
const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));

// 計算 ROI
const roi = computed(() => {
  if (!stats.value.invested_capital) return '0.00';
  return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

// 判斷目前是否為美股盤中時間 (台灣時間 21:30 - 05:00)
const isUSMarketOpen = computed(() => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // 晚上 9:30 後 或 凌晨 5:00 前
  if (hour >= 21 || hour < 5) {
    if (hour === 21 && minute < 30) return false;
    return true;
  }
  return false;
});

// 動態標題
const pnlLabel = computed(() => {
  return isUSMarketOpen.value ? '美股盤中損益' : '今日損益 (Est.)';
});

// 動態說明
const pnlDescription = computed(() => {
  if (isUSMarketOpen.value) {
    return '今日台股 + 即時美股 + 匯率';
  } else {
    return '昨晚美股 + 今日台股 + 匯率';
  }
});

// Tooltip 完整說明
const pnlTooltip = computed(() => {
  if (isUSMarketOpen.value) {
    return '今日台股收盤 + 美股盤中變化 + 匯率波動';
  } else {
    return '昨晚美股收盤 + 今日台股變化 + 匯率波動';
  }
});

// ✅ 核心計算：基於時間段的損益計算
const dailyPnL = computed(() => {
  const currentFxRate = stats.value.exchange_rate || 32.5;
  
  // ✅ 修正：白天時使用 History 快照計算（包含台股+匯率變化）
  // 這樣能與曲線圖保持一致
  if (!isUSMarketOpen.value) {
    if (history.value.length < 2) return 0;
    
    const latest = history.value[history.value.length - 1];
    const previous = history.value[history.value.length - 2];
    
    // 計算淨損益的變化（完整反映股價+匯率）
    return (latest.net_profit - previous.net_profit);
  }
  
  // ✅ 美股盤中時：使用持倉級別的精確計算
  // 計算每檔股票的日內變化 (僅股價變動，匯率使用當下最新)
  if (holdings.value.length > 0 && holdings.value[0].daily_change_usd !== undefined) {
    const totalDailyPnL = holdings.value.reduce((sum, holding) => {
      const stockDailyPnL = holding.daily_change_usd * holding.qty * currentFxRate;
      return sum + stockDailyPnL;
    }, 0);
    
    return totalDailyPnL;
  }
  
  // Fallback: 無數據時返回 0
  return 0;
});

// 計算今日損益百分比
const dailyRoi = computed(() => {
  // 使用昨日總資產作為基準
  if (history.value.length < 2) return '0.00';
  const previous = history.value[history.value.length - 2];
  
  if (!previous.total_value || previous.total_value === 0) return '0.00';
  return ((dailyPnL.value / previous.total_value) * 100).toFixed(2);
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
const displayDaily = useAnimatedNumber(dailyPnL);

const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW');
</script>

<style scoped>
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr); 
    gap: 24px;
}

.stat-block {
    background: var(--bg-card);
    padding: 24px;
    border-radius: var(--radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-card);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 150px;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
}

.stat-block:hover { 
    transform: translateY(-4px); 
    box-shadow: var(--shadow-lg); 
}

.stat-block.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
}

html.dark .stat-block.primary {
    background: linear-gradient(135deg, #4c1d95 0%, #5b21b6 100%);
}

.stat-block.primary .stat-label { color: rgba(255,255,255,0.9); }
.stat-block.primary .stat-value { color: #fff; }
.stat-block.primary .stat-footer { 
    border-top-color: rgba(255,255,255,0.2); 
    color: rgba(255,255,255,0.9); 
}
.stat-block.primary .icon-box { 
    background: rgba(255,255,255,0.2); 
}

.stat-top { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
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
    width: 40px; 
    height: 40px; 
    border-radius: 12px; 
    background: var(--bg-secondary);
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-size: 1.3rem;
    transition: transform 0.2s ease;
}

.stat-block:hover .icon-box {
    transform: scale(1.1);
}

.stat-main { 
    display: flex; 
    align-items: baseline; 
    gap: 6px; 
    margin-bottom: 12px; 
    flex-grow: 1;
}

.stat-main.column-layout {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
}

.stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.75rem;
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
    font-size: 1rem;
    font-weight: 600;
    opacity: 0.9;
    margin-top: 4px;
}

.unit-text, .percent { 
    font-size: 0.9rem; 
    color: var(--text-sub); 
    font-weight: 500; 
}

.stat-block.primary .unit-text { 
    color: rgba(255,255,255,0.8); 
}

.stat-footer {
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
    font-size: 0.8rem;
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

.stat-block.primary .f-label,
.stat-block.primary .f-val {
    color: rgba(255,255,255,0.9);
}

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-sub { color: var(--text-sub); }
.text-xs { font-size: 0.75rem; }

.badge { 
    padding: 4px 12px; 
    border-radius: 20px; 
    font-weight: 600; 
    font-size: 0.75rem; 
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

@media (max-width: 1400px) { 
    .stats-grid { 
        grid-template-columns: repeat(2, 1fr); 
    } 
}

@media (max-width: 768px) { 
    .stats-grid { 
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .stat-block {
        min-height: 130px;
        padding: 20px;
    }
    
    .stat-value {
        font-size: 1.5rem;
    }
    
    .stat-value.big {
        font-size: 1.75rem;
    }
}

@media (max-width: 480px) {
    .icon-box {
        width: 36px;
        height: 36px;
        font-size: 1.1rem;
    }
    
    .stat-label {
        font-size: 0.75rem;
    }
}
</style>