<template>
  <div class="stats-grid">
    <div class="stat-card main-stat">
      <div class="stat-icon">💰</div>
      <div class="stat-content">
        <div class="stat-label">總資產淨值 (TWD)</div>
        <div class="stat-value highlight">{{ displayTotalValue }}</div>
        <div class="stat-sub">投入成本: {{ formatNumber(stats.invested_capital) }}</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-label">未實現損益</div>
      <div class="stat-value" :class="unrealizedPnL >= 0 ? 'text-green' : 'text-red'">
        {{ unrealizedPnL >= 0 ? '+' : '' }}{{ displayUnrealized }}
      </div>
      <div class="stat-pill" :class="roi >= 0 ? 'pill-green' : 'pill-red'">
        {{ roi }}% ROI
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-label">今日損益 (Est.)</div>
      <div class="stat-value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
        {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-label">TWR 總報酬率</div>
      <div class="stat-value" :class="stats.twr >= 0 ? 'text-green' : 'text-red'">
        {{ stats.twr || 0 }}%
      </div>
      <div class="stat-sub">SPY Benchmark: {{ stats.benchmark_twr || '-' }}%</div>
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

// 簡易數字動畫邏輯
const useAnimatedNumber = (targetVal) => {
  const current = ref(0);
  watch(targetVal, (newVal) => {
    if (newVal === undefined || newVal === null) return;
    const start = current.value;
    const end = Number(newVal);
    const duration = 1000;
    const startTime = performance.now();
    
    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      // EaseOutQuart function
      const ease = 1 - Math.pow(1 - progress, 4);
      current.value = start + (end - start) * ease;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, { immediate: true });
  return computed(() => Math.round(current.value).toLocaleString('zh-TW'));
};

const displayTotalValue = useAnimatedNumber(computed(() => stats.value.total_value));
const displayUnrealized = useAnimatedNumber(unrealizedPnL);
const displayDaily = useAnimatedNumber(dailyPnL);

const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
</script>

<style scoped>
.stats-grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); 
    gap: 20px; 
}
.stat-card { 
    background: var(--card-bg); 
    backdrop-filter: blur(var(--backdrop-blur));
    padding: 24px; 
    border-radius: var(--radius); 
    border: 1px solid var(--card-border); 
    display: flex; 
    flex-direction: column; 
    justify-content: center;
    transition: transform 0.2s;
}
.stat-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.15); }

.stat-label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 1.8rem; font-weight: 700; line-height: 1.2; font-family: 'Inter', sans-serif; }
.highlight { color: var(--primary); text-shadow: 0 0 20px rgba(64, 169, 255, 0.2); }
.stat-sub { font-size: 0.8rem; margin-top: 8px; color: #666; }

.stat-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-top: 6px;
    width: fit-content;
}
.pill-green { background: rgba(76, 175, 80, 0.15); color: #4caf50; }
.pill-red { background: rgba(255, 82, 82, 0.15); color: #ff5252; }

/* 主卡片特別樣式 */
.main-stat { grid-column: span 1; display: flex; flex-direction: row; align-items: center; gap: 15px; }
.stat-icon { font-size: 2.5rem; background: rgba(255,255,255,0.03); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
</style>
