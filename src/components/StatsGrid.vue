<template>
  <div class="stats-grid">
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
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">未實現損益</span>
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
        <span class="stat-label">今日損益 (Est.)</span>
      </div>
      <div class="stat-main">
        <div class="stat-value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
        </div>
      </div>
      <div class="stat-footer">
        <span class="text-sub">Vs. 昨日收盤</span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-top">
        <span class="stat-label">總報酬率 (TWR)</span>
      </div>
      <div class="stat-main">
        <div class="stat-value">{{ stats.twr || 0 }}<span class="percent">%</span></div>
      </div>
      <div class="stat-footer">
         <span class="text-sub">SPY Benchmark: </span>
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

const unrealizedPnL = computed(() => (stats.value.total_value || 0) - (stats.value.invested_capital || 0));
const roi = computed(() => {
  if (!stats.value.invested_capital) return '0.00';
  return ((unrealizedPnL.value / stats.value.invested_capital) * 100).toFixed(2);
});

const dailyPnL = computed(() => {
  if (history.value.length < 2) return 0;
  const last = history.value[history.value.length - 1];
  const prev = history.value[history.value.length - 2];
  return (last.total_value - last.invested) - (prev.total_value - prev.invested);
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
const displayDaily = useAnimatedNumber(dailyPnL);

const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW');
</script>

<style scoped>
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr); 
    gap: 20px;
}

.stat-block {
    background: #fff;
    padding: 20px 24px; /* 上下20，左右24 */
    border-radius: 12px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 128px; /* 稍微縮減高度，更緊湊 */
    transition: transform 0.2s;
}

.stat-block:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

/* 主卡片藍色背景 */
.stat-block.primary {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border: none;
}
.stat-block.primary .stat-label { color: rgba(255,255,255,0.9); }
.stat-block.primary .stat-value { color: #fff; }
.stat-block.primary .stat-footer { border-top-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.9); }
.stat-block.primary .icon-box { background: rgba(255,255,255,0.25); }

.stat-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.stat-label { font-size: 0.9rem; color: var(--text-sub); font-weight: 600; }
.icon-box { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }

.stat-main { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }

/* 加大字體 */
.stat-value {
    font-size: 2.2rem; 
    font-weight: 700;
    color: var(--text-main);
    line-height: 1;
    letter-spacing: -0.03em;
}
.stat-value.big { font-size: 2.4rem; }

.unit-text, .percent { font-size: 1rem; color: var(--text-sub); font-weight: 600; }
.stat-block.primary .unit-text { color: rgba(255,255,255,0.8); }

.stat-footer {
    padding-top: 10px;
    border-top: 1px solid #f3f4f6;
    font-size: 0.85rem;
    display: flex; align-items: center; justify-content: space-between;
}

.footer-item { display: flex; align-items: center; gap: 6px; }
.f-label { opacity: 0.8; }
.f-val { font-weight: 600; font-family: 'Inter', monospace; }

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-sub { color: var(--text-sub); }

.badge { padding: 3px 10px; border-radius: 20px; font-weight: 700; font-size: 0.8rem; letter-spacing: 0.5px; }
.badge-green { background: #d1fae5; color: #065f46; }
.badge-red { background: #fee2e2; color: #991b1b; }

@media (max-width: 1400px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr; } .stat-value { font-size: 2rem; } }
</style>
