<template>
  <div class="stats-container">
    <StatsGridSkeleton v-if="loading" />

    <div v-else class="stats-grid">
      <div class="stat-card primary-card">
        <div class="card-header">
          <span class="card-label">總資產淨值</span>
          <div class="icon-wrapper">💰</div>
        </div>
        <div class="card-body">
          <div class="main-value highlight">
            {{ formatCurrency(summary.total_value) }}
          </div>
          <div class="sub-info">
            <span class="label">投入成本</span>
            <span class="value">{{ formatCurrency(summary.invested_capital) }}</span>
          </div>
        </div>
      </div>

      <div class="stat-card" :class="dailyPnlClass">
        <div class="card-header">
          <div class="label-group">
            <span class="card-label">當日損益</span>
            <span class="stage-badge" :class="{ 'live-pulse': isLive }">
              <span class="dot" v-if="isLive"></span>
              {{ marketStageDisplay }}
            </span>
          </div>
          <div class="icon-wrapper" :class="{ 'flash': isLive }">
            {{ isLive ? '⚡' : '📊' }}
          </div>
        </div>

        <div class="card-body">
          <div class="main-value" :class="getPnlColor(displayDailyPnl)">
            {{ displayDailyPnl >= 0 ? '+' : '' }}{{ formatCurrency(displayDailyPnl) }}
          </div>

          <div class="pnl-breakdown">
            <div class="bd-row">
              <span class="bd-label">未實現</span>
              <div class="bd-values">
                <div class="bd-item">
                  <span class="flag">🇺🇸</span>
                  <span :class="getPnlColor(liveUsPnl)">{{ formatCurrency(liveUsPnl) }}</span>
                </div>
                <div class="bd-item">
                  <span class="flag">🇹🇼</span>
                  <span :class="getPnlColor(liveTwPnl)">{{ formatCurrency(liveTwPnl) }}</span>
                </div>
              </div>
            </div>

            <div class="bd-divider"></div>

            <div class="bd-row">
              <span class="bd-label">已實現</span>
              <div class="bd-values">
                <div class="bd-item realized">
                  <span class="icon-check">✅</span>
                  <span :class="getPnlColor(realizedPnlToday)">{{ formatCurrency(realizedPnlToday) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="update-time" v-if="lastUpdateStr">
            Updated: {{ lastUpdateStr }}
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="card-header">
          <span class="card-label">累積報酬 (TWR)</span>
          <div class="icon-wrapper">📈</div>
        </div>
        <div class="card-body">
          <div class="main-value" :class="getPnlColor(summary.twr)">
            {{ formatPercent(summary.twr) }}
          </div>
          <div class="sub-info comparison">
            <span>vs {{ benchmarkName }}</span>
            <span :class="getPnlColor(summary.benchmark_twr)">
              {{ formatPercent(summary.benchmark_twr) }}
            </span>
          </div>
        </div>
      </div>

      <div class="stat-card" :class="getPnlBgClass(summary.total_pnl)">
        <div class="card-header">
          <span class="card-label">總損益</span>
          <div class="icon-wrapper">💎</div>
        </div>
        <div class="card-body">
          <div class="main-value" :class="getPnlColor(summary.total_pnl)">
            {{ summary.total_pnl >= 0 ? '+' : '' }}{{ formatCurrency(summary.total_pnl) }}
          </div>
          <div class="sub-info">
            <span class="label">歷史已實現</span>
            <span class="value">{{ formatCurrency(summary.realized_pnl) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import StatsGridSkeleton from './skeletons/StatsGridSkeleton.vue';
import { CONFIG } from '../config';

const props = defineProps({
  loading: Boolean
});

const portfolioStore = usePortfolioStore();
const authStore = useAuthStore();

// 基礎數據引用 (Fallback to empty object)
const summary = computed(() => portfolioStore.summary || {});
const holdings = computed(() => portfolioStore.holdings || []);
const benchmarkName = 'SPY';

// ==========================================
// v2.40 核心邏輯: 前端補水 (Client-Side Hydration)
// ==========================================

const isLive = ref(false);
const realtimeQuotes = ref({});
const pollTimer = ref(null);
const lastUpdateStr = ref('');

// 1. 市場狀態顯示 (來自後端 Helper)
const marketStageDisplay = computed(() => {
  return summary.value.market_stage || '休市中';
});

// 2. 當日已實現損益 (來自 TransactionAnalyzer 的精確計算)
const realizedPnlToday = computed(() => {
  return Number(summary.value.realized_pnl_today) || 0;
});

// 3. 台股未實現損益 (目前使用後端快照)
const liveTwPnl = computed(() => {
  return Number(summary.value.daily_pnl_tw) || 0;
});

// 4. 美股未實現損益 (增量更新核心)
const liveUsPnl = computed(() => {
  const backendUsPnl = Number(summary.value.daily_pnl_us) || 0;

  // 若無即時數據，直接回傳後端快照
  if (!isLive.value || Object.keys(realtimeQuotes.value).length === 0) {
    return backendUsPnl;
  }

  // 計算增量 (Delta)
  let delta = 0;
  let hasMatch = false;

  holdings.value.forEach(h => {
    // 僅針對美股且持有數量大於 0 的標的
    if (h.currency === 'USD' && h.qty > 0 && realtimeQuotes.value[h.symbol]) {
      const q = realtimeQuotes.value[h.symbol];
      
      // 基準價：後端計算時使用的價格 (current_price_origin)
      const backendRefPrice = h.current_price_origin || 0;
      
      if (backendRefPrice > 0) {
        const priceDiff = q.price - backendRefPrice;
        // 匯率：優先用 store 匯率，預設 1
        const fx = portfolioStore.exchange_rate || 1.0; 
        
        delta += priceDiff * h.qty * fx;
        hasMatch = true;
      }
    }
  });

  if (!hasMatch) return backendUsPnl;

  // 最終 PnL = 後端快照 + 前端增量
  return backendUsPnl + Math.round(delta);
});

// 5. 總當日損益
const displayDailyPnl = computed(() => {
  return liveUsPnl.value + liveTwPnl.value + realizedPnlToday.value;
});

// ==========================================
// 即時報價 API 串接
// ==========================================

const fetchRealtimeQuotes = async () => {
  const symbols = holdings.value
    .filter(h => h.currency === 'USD' && h.qty > 0)
    .map(h => h.symbol);
    
  if (symbols.length === 0) return;

  try {
    const token = authStore.token;
    if (!token) return;

    // 呼叫 Worker v2.40 新增的 Proxy API
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/realtime-quotes?symbols=${symbols.join(',')}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (data.success) {
      realtimeQuotes.value = data.quotes;
      lastUpdateStr.value = new Date().toLocaleTimeString('zh-TW', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });
    }
  } catch (e) {
    console.warn("Realtime quote fetch failed", e);
  }
};

// 監聽市場狀態，自動開關輪詢
watch(() => summary.value.market_stage, (newStage) => {
  const shouldLive = newStage && newStage.includes('美股盤中');
  
  if (shouldLive) {
    if (!isLive.value) {
      isLive.value = true;
      fetchRealtimeQuotes();
      pollTimer.value = setInterval(fetchRealtimeQuotes, 30000); // 30秒更新一次
    }
  } else {
    isLive.value = false;
    if (pollTimer.value) {
      clearInterval(pollTimer.value);
      pollTimer.value = null;
    }
  }
}, { immediate: true });

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value);
});

// ==========================================
// 格式化與樣式工具
// ==========================================

const formatCurrency = (val) => {
  if (val === undefined || val === null) return '$0';
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val);
};

const formatPercent = (val) => {
  if (val === undefined || val === null) return '0.00%';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${Number(val).toFixed(2)}%`;
};

const dailyPnlClass = computed(() => {
  return displayDailyPnl.value >= 0 ? 'border-success' : 'border-danger';
});

const getPnlColor = (val) => {
  const num = Number(val) || 0;
  if (num > 0) return 'text-success';
  if (num < 0) return 'text-danger';
  return 'text-neutral';
};

const getPnlBgClass = (val) => {
  const num = Number(val) || 0;
  if (num > 0) return 'border-success';
  if (num < 0) return 'border-danger';
  return '';
};
</script>

<style scoped>
/* 變數定義 (若全域未定義，提供 fallback) */
.stats-container {
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --success: #10b981;
  --danger: #ef4444;
  --neutral: #6b7280;
  --bg-card: #ffffff;
  --bg-sub: #f3f4f6;
  --border: #e5e7eb;
  --text-main: #111827;
  --text-sub: #6b7280;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* 暗色模式支援 (假設 html.dark 類別存在) */
:global(html.dark) .stats-container {
  --bg-card: #1f2937;
  --bg-sub: #374151;
  --border: #374151;
  --text-main: #f9fafb;
  --text-sub: #9ca3af;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

/* 卡片基礎樣式 */
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1.25rem;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
  min-height: 140px;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

/* 邊框狀態色 */
.border-success { border-left: 4px solid var(--success); }
.border-danger { border-left: 4px solid var(--danger); }

/* 特殊卡片: 總資產 */
.primary-card {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  border: none;
}
.primary-card .card-label, 
.primary-card .main-value, 
.primary-card .label, 
.primary-card .value { color: white; }
.primary-card .icon-wrapper { background: rgba(255,255,255,0.2); }

/* Header 區域 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.label-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.card-label {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-sub);
  letter-spacing: 0.05em;
}

.icon-wrapper {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: var(--bg-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

/* 數值顯示 */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.main-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.1;
  font-family: 'JetBrains Mono', monospace; /* 若無則用預設 */
}

/* 副標題資訊 */
.sub-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
  margin-top: 0.5rem;
}

.primary-card .sub-info { border-top: 1px solid rgba(255,255,255,0.2); }

.label { color: var(--text-sub); }
.value { font-weight: 600; color: var(--text-main); }

/* --- v2.40 專用樣式 --- */

/* 市場狀態 Badge */
.stage-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  background: var(--bg-sub);
  color: var(--text-sub);
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
}

.stage-badge.live-pulse {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
  font-weight: 600;
}

.dot {
  width: 6px;
  height: 6px;
  background: var(--success);
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}

/* 即時圖示動畫 */
.flash { animation: flash-icon 2s infinite; color: #fbbf24; }

/* 損益分解 (Breakdown) 表格 */
.pnl-breakdown {
  background: var(--bg-sub);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
}

.bd-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.bd-label {
  color: var(--text-sub);
  font-size: 0.75rem;
}

.bd-values {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.bd-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.bd-item.realized {
  font-weight: 700;
}

.bd-divider {
  height: 1px;
  background: var(--border); /* 使用較淡的線條 */
  opacity: 0.5; /* 增加透明度讓它更不明顯 */
  margin: 4px 0;
}

/* 顏色工具 */
.text-success { color: var(--success); }
.text-danger { color: var(--danger); }
.text-neutral { color: var(--neutral); }

/* 最後更新時間 */
.update-time {
  font-size: 0.65rem;
  text-align: right;
  color: var(--text-sub);
  opacity: 0.7;
  margin-top: 2px;
}

/* 動畫定義 */
@keyframes pulse-dot {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes flash-icon {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

/* RWD 優化 */
@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr; /* 手機單欄 */
    gap: 1rem;
  }
  
  .stat-card {
    min-height: auto;
    padding: 1rem;
  }
  
  .main-value { font-size: 1.5rem; }
}
</style>
