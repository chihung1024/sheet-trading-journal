<template>
  <div class="inner-chart-layout no-padding-mobile"> <div class="chart-header">
      <div class="title-row">
        <h3 class="chart-title">績效趨勢</h3>
        <div class="toggle-pills">
          <button :class="{active: chartType==='pnl'}" @click="chartType='pnl'">損益</button>
          <button :class="{active: chartType==='twr'}" @click="chartType='twr'">報酬</button>
          <button :class="{active: chartType==='asset'}" @click="chartType='asset'">資產</button>
        </div>
      </div>
      
      <div class="controls-row">
        <div class="scroll-wrapper"> <div class="time-pills">
            <button v-for="range in timeRanges" 
                    :key="range.value" 
                    :class="{active: timeRange===range.value}" 
                    @click="switchTimeRange(range.value)">
              {{ range.label }}
            </button>
            <button :class="{active: timeRange==='CUSTOM'}" @click="timeRange='CUSTOM'">自訂</button>
          </div>
        </div>
        
        <div class="right-controls">
          <div class="benchmark-selector" v-if="chartType === 'twr'">
            <label class="compact-label">基準</label>
            <div class="input-with-action">
              <input 
                type="text" 
                v-model="benchmarkInput" 
                placeholder="代碼"
                @keyup.enter="handleBenchmarkChange"
                class="compact-input"
              >
              <button @click="handleBenchmarkChange" class="mini-check">✓</button>
            </div>
          </div>
          
          <div class="date-range-selector" v-if="timeRange === 'CUSTOM' || isDesktop">
            <div class="date-group">
              <label>起</label>
              <input type="date" v-model="customStartDate" @change="onDateChange">
            </div>
            <div class="date-group">
              <label>訖</label>
              <input type="date" v-model="customEndDate" @change="onDateChange">
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="canvas-container">
      <canvas ref="canvas"></canvas>
      <div v-if="displayedData.length === 0" class="empty-overlay">
         <span>📊 選擇時間區間以查看趨勢</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onUnmounted, computed } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const canvas = ref(null);
let myChart = null;
let resizeObserver = null;

const chartType = ref('pnl');
const timeRange = ref('1Y');
const displayedData = ref([]);
const baselineData = ref(null);
const customStartDate = ref('');
const customEndDate = ref('');
const benchmarkInput = ref(portfolioStore.selectedBenchmark);

const isDesktop = ref(window.innerWidth > 1024);

const timeRanges = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: '全部' }
];

// MODIFIED: 基準標的更新邏輯優化
const handleBenchmarkChange = async () => {
  const val = benchmarkInput.value.trim().toUpperCase();
  if (!val) return;
  if (val === portfolioStore.selectedBenchmark) return;
  
  try {
    addToast(`🔄 正在切換基準至 ${val}...`, 'info');
    await portfolioStore.triggerUpdate(val);
  } catch (e) {
    addToast('切換失敗', 'error');
  }
};

const switchTimeRange = (range) => {
    timeRange.value = range;
    const now = new Date();
    let start = new Date(now);
    
    if (range === 'CUSTOM') return;
    
    switch(range) {
        case '1M': start.setMonth(now.getMonth() - 1); break;
        case '3M': start.setMonth(now.getMonth() - 3); break;
        case '6M': start.setMonth(now.getMonth() - 6); break;
        case 'YTD': start = new Date(now.getFullYear(), 0, 1); break;
        case '1Y': start.setFullYear(now.getFullYear() - 1); break;
        case 'ALL': start = new Date('2000-01-01'); break;
    }
    
    customStartDate.value = start.toISOString().split('T')[0];
    customEndDate.value = now.toISOString().split('T')[0];
    filterData(start, now);
};

const onDateChange = () => {
  if (!customStartDate.value || !customEndDate.value) return;
  const start = new Date(customStartDate.value);
  const end = new Date(customEndDate.value);
  if (end < start) return;
  filterData(start, end);
};

const filterData = (startDate, endDate = new Date()) => {
    const fullHistory = portfolioStore.history || [];
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        return;
    }

    let baseline = null;
    for (let i = 0; i < fullHistory.length; i++) {
        const date = new Date(fullHistory[i].date.replace(/-/g, '/'));
        if (date >= startDate) {
            baseline = i > 0 ? fullHistory[i - 1] : fullHistory[i];
            break;
        }
    }
    baselineData.value = baseline || fullHistory[0];

    displayedData.value = fullHistory.filter(d => {
        const date = new Date(d.date.replace(/-/g, '/'));
        return date >= startDate && date <= endDate;
    });
    
    drawChart();
};

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();
    if (displayedData.value.length === 0 || !baselineData.value) return;

    const isMobile = window.innerWidth < 768; // MODIFIED: 偵測行動端以優化文字
    const labels = displayedData.value.map(d => {
        const date = new Date(d.date);
        return isMobile 
            ? `${date.getMonth()+1}/${date.getDate()}` // 手機端顯示更簡短的日期
            : date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
    });
    
    let datasets = [];
    const common = { 
        pointRadius: 0, pointHoverRadius: 6, borderWidth: isMobile ? 2 : 3, 
        tension: 0.4, pointBackgroundColor: 'white', pointBorderWidth: 2
    };

    if (chartType.value === 'asset') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        datasets = [{
            label: '總資產', data: displayedData.value.map(d => d.total_value),
            borderColor: '#3b82f6', backgroundColor: gradient, fill: true, ...common
        }];
    } else if (chartType.value === 'pnl') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        datasets = [{
            label: '淨損益', data: displayedData.value.map(d => d.net_profit),
            borderColor: '#10b981', backgroundColor: gradient, fill: true, ...common
        }];
    } else {
        const baseTWR = baselineData.value.twr;
        const baseBench = baselineData.value.benchmark_twr;
        datasets = [
            {
                label: '投資組合 (%)', data: displayedData.value.map(d => d.twr - baseTWR),
                borderColor: '#8b5cf6', ...common
            },
            {
                label: `${portfolioStore.selectedBenchmark} (%)`, 
                data: displayedData.value.map(d => d.benchmark_twr - baseBench),
                borderColor: '#94a3b8', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, tension: 0.4
            }
        ];
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // MODIFIED: 觸控交互優化
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: chartType.value === 'twr',
                    position: 'top',
                    align: 'end',
                    labels: { boxWidth: 8, font: { size: 11 } }
                },
                tooltip: {
                    padding: 12,
                    bodySpacing: 6,
                    // MODIFIED: 強化 Tooltip 在手機上的對比度
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toLocaleString()}${chartType.value==='twr'?'%':''}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 0, autoSkip: true, font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: {
                        font: { size: 10, family: 'JetBrains Mono' },
                        callback: (val) => chartType.value === 'twr' ? `${val}%` : val.toLocaleString('zh-TW', { notation: 'compact' })
                    }
                }
            }
        }
    });
};

watch(() => portfolioStore.history, () => switchTimeRange(timeRange.value));
watch(chartType, () => drawChart());

onMounted(async () => {
    await nextTick();
    switchTimeRange('1Y');
    window.addEventListener('resize', () => { isDesktop.value = window.innerWidth > 1024; });
    
    if (canvas.value) {
        resizeObserver = new ResizeObserver(() => { if (myChart) myChart.resize(); });
        resizeObserver.observe(canvas.value.parentElement);
    }
});

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (myChart) myChart.destroy();
});
</script>

<style scoped>
.inner-chart-layout { display: flex; flex-direction: column; height: 100%; padding: 24px; position: relative; }
.chart-header { margin-bottom: 20px; }
.title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.chart-title { font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin: 0; }

.toggle-pills { display: flex; background: var(--bg-secondary); padding: 4px; border-radius: 10px; gap: 4px; }
.toggle-pills button { border: none; background: transparent; padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; color: var(--text-sub); cursor: pointer; font-weight: 600; }
.toggle-pills button.active { background: var(--bg-card); color: var(--primary); box-shadow: var(--shadow-sm); }

/* MODIFIED: 控制列手機端優化 */
.controls-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.scroll-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.scroll-wrapper::-webkit-scrollbar { display: none; }

.time-pills { display: flex; gap: 4px; white-space: nowrap; }
.time-pills button { border: 1px solid var(--border-color); background: var(--bg-card); padding: 4px 10px; font-size: 0.8rem; border-radius: 6px; color: var(--text-sub); cursor: pointer; }
.time-pills button.active { background: var(--primary); color: white; border-color: var(--primary); }

.right-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

/* MODIFIED: 依照微調需求重新設計的基準標的選擇器 */
.benchmark-selector { display: flex; align-items: center; gap: 8px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 8px; border: 1px solid var(--border-color); }
.compact-label { font-size: 0.8rem; font-weight: 700; color: var(--text-sub); white-space: nowrap; }
.input-with-action { display: flex; align-items: center; gap: 4px; }
.compact-input { width: 60px; border: none; background: transparent; font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 800; color: var(--primary); text-transform: uppercase; padding: 2px; }
.compact-input:focus { outline: none; }
.mini-check { background: var(--primary); color: white; border: none; border-radius: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem; }

.date-range-selector { display: flex; align-items: center; gap: 8px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 8px; }
.date-group { display: flex; align-items: center; gap: 4px; }
.date-group label { font-size: 0.75rem; font-weight: 700; color: var(--text-sub); }
.date-group input { border: none; background: transparent; font-size: 0.85rem; color: var(--text-main); font-family: 'Inter', sans-serif; cursor: pointer; }

.canvas-container { flex: 1; position: relative; min-height: 280px; width: 100%; }
.empty-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--text-sub); font-size: 0.9rem; }

/* MODIFIED: 行動端斷點優化 */
@media (max-width: 768px) {
    .inner-chart-layout { padding: 16px 12px; }
    .controls-row { gap: 10px; }
    .right-controls { width: 100%; justify-content: space-between; }
    .benchmark-selector, .date-range-selector { flex: 1; justify-content: space-between; }
    .no-padding-mobile { padding: 12px 0 !important; }
    .canvas-container { min-height: 250px; }
    .compact-input { width: 50px; font-size: 0.95rem; }
}
</style>
