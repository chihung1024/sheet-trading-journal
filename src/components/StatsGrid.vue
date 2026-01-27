<template>
  <div class="stats-grid">
    <StatsGridSkeleton v-if="loading" />

    <template v-else>
      <div class="stat-card primary">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <div class="stat-label">總資產 (NAV)</div>
          <div class="stat-value">
            {{ formatCurrency(summary.total_value) }}
          </div>
          <div class="stat-subtext">
            投入成本: {{ formatCurrency(summary.invested_capital) }}
          </div>
        </div>
      </div>

      <div class="stat-card" :class="dailyPnlClass">
        <div class="stat-icon">
          <span v-if="isLive" class="live-indicator">⚡</span>
          <span v-else>📊</span>
        </div>
        <div class="stat-content">
          <div class="stat-label-row">
            <span class="stat-label">當日損益</span>
            <span class="stage-badge" :class="{ 'pulse': isLive }">
              {{ marketStageDisplay }}
            </span>
          </div>
          
          <div class="stat-value">
            {{ formatCurrency(displayDailyPnl) }}
          </div>

          <div class="pnl-breakdown">
            <div class="bd-group">
              <span class="bd-label">未實現</span>
              <div class="bd-row">
                <span class="flag">🇺🇸</span>
                <span :class="getPnlColor(liveUsPnl)">{{ formatCurrency(liveUsPnl) }}</span>
              </div>
              <div class="bd-row">
                <span class="flag">🇹🇼</span>
                <span :class="getPnlColor(liveTwPnl)">{{ formatCurrency(liveTwPnl) }}</span>
              </div>
            </div>
            
            <div class="bd-divider"></div>

            <div class="bd-group">
              <span class="bd-label">已實現</span>
              <div class="bd-row realized">
                <span class="icon">✅</span>
                <span :class="getPnlColor(realizedPnlToday)">{{ formatCurrency(realizedPnlToday) }}</span>
              </div>
            </div>
          </div>
          
          <div class="stat-footer" v-if="lastUpdateStr">
            更新: {{ lastUpdateStr }}
          </div>
        </div>
      </div>

      <div class="stat-card" :class="getTwrClass(summary.twr)">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <div class="stat-label">累積報酬 (TWR)</div>
          <div class="stat-value">{{ formatPercent(summary.twr) }}</div>
          <div class="stat-comparison">
            vs. {{ benchmarkName }}: {{ formatPercent(summary.benchmark_twr) }}
          </div>
        </div>
      </div>

      <div class="stat-card" :class="getPnlClass(summary.total_pnl)">
        <div class="stat-icon">💎</div>
        <div class="stat-content">
          <div class="stat-label">總損益</div>
          <div class="stat-value">
            {{ formatCurrency(summary.total_pnl) }}
          </div>
          <div class="stat-subtext">
            已實現: {{ formatCurrency(summary.realized_pnl) }}
          </div>
        </div>
      </div>
    </template>
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

// 基礎數據引用
const summary = computed(() => portfolioStore.summary || {});
const holdings = computed(() => portfolioStore.holdings || []);
const benchmarkName = 'SPY'; // 可改為從設定讀取

// ==========================================
// v2.40 核心邏輯: 前端補水 (Client-Side Hydration)
// ==========================================

const isLive = ref(false); // 是否處於即時輪詢模式
const realtimeQuotes = ref({}); // 儲存前端抓到的即時報價
const pollTimer = ref(null);
const lastUpdateStr = ref('');

// 1. 市場狀態顯示
const marketStageDisplay = computed(() => {
  return summary.value.market_stage || '休市中';
});

// 2. 當日已實現損益 (來自後端 TransactionAnalyzer 的精確計算)
const realizedPnlToday = computed(() => {
  return summary.value.realized_pnl_today || 0;
});

// 3. 台股未實現損益 (通常台股盤中無需頻繁更新，或後端已包含，此處可視需求擴充即時抓取)
const liveTwPnl = computed(() => {
  // 如果未來要支援台股即時，可在 fetchQuotes 中加入邏輯
  return summary.value.daily_pnl_tw || 0;
});

// 4. 美股未實現損益 (增量更新核心)
const liveUsPnl = computed(() => {
  // A. 若無即時數據，回退至後端快照值
  if (!isLive.value || Object.keys(realtimeQuotes.value).length === 0) {
    return summary.value.daily_pnl_us || 0;
  }

  // B. 有即時數據，計算增量 (Delta)
  let delta = 0;
  let hasMatch = false;

  holdings.value.forEach(h => {
    // 僅針對美股且有抓到報價的標的
    if (h.currency === 'USD' && realtimeQuotes.value[h.symbol]) {
      const q = realtimeQuotes.value[h.symbol];
      
      // 核心：計算「即時價」與「後端基準價」的差額
      // current_price_origin 是後端 calculator.py 寫入時的價格 (curr_p)
      // 若後端使用昨收當基準，prev_close_price 則為基準價
      // 這裡我們用比較安全的做法：計算 (新價 - 舊價) * 股數
      
      // 注意：後端的 daily_pnl_us 是基於 (curr_p - base_p) 計算的
      // 我們要算的是 (live_price - curr_p) 的額外變動
      
      const backendRefPrice = h.current_price_origin || 0;
      
      if (backendRefPrice > 0) {
        const priceDiff = q.price - backendRefPrice;
        // 匯率：優先用 store 的，若無則預設 1 (美股通常需要轉 TWD)
        const fx = portfolioStore.exchange_rate || 1.0; 
        
        delta += priceDiff * h.qty * fx;
        hasMatch = true;
      }
    }
  });

  if (!hasMatch) return summary.value.daily_pnl_us || 0;

  // 最終 PnL = 後端計算值 + 前端增量
  return (summary.value.daily_pnl_us || 0) + Math.round(delta);
});

// 5. 總當日損益顯示
const displayDailyPnl = computed(() => {
  return liveUsPnl.value + liveTwPnl.value + realizedPnlToday.value;
});

// ==========================================
// 即時報價抓取邏輯
// ==========================================

const fetchRealtimeQuotes = async () => {
  // 找出所有持倉中的美股代碼
  const symbols = holdings.value
    .filter(h => h.currency === 'USD' && h.qty > 0)
    .map(h => h.symbol);
    
  if (symbols.length === 0) return;

  try {
    const token = authStore.token;
    if (!token) return;

    // 呼叫 Worker v2.40 新增的 Proxy API
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/realtime-quotes?symbols=${symbols.join(',')}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (data.success) {
      realtimeQuotes.value = data.quotes;
      lastUpdateStr.value = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  } catch (e) {
    console.warn("Realtime quote fetch failed, falling back to snapshot data.", e);
  }
};

// 監聽市場狀態以啟動/停止輪詢
watch(() => summary.value.market_stage, (newStage) => {
  // 判斷邏輯：只要狀態描述包含 "盤中" 且包含 "美股"，則啟動輪詢
  // 也可以根據具體的 STAGE_CODE 判斷
  const shouldLive = newStage && newStage.includes('美股盤中');
  
  if (shouldLive) {
    if (!isLive.value) {
      isLive.value = true;
      fetchRealtimeQuotes(); // 立即抓一次
      // 每 30 秒輪詢一次 (避免過於頻繁觸發 Rate Limit)
      pollTimer.value = setInterval(fetchRealtimeQuotes, 30000); 
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
// 輔助函式與樣式類別
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
  return displayDailyPnl.value >= 0 ? 'success' : 'danger';
});

const getPnlClass = (val) => (val >= 0 ? 'success' : 'danger');
const getTwrClass = (val) => (val >= 0 ? 'success' : 'danger');

const getPnlColor = (val) => {
  if (val > 0) return 'text-success';
  if (val < 0) return 'text-danger';
  return 'text-neutral';
};
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-primary);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-card.primary {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
  color: white;
  border: none;
}

.stat-card.primary .stat-label,
.stat-card.primary .stat-value,
.stat-card.primary .stat-subtext,
.stat-card.primary .stat-icon {
  color: white;
}

.stat-card.success { border-left: 4px solid var(--success-color); }
.stat-card.danger { border-left: 4px solid var(--danger-color); }

.stat-icon {
  font-size: 2rem;
  background: var(--bg-secondary);
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  flex-shrink: 0;
}

.stat-card.primary .stat-icon {
  background: rgba(255, 255, 255, 0.2);
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  margin-bottom: 0.25rem;
}

.stat-subtext, .stat-comparison {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* v2.40 新增樣式 */
.live-indicator {
  animation: pulse-yellow 2s infinite;
  display: inline-block;
}

.stage-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 4px;
  white-space: nowrap;
}

.stage-badge.pulse {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
  animation: pulse-green 2s infinite;
}

.pnl-breakdown {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
}

.bd-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.bd-label {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  margin-bottom: 0.1rem;
}

.bd-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 500;
}

.bd-row.realized {
  color: var(--text-primary);
}

.bd-divider {
  width: 1px;
  background: var(--border-color);
  height: auto;
}

.flag { font-size: 0.9rem; }
.icon { font-size: 0.8rem; }

.text-success { color: var(--success-color); }
.text-danger { color: var(--danger-color); }
.text-neutral { color: var(--text-secondary); }

.stat-footer {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  margin-top: 0.5rem;
  text-align: right;
  opacity: 0.7;
}

@keyframes pulse-green {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  70% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

@keyframes pulse-yellow {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

/* RWD */
@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
