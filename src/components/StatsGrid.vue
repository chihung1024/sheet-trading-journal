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
        <span class="stat-label">今日損益 (Est.)</span>
        <span class="icon-box">⚡</span>
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

/* 首個區塊特別樣式 - 使用漸層 */
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

/* 響應式設計 */
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
