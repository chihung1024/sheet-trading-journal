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
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); /* 自動適應寬度 */
    gap: 20px;
}

.stat-block {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 110px;
}

.stat-block.primary {
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    color: white;
    border: none;
}
.stat-block.primary .stat-label { color: rgba(255,255,255,0.85); }
.stat-block.primary .stat-value { color: #fff; }
.stat-block.primary .stat-footer { color: rgba(255,255,255,0.8); border-top-color: rgba(255,255,255,0.2); }

.stat-label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

/* 響應式字體大小：手機版小一點，電腦版大一點 */
.stat-value { 
    font-size: clamp(1.5rem, 2.5vw, 1.8rem); 
    font-weight: 700; 
    color: var(--text-main); 
    line-height: 1.1; 
    margin-bottom: 10px; 
}
.stat-value.big { 
    font-size: clamp(1.8rem, 3vw, 2.2rem); 
}

.unit { font-size: 1rem; margin-left: 2px; font-weight: 500; }

.stat-footer { 
    margin-top: auto; padding-top: 10px; border-top: 1px solid #f1f5f9; 
    font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between; 
}

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.text-sub { color: var(--text-sub); }

.tag { padding: 2px 8px; border-radius: 10px; font-weight: 600; font-size: 0.75rem; }
.tag-green { background: #d1fae5; color: #065f46; }
.tag-red { background: #fee2e2; color: #991b1b; }
</style>
