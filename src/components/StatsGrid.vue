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
    
    <!-- 4️⃣ 當日損益 -->
    <div class="stat-block daily-pnl-block" :class="getPnlBgClass(dailyPnL)" :title="pnlTooltip">
      <div class="stat-top">
        <span class="stat-label">{{ pnlLabel }}</span>
        <span class="icon-box" :class="{ 'pulse-icon': isUSMarketOpen }">⚡</span>
      </div>
      <div class="stat-main column-layout">
        <div class="stat-value" :class="getPnlTextClass(dailyPnL)">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
        </div>
        <div class="stat-sub-value" :class="getPnlTextClass(dailyPnL)">
          ({{ dailyPnL >= 0 ? '+' : '' }}{{ dailyRoi }}%)
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
    <div class="stat-block" :class="xirrAvailable ? getPnlBgClass(xirrValue) : ''" :title="xirrTooltip">
      <div class="stat-top">
        <span class="stat-label">個人年化報酬</span>
        <span class="icon-box">🚀</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="xirrAvailable ? getPnlTextClass(xirrValue) : ''">
          <template v-if="xirrAvailable">
            {{ xirrValue >= 0 ? '+' : '' }}{{ xirrValue.toFixed(2) }}<span class="percent">%</span>
          </template>
          <template v-else>--</template>
        </div>
      </div>
      <div class="stat-footer">
         <span class="text-sub text-xs footer-desc">{{ xirrFooter }}</span>
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
const dailyPnlBreakdown = computed(() => stats.value.daily_pnl_breakdown || null);

const formatSigned = (val) => {
  const n = Number(val) || 0;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Math.round(n).toLocaleString('zh-TW')}`;
};

const isUSMarketOpen = computed(() => {
  const stage = stats.value.market_stage;
  const desc = stats.value.market_stage_desc || '';
  return stage === 'MARKET_OPEN' && desc.includes('US');
});

const pnlLabel = computed(() => {
  return isUSMarketOpen.value ? '美股盤中損益' : '當日損益';
});

const pnlDescription = computed(() => {
  if (isUSMarketOpen.value) {
    return '盤中損益(含交易+即時價格)';
  }
  return '台股損益+海外損益+匯率因素';
});

// Backward-compatible API key `us_pnl_twd` now represents all non-TWD
// securities. User-facing copy must not mislabel KRW/HKD/JPY/etc as US PnL.
const pnlTooltip = computed(() => {
  if (!dailyPnlBreakdown.value) return '';
  const tw = dailyPnlBreakdown.value.tw_pnl_twd ?? 0;
  const foreign = dailyPnlBreakdown.value.us_pnl_twd ?? 0;
  const fx = dailyPnlBreakdown.value.fx_pnl_twd ?? 0;
  
  if (Math.abs(fx) > 0.5) {
    return `台股: ${formatSigned(tw)} | 海外: ${formatSigned(foreign)} | 匯率: ${formatSigned(fx)}`;
  }
  return `台股: ${formatSigned(tw)} | 海外: ${formatSigned(foreign)}`;
});

const dailyRoi = computed(() => {
  if (stats.value.daily_pnl_roi_percent != null) {
    return stats.value.daily_pnl_roi_percent.toFixed(2);
  }
  
  if (stats.value.daily_pnl_base_value && stats.value.daily_pnl_base_value > 0) {
    return ((dailyPnL.value / stats.value.daily_pnl_base_value) * 100).toFixed(2);
  }
  
  return '0.00';
});

// Legacy snapshots do not have xirr_status and remain display-compatible.
// New snapshots use explicit status so an unavailable metric is never shown as 0%.
const xirrValue = computed(() => Number(stats.value.xirr ?? 0));
const xirrAvailable = computed(() => {
  const status = stats.value.xirr_status;
  return status == null || status === 'ok';
});

const xirrFooter = computed(() => {
  if (stats.value.xirr_status === 'not_applicable') return 'XIRR 尚不適用';
  if (stats.value.xirr_status === 'undefined') return 'XIRR 無法計算';
  if (stats.value.xirr_cashflow_conventional === false) {
    return 'XIRR (非傳統現金流，可能多解)';
  }
  return 'XIRR (資金加權)';
});

const xirrTooltip = computed(() => {
  const status = stats.value.xirr_status;
  if (status == null) return '舊版快照：未提供 XIRR 計算狀態';
  const asof = stats.value.xirr_asof_date ? `估值日 ${stats.value.xirr_asof_date}` : '';
  if (status === 'ok') {
    const ambiguity = stats.value.xirr_cashflow_conventional === false
      ? '；現金流正負號多次切換，可能存在多個 IRR 解'
      : '';
    return `${asof}${ambiguity}`;
  }
  if (status === 'not_applicable') return '目前沒有足夠現金流可計算 XIRR';
  return `XIRR 無法可靠計算${asof ? `；${asof}` : ''}`;
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
.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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

.stat-block:hover { 
    transform: translateY(-3px); 
    box-shadow: var(--shadow-lg); 
}

.primary-block {
    border-left: 4px solid var(--primary);
}

.bg-gradient-green {
    background: linear-gradient(145deg, var(--bg-card) 40%, rgba(16, 185, 129, 0.05) 100%);
    border-bottom: 2px solid rgba(16, 185, 129, 0.2);
}

.bg-gradient-red {
    background: linear-gradient(145deg, var(--bg-card) 40%, rgba(239, 68, 68, 0.05) 100%);
    border-bottom: 2px solid rgba(239, 68, 68, 0.2);
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
    letter-spacing: 0.02em;
}

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

@media (max-width: 1024px) { 
    .stats-grid { 
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    } 
    .stat-value.big { font-size: 2rem; }
}

@media (max-width: 768px) { 
    .stats-grid { 
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
    
    .stat-block {
        padding: 14px;
        min-height: 100px;
    }
    
    .stat-block:nth-child(1) {
        order: 1;
        grid-column: span 2;
    }
    
    .stat-block.daily-pnl-block {
        order: 2;
        grid-column: span 2;
        border-left: 4px solid var(--warning);
    }
    
    .stat-block:nth-child(2) {
        order: 3;
    }
    
    .stat-block:nth-child(3) {
        order: 4;
    }
    
    .stat-block:nth-child(5) {
        order: 5;
    }
    
    .stat-block:nth-child(6) {
        order: 6;
    }
    
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
    
    .footer-desc {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        display: block;
    }
}
</style>