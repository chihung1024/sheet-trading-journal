<template>
  <div class="stats-grid">
    <div class="stat-block primary">
      <div class="stat-label">總資產淨值 (TWD)</div>
      <div class="stat-value big">{{ displayTotalValue }}</div>
      <div class="stat-footer">
        <span class="label">成本</span> {{ formatNumber(stats.invested_capital) }}
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-label">未實現損益</div>
      <div class="stat-value" :class="unrealizedPnL >= 0 ? 'text-green' : 'text-red'">
        {{ unrealizedPnL >= 0 ? '+' : '' }}{{ displayUnrealized }}
      </div>
      <div class="stat-footer">
        <span class="tag" :class="roi >= 0 ? 'tag-green' : 'tag-red'">
            {{ roi }}% ROI
        </span>
      </div>
    </div>
    
    <div class="stat-block">
      <div class="stat-label">今日預估損益</div>
      <div class="stat-value" :class="dailyPnL >= 0 ? 'text-green' : 'text-red'">
        {{ dailyPnL >= 0 ? '+' : '' }}{{ displayDaily }}
      </div>
      <div class="stat-footer text-sub">Vs. 昨日收盤</div>
    </div>
    
    <div class="stat-block">
      <div class="stat-label">總報酬率 (TWR)</div>
      <div class="stat-value">{{ stats.twr || 0 }}<span class="unit">%</span></div>
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

// 數字動畫 (簡化版)
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
    background: #fff;
    padding: 24px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 120px;
    transition: transform 0.2s;
}

.stat-block.primary {
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    color: white;
    border: none;
}
.stat-block.primary .stat-label { color: rgba(255,255,255,0.8); }
.stat-block.primary .stat-value { color: #fff; }
.stat-block.primary .stat-footer { color: rgba(255,255,255,0.7); border-top-color: rgba(255,255,255,0.2); }

.stat-label { font-size: 0.9rem; color: var(--text-sub); font-weight: 500; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 2rem; font-weight: 700; color: var(--text-main); line-height: 1.1; margin-bottom: 12px; }
.stat-value.big { font-size: 2.4rem; }
.unit { font-size: 1.2rem; margin-left: 4px; color: var(--text-sub); font-weight: 500; }

.stat-footer { 
    margin-top: auto; padding-top: 12px; border-top: 1px solid #f1f5f9; 
    font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; 
}

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-sub { color: var(--text-sub); }

.tag { padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; }
.tag-green { background: #d1fae5; color: #065f46; }
.tag-red { background: #fee2e2; color: #991b1b; }

@media (max-width: 1024px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
    .stats-grid { grid-template-columns: 1fr; }
}
</style>
