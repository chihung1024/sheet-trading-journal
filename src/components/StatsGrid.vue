<template>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-header">
        <span class="label">總資產淨值</span>
        <div class="icon-bg bg-blue">💰</div>
      </div>
      <div class="stat-body">
        <div class="value">{{ displayTotalValue }} <span class="unit">TWD</span></div>
        <div class="sub-text">投入成本: {{ formatNumber(stats.invested_capital) }}</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-header">
        <span class="label">未實現損益</span>
        <div class="icon-bg" :class="unrealizedPnL >= 0 ? 'bg-green' : 'bg-red'">
            {{ unrealizedPnL >= 0 ? '📈' : '📉' }}
        </div>
      </div>
      <div class="stat-body">
        <div class="value" :class="unrealizedPnL >= 0 ? 'text-green' : 'text-red'">
          {{ unrealizedPnL >= 0 ? '+' : '' }}{{ displayUnrealized }}
        </div>
        <div class="badge" :class="roi >= 0 ? 'badge-green' : 'badge-red'">
          {{ roi }}% ROI
        </div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-header">
        <span class="label">今日損益 (預估)</span>
        <div class="icon-bg bg-gray">📅</div>
      </div>
      <div class="stat-body">
        <div class="value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
          {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
        </div>
        <div class="sub-text">與昨日收盤相比</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-header">
        <span class="label">TWR 總報酬率</span>
        <div class="icon-bg bg-orange">🏆</div>
      </div>
      <div class="stat-body">
        <div class="value">{{ stats.twr || 0 }}%</div>
        <div class="sub-text">SPY Benchmark: <strong>{{ stats.benchmark_twr || '-' }}%</strong></div>
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
    const end = Number(newVal);
    const start = current.value;
    const startTime = performance.now();
    const animate = (time) => {
      const progress = Math.min((time - startTime) / 800, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
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

const formatNumber = (num) => Number(num||0).toLocaleString('zh-TW');
</script>

<style scoped>
.stats-grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); 
    gap: 20px; 
}
.stat-card { 
    background: var(--bg-card); 
    border: 1px solid var(--border-color); 
    border-radius: var(--radius); 
    padding: 20px; 
    box-shadow: var(--shadow-sm);
    display: flex; flex-direction: column; justify-content: space-between;
    height: 120px;
}
.stat-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; }
.label { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
.icon-bg { 
    width: 36px; height: 36px; border-radius: 50%; 
    display: flex; align-items: center; justify-content: center; font-size: 1.2rem; 
}
.bg-blue { background: #eff6ff; }
.bg-green { background: #ecfdf5; }
.bg-red { background: #fef2f2; }
.bg-orange { background: #fff7ed; }
.bg-gray { background: #f3f4f6; }

.value { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); line-height: 1; margin-bottom: 4px; }
.unit { font-size: 0.9rem; color: var(--text-secondary); font-weight: normal; }
.sub-text { font-size: 0.8rem; color: var(--text-secondary); }

.badge { 
    display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; 
}
.badge-green { background: #d1fae5; color: #065f46; }
.badge-red { background: #fee2e2; color: #991b1b; }
</style>
