<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <div class="header-top">
        <div class="title-group">
            <h3 class="chart-title">趨勢分析</h3>
            <div class="loading-badge" v-if="isChangingBenchmark">
                <span class="spinner-sm"></span> 更新中...
            </div>
        </div>
        
        <div class="toggle-pills-scroll">
          <div class="toggle-pills">
            <button :class="{active: chartType==='pnl'}" @click="chartType='pnl'">損益</button>
            <button :class="{active: chartType==='twr'}" @click="chartType='twr'">報酬率</button>
            <button :class="{active: chartType==='asset'}" @click="chartType='asset'">總資產</button>
          </div>
        </div>
      </div>
      
      <div class="controls-row">
        <div class="time-pills-scroll">
            <div class="time-pills">
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
            <label class="control-label">基準</label> 
            <div class="input-group-merged">
              <input 
                type="text" 
                v-model="benchmarkInput" 
                placeholder="SPY"
                @keyup.enter="handleBenchmarkChange"
                :disabled="isChangingBenchmark"
                class="benchmark-input"
              /> 
              <button 
                @click="handleBenchmarkChange"
                :disabled="isChangingBenchmark || !benchmarkInput || benchmarkInput === portfolioStore.selectedBenchmark"
                class="btn-icon-apply"
              >
                ✓
              </button>
            </div>
          </div>
          
          <div class="date-range-selector" v-show="timeRange === 'CUSTOM'">
            <input type="date" v-model="customStartDate" @change="onDateChange" :max="customEndDate || todayStr" class="date-input" />
            <span class="date-sep">to</span>
            <input type="date" v-model="customEndDate" @change="onDateChange" :min="customStartDate" :max="todayStr" class="date-input" />
          </div>
        </div>
      </div>
    </div>

    <div class="canvas-box">
      <div v-if="displayedData.length === 0" class="no-data-overlay">
          <span>尚無資料</span>
      </div>
      <canvas ref="canvas"></canvas>
    </div>
    
    <div class="chart-footer">
        <span class="info-text" v-if="displayedData.length > 0">
            統計區間: {{ displayedData[0]?.date }} ~ {{ displayedData[displayedData.length-1]?.date }} (共 {{ displayedData.length }} 筆)
        </span>
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
const isChangingBenchmark = ref(false);

const todayStr = computed(() => {
  const today = new Date();
  return today.toISOString().split('T')[0];
});

const timeRanges = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' }
];

const handleBenchmarkChange = async () => {
  const newBenchmark = benchmarkInput.value.trim().toUpperCase();
  if (!newBenchmark) {
    addToast('請輸入基準標的代碼', 'error');
    return;
  }
  if (newBenchmark === portfolioStore.selectedBenchmark) return;
  
  if (!confirm(`確定要將基準標的改為 ${newBenchmark} 嗎？需重新計算所有資料。`)) {
    benchmarkInput.value = portfolioStore.selectedBenchmark;
    return;
  }
  
  isChangingBenchmark.value = true;
  try {
    addToast(`🔄 切換基準標的至 ${newBenchmark}...`, 'info');
    await portfolioStore.triggerUpdate(newBenchmark);
    addToast(`✅ 已觸發計算，請稍候刷新。`, 'success');
  } catch (error) {
    addToast(`❌ 切換失敗: ${error.message}`, 'error');
    benchmarkInput.value = portfolioStore.selectedBenchmark;
  } finally {
    isChangingBenchmark.value = false;
  }
};

watch(() => portfolioStore.selectedBenchmark, (newVal) => {
  benchmarkInput.value = newVal;
});

const switchTimeRange = (range) => {
    timeRange.value = range;
    const now = new Date();
    let start = new Date(now);
    
    if (range === 'CUSTOM') {
      if (!customStartDate.value || !customEndDate.value) {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        customStartDate.value = oneYearAgo.toISOString().split('T')[0];
        customEndDate.value = now.toISOString().split('T')[0];
      }
      return;
    }
    
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
  const start = new Date(customStartDate.value.replace(/-/g, '/'));
  start.setHours(0, 0, 0, 0);
  const end = new Date(customEndDate.value.replace(/-/g, '/'));
  end.setHours(23, 59, 59, 999);
  if (end < start) return;
  
  timeRange.value = 'CUSTOM';
  filterData(start, end);
};

const filterData = (startDate, endDate = new Date()) => {
    const fullHistory = portfolioStore.history || [];
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        drawChart();
        return;
    }

    const startDateOnly = new Date(startDate); startDateOnly.setHours(0,0,0,0);
    const endDateOnly = new Date(endDate); endDateOnly.setHours(23,59,59,999);

    let baseline = null;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const itemDate = new Date(fullHistory[i].date.replace(/-/g, '/'));
        itemDate.setHours(0, 0, 0, 0);
        if (itemDate < startDateOnly) {
            baseline = fullHistory[i];
            break;
        }
    }
    if (!baseline && fullHistory.length > 0) baseline = fullHistory[0];
    
    baselineData.value = baseline;

    const filteredData = fullHistory.filter(d => {
        const itemDate = new Date(d.date.replace(/-/g, '/'));
        itemDate.setHours(0, 0, 0, 0);
        const dayOfWeek = itemDate.getDay();
        return itemDate >= startDateOnly && itemDate <= endDateOnly && dayOfWeek !== 0 && dayOfWeek !== 6;
    });
    
    displayedData.value = filteredData;
    drawChart();
};

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    if (displayedData.value.length === 0 || !baselineData.value) return;

    const isMobile = window.innerWidth < 768;
    const fontSize = isMobile ? 10 : 12;

    let datasets = [];
    const common = { 
        pointRadius: 0, 
        pointHoverRadius: 5, 
        borderWidth: 2, 
        tension: 0.2,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2
    };

    let chartData = [];
    let labels = [];
    
    let dataWithBaseline = [];
    const baselineInDisplayed = displayedData.value.some(d => d.date === baselineData.value.date);
    if (baselineInDisplayed) {
        dataWithBaseline = displayedData.value;
    } else {
        dataWithBaseline = [baselineData.value, ...displayedData.value];
    }
    
    labels = dataWithBaseline.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    });

    if (chartType.value === 'asset') {
        chartData = displayedData.value.map(d => d.total_value);
        labels = displayedData.value.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        });

        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        datasets = [{
            label: '總資產',
            data: chartData,
            borderColor: '#3b82f6',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else if (chartType.value === 'pnl') {
        const baselinePnl = baselineData.value.net_profit;
        chartData = dataWithBaseline.map(d => d.net_profit - baselinePnl);
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        
        datasets = [{
            label: '淨損益',
            data: chartData,
            borderColor: '#10b981',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else {
        const baseTWR = baselineData.value.twr;
        const baseBenchmark = baselineData.value.benchmark_twr;
        
        datasets = [
            {
                label: '策略 TWR',
                data: dataWithBaseline.map(d => ((1 + d.twr/100) / (1 + baseTWR/100) - 1) * 100),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.05)',
                fill: true,
                ...common
            },
            {
                label: portfolioStore.selectedBenchmark,
                data: dataWithBaseline.map(d => ((1 + d.benchmark_twr/100) / (1 + baseBenchmark/100) - 1) * 100),
                borderColor: '#94a3b8',
                borderWidth: 1.5,
                borderDash: [4, 4],
                pointRadius: 0,
                tension: 0.2,
                fill: false
            }
        ];
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                // ⚠️ 修正：增加內距防止邊界裁切錯誤
                padding: { left: 0, right: 10, top: 20, bottom: 0 }
            },
            plugins: {
                legend: {
                    display: chartType.value === 'twr',
                    position: 'top',
                    align: 'end',
                    labels: { boxWidth: 10, padding: 10, font: { size: fontSize } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleFont: { size: 13 },
                    bodyFont: { size: 13 },
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                if (chartType.value === 'twr') {
                                    label += (context.parsed.y > 0 ? '+' : '') + context.parsed.y.toFixed(2) + '%';
                                } else {
                                    label += Math.round(context.parsed.y).toLocaleString();
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: isMobile ? 5 : 10, font: { size: fontSize } }
                },
                y: {
                    position: 'right',
                    grid: { color: 'rgba(200, 200, 200, 0.1)' },
                    // ⚠️ 修正：增加 grace 空間防止曲線頂到天花板
                    grace: '5%',
                    ticks: {
                        font: { size: fontSize, family: 'JetBrains Mono' },
                        callback: function(val) {
                            if (chartType.value === 'twr') return val.toFixed(0) + '%';
                            if (Math.abs(val) >= 1000) return (val/1000).toFixed(1) + 'k';
                            return val;
                        }
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
};

watch(chartType, () => drawChart());
watch(() => portfolioStore.history, async () => {
    await nextTick();
    switchTimeRange(timeRange.value);
});

onMounted(async () => {
    await nextTick();
    switchTimeRange('1Y');
    if (canvas.value && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            if (myChart) myChart.resize();
        });
        resizeObserver.observe(canvas.value.parentElement);
    }
});

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (myChart) myChart.destroy();
});
</script>

<style scoped>
.inner-chart-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
    box-sizing: border-box;
    position: relative;
}

.chart-header { margin-bottom: 12px; display: flex; flex-direction: column; gap: 12px; }
.header-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }

.title-group { display: flex; align-items: center; gap: 12px; }
.chart-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); padding-left: 12px; border-left: 4px solid var(--primary); }
.loading-badge { font-size: 0.8rem; color: var(--primary); display: flex; align-items: center; gap: 6px; }
.spinner-sm { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }

.toggle-pills-scroll, .time-pills-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
.toggle-pills-scroll::-webkit-scrollbar, .time-pills-scroll::-webkit-scrollbar { display: none; }

.toggle-pills { display: flex; background: var(--bg-secondary); border-radius: 8px; padding: 3px; gap: 2px; white-space: nowrap; }
.toggle-pills button { border: none; background: transparent; padding: 6px 14px; font-size: 0.9rem; border-radius: 6px; color: var(--text-sub); cursor: pointer; transition: all 0.2s; font-weight: 500; }
.toggle-pills button.active { background: var(--bg-card); color: var(--primary); font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

.controls-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.time-pills { display: flex; background: var(--bg-secondary); border-radius: 8px; padding: 3px; gap: 2px; white-space: nowrap; }
.time-pills button { border: none; background: transparent; padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; color: var(--text-sub); cursor: pointer; transition: all 0.2s; }
.time-pills button:hover { color: var(--text-main); }
.time-pills button.active { background: var(--bg-card); color: var(--text-main); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

.right-controls { display: flex; gap: 10px; align-items: center; }

.benchmark-selector { display: flex; align-items: center; gap: 6px; }
.control-label { font-size: 0.8rem; font-weight: 600; color: var(--text-sub); }
.input-group-merged { display: flex; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; background: var(--bg-card); }
.benchmark-input { border: none; padding: 4px 8px; width: 60px; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; text-transform: uppercase; background: transparent; color: var(--text-main); text-align: center; }
.benchmark-input:focus { outline: none; background: var(--bg-secondary); }
.btn-icon-apply { border: none; background: var(--bg-secondary); color: var(--success); cursor: pointer; padding: 0 8px; font-weight: bold; border-left: 1px solid var(--border-color); }
.btn-icon-apply:disabled { color: var(--text-sub); cursor: not-allowed; }

.date-range-selector { display: flex; align-items: center; gap: 6px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 6px; }
.date-input { border: none; background: transparent; font-size: 0.85rem; width: 110px; color: var(--text-main); font-family: 'JetBrains Mono', monospace; }
.date-sep { font-size: 0.8rem; color: var(--text-sub); }

/* ⚠️ 修正：明確設定高度與 overflow，解決 Boundary Error */
.canvas-box { 
    flex-grow: 1; 
    position: relative; 
    width: 100%; 
    height: 350px; /* 固定高度比 min-height 更穩定 */
    overflow: hidden; /* 防止 canvas 溢出 */
}

.no-data-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: var(--text-sub); font-size: 1rem; }

.chart-footer { margin-top: 8px; text-align: right; border-top: 1px solid var(--border-color); padding-top: 8px; }
.info-text { font-size: 0.75rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }

@media (max-width: 768px) {
    .inner-chart-layout { padding: 16px; }
    .header-top { flex-direction: column; align-items: flex-start; gap: 12px; }
    .toggle-pills-scroll { width: 100%; }
    .toggle-pills { width: max-content; }
    
    .controls-row { flex-direction: column; align-items: flex-start; gap: 12px; }
    .time-pills-scroll { width: 100%; }
    .time-pills { width: max-content; }
    
    .right-controls { width: 100%; justify-content: space-between; }
    .benchmark-selector { flex: 1; }
    .benchmark-input { width: 100%; min-width: 0; }
    
    .date-range-selector { width: 100%; justify-content: space-between; }
    .date-input { width: auto; flex: 1; }
    
    .canvas-box { height: 300px; } /* 手機高度稍減 */
}
</style>
