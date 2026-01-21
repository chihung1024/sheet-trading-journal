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
            <span class="f-val">{{ formatNumber(stats.invested_capital) }}</span>
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
        <div class="stat-value">{{ stats.twr || 0 }}<span class="percent">%</span></div>
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
const records = computed(() => store.records || []);
const rawData = computed(() => store.rawData || {});

// ✅ 修正：直接使用後端計算好的 total_pnl
const totalPnL = computed(() => stats.value.total_pnl || 0);

// 計算已實現損益 (從後端 API 獲取)
const realizedPnL = computed(() => stats.value.realized_pnl || 0);

// ✅ 修正：未實現損益 = 總損益 - 已實現損益
const unrealizedPnL = computed(() => totalPnL.value - realizedPnL.value);

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
  return isUSMarketOpen.value ? '美股盤中損益' : '當日損益';
});

// 動態說明
const pnlDescription = computed(() => {
  if (isUSMarketOpen.value) {
    return '盤中損益（含交易+即時價格）';
  } else {
    return '昨晚美股交易損益+今日匯率';
  }
});

// Tooltip 完整說明
const pnlTooltip = computed(() => {
  if (isUSMarketOpen.value) {
    return '美股盤中：今日市值 - 昨日市值 - 今日現金流';
  } else {
    return '美股收盤：今日市值 - 前日市值 - 昨晚現金流';
  }
});

// 獲取今天的日期字串 (YYYY-MM-DD)
const getTodayDateString = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

// 獲取昨天的日期字串 (YYYY-MM-DD)
const getYesterdayDateString = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

// 🐛 修正：使用 snapshot 中的匯率來計算 TWD 現金流
const calculateCashFlow = (targetDate) => {
  if (!records.value || records.value.length === 0) return 0;
  
  // 🔧 從 rawData 中獲取匯率（後端計算快照時傲存储）
  const exchangeRate = rawData.value?.exchange_rate || 32; // 預設 32
  
  let cashFlow = 0;
  let matchCount = 0;
  
  records.value.forEach(record => {
    // 使用 txn_date
    const recordDate = record.txn_date ? record.txn_date.split('T')[0] : '';
    
    // 只計算目標日期的交易
    if (recordDate !== targetDate) return;
    
    matchCount++;
    
    // 計算 USD 成本
    const qty = record.qty || 0;
    const price = record.price || 0;
    const fee = record.fee || 0;
    const tax = record.tax || 0;
    const totalCostUSD = qty * price + fee + tax;
    
    // 🔧 轉換為 TWD
    const totalCostTWD = totalCostUSD * exchangeRate;
    
    if (record.txn_type === 'BUY') {
      // 買入：現金流出（正數）
      cashFlow += totalCostTWD;
    } else if (record.txn_type === 'SELL') {
      // 賣出：現金流入（負數）
      cashFlow -= totalCostTWD;
    }
  });
  
  console.log(`[現金流計算] 日期=${targetDate}, 匯率=${exchangeRate.toFixed(2)}, 匹配筆數=${matchCount}, 淨現金流=${cashFlow.toLocaleString()} TWD`);
  
  return cashFlow;
};

// ✅ 最終方案：時段感知的當日損益計算
const dailyPnL = computed(() => {
  const todayValue = stats.value.total_value || 0;
  
  if (!history.value || history.value.length < 2) {
    return 0;
  }
  
  let baseValue = 0;
  let cashFlow = 0;
  let baseDate = '';
  
  if (isUSMarketOpen.value) {
    // 🌙 美股交易中：使用昨日收盤 + 今日現金流
    baseValue = history.value[history.value.length - 2].total_value || 0;
    baseDate = history.value[history.value.length - 2].date || '';
    cashFlow = calculateCashFlow(getTodayDateString());
    
    console.log(`[美股盤中] 基準=${baseDate}收盤, 基準市值=${baseValue.toLocaleString()}, 今日現金流=${cashFlow.toLocaleString()}, 今日市值=${todayValue.toLocaleString()}`);
  } else {
    // ☀️ 美股收盤後：使用前日收盤 + 昨晚現金流
    if (history.value.length >= 3) {
      baseValue = history.value[history.value.length - 3].total_value || 0;
      baseDate = history.value[history.value.length - 3].date || '';
    } else {
      // 資料不足，使用昨日
      baseValue = history.value[history.value.length - 2].total_value || 0;
      baseDate = history.value[history.value.length - 2].date || '';
    }
    cashFlow = calculateCashFlow(getYesterdayDateString());
    
    console.log(`[美股收盤] 基準=${baseDate}收盤, 基準市值=${baseValue.toLocaleString()}, 昨晚現金流=${cashFlow.toLocaleString()}, 今日市值=${todayValue.toLocaleString()}`);
  }
  
  // 當日損益 = 今日市值 - 基準市值 - 現金流
  const pnl = todayValue - baseValue - cashFlow;
  
  console.log(`[當日損益] ${pnl.toLocaleString()} (${isUSMarketOpen.value ? '美股盤中' : '美股收盤'})`);
  
  return pnl;
});

// 計算今日損益百分比
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
  return ((dailyPnL.value / baseValue) * 100).toFixed(2);
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
