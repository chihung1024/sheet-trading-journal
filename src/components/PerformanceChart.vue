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
                      @click="timeRange=range.value">
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
            <input type="date" v-model="customStartDate" @change="applyCustomRange" :max="customEndDate || todayStr" class="date-input" />
            <span class="date-sep">to</span>
            <input type="date" v-model="customEndDate" @change="applyCustomRange" :min="customStartDate" :max="todayStr" class="date-input" />
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

const todayStr = computed(() => new Date().toISOString().split('T')[0]);

const timeRanges = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' }
];

// ✅ 合併日期處理邏輯
const parseDate = (dateStr) => {
  const d = new Date(dateStr.replace(/-/g, '/'));
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDateRange = (rangeType) => {
  const now = new Date();
  let start = new Date(now);
  
  switch(rangeType) {
    case '1M': start.setMonth(now.getMonth() - 1); break;
    case '3M': start.setMonth(now.getMonth() - 3); break;
    case '6M': start.setMonth(now.getMonth() - 6); break;
    case 'YTD': start = new Date(now.getFullYear(), 0, 1); break;
    case '1Y': start.setFullYear(now.getFullYear() - 1); break;
    case 'ALL': start = new Date('2000-01-01'); break;
    case 'CUSTOM': 
      if (customStartDate.value && customEndDate.value) {
        return { start: parseDate(customStartDate.value), end: parseDate(customEndDate.value) };
      }
      start.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return { start, end: now };
};

const handleBenchmarkChange = async () => {
  const newBenchmark = benchmarkInput.value.trim().toUpperCase();
  if (!newBenchmark || newBenchmark === portfolioStore.selectedBenchmark) {
    benchmarkInput.value = portfolioStore.selectedBenchmark;
    return;
  }
  
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

// ✅ [修復] 自訂日期變更時直接觸發篩選
const applyCustomRange = () => {
  if (!customStartDate.value || !customEndDate.value) return;
  const start = parseDate(customStartDate.value);
  const end = parseDate(customEndDate.value);
  if (end < start) {
    addToast('結束日期不能早於開始日期', 'error');
    return;
  }
  
  // 確保 timeRange 設為 CUSTOM
  if (timeRange.value !== 'CUSTOM') {
    timeRange.value = 'CUSTOM';
  } else {
    // 如果已經是 CUSTOM，直接觸發篩選（因為 watch 不會觸發）
    filterData();
  }
};

const filterData = () => {
    const fullHistory = portfolioStore.history || [];
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        drawChart();
        return;
    }

    const { start, end } = getDateRange(timeRange.value);
    const startDateOnly = new Date(start); startDateOnly.setHours(0,0,0,0);
    const endDateOnly = new Date(end); endDateOnly.setHours(23,59,59,999);

    // ✅ 修復 baseline 選擇邏輯
    let baseline = null;
    
    // 尋找區間開始前最近的數據點
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const itemDate = parseDate(fullHistory[i].date);
        if (itemDate < startDateOnly) {
            baseline = fullHistory[i];
            break;
        }
    }
    
    // ✅ 如果找不到（例如 ALL 模式），使用第一個數據點
    if (!baseline) {
        baseline = fullHistory[0];
    }
    
    baselineData.value = baseline;

    // ✅ 簡化築選邏輯
    displayedData.value = fullHistory.filter(d => {
        const itemDate = parseDate(d.date);
        const dayOfWeek = itemDate.getDay();
        return itemDate >= startDateOnly && itemDate <= endDateOnly && dayOfWeek !== 0 && dayOfWeek !== 6;
    });
    
    drawChart();
};

const drawChart = () => {
    if (!canvas.value || displayedData.value.length === 0 || !baselineData.value) return;
    
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    const isMobile = window.innerWidth < 768;
    const fontSize = isMobile ? 10 : 12;
    const labelFontSize = isMobile ? 11 : 14;

    let datasets = [];
    const common = { 
        pointRadius: 0, 
        pointHoverRadius: 5, 
        borderWidth: 2, 
        tension: 0,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2
    };

    // ✅ 簡化數據合併邏輯
    const dataWithBaseline = displayedData.value[0]?.date === baselineData.value.date 
      ? displayedData.value 
      : [baselineData.value, ...displayedData.value];
    
    const labels = (chartType.value === 'asset' ? displayedData.value : dataWithBaseline).map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    });

    if (chartType.value === 'asset') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        datasets = [{
            label: '總資產',
            data: displayedData.value.map(d => d.total_value),
            borderColor: '#3b82f6',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else if (chartType.value === 'pnl') {
        const hasBreakdown = dataWithBaseline.every(d => d.realized_pnl !== undefined);
        const basePnl = baselineData.value.net_profit;
        const baseRealized = baselineData.value.realized_pnl || 0;
        
        if (hasBreakdown) {
             datasets = [
                {
                    label: '已實現損益',
                    data: dataWithBaseline.map(d => (d.realized_pnl || 0) - baseRealized),
                    borderColor: 'rgba(34, 197, 94, 0.5)',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    fill: 'origin',
                    order: 2,
                    ...common,
                    borderWidth: 1
                },
                {
                    label: '總淨損益',
                    data: dataWithBaseline.map(d => d.net_profit - basePnl),
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    fill: false,
                    order: 1,
                    ...common
                }
             ];
        } else {
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
            
            datasets = [{
                label: '淨損益',
                data: dataWithBaseline.map(d => d.net_profit - basePnl),
                borderColor: '#10b981',
                backgroundColor: gradient,
                fill: true,
                ...common
            }];
        }
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
                tension: 0,
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
                padding: { left: 5, right: 80, top: 20, bottom: 0 }
            },
            plugins: {
                legend: {
                    display: chartType.value === 'twr' || (chartType.value === 'pnl' && datasets.length > 1),
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
                        label: (context) => {
                            let label = context.dataset.label ? context.dataset.label + ': ' : '';
                            if (context.parsed.y !== null) {
                                if (chartType.value === 'twr') {
                                    label += (context.parsed.y > 0 ? '+' : '') + context.parsed.y.toFixed(2) + '%';
                                } else {
                                    label += Math.round(context.parsed.y).toLocaleString();
                                }
                            }
                            return label;
                        },
                        afterBody: (tooltipItems) => {
                             if (chartType.value === 'pnl' && tooltipItems.length > 1) {
                                 const realized = tooltipItems.find(i => i.dataset.label === '已實現損益')?.parsed.y;
                                 const total = tooltipItems.find(i => i.dataset.label === '總淨損益')?.parsed.y;
                                 if (realized !== undefined && total !== undefined) {
                                     return `----------------\n未實現: ${Math.round(total - realized).toLocaleString()}`;
                                 }
                             }
                             return '';
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
                    display: false,
                    grid: { color: 'rgba(200, 200, 200, 0.1)' },
                    grace: '5%'
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        },
        plugins: [{
            id: 'finalValueLabel',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (!meta.hidden && dataset.data.length > 0) {
                        const lastPoint = meta.data[meta.data.length - 1];
                        const value = dataset.data[dataset.data.length - 1];
                        
                        let displayValue;
                        if (chartType.value === 'twr') {
                            displayValue = (value > 0 ? '+' : '') + value.toFixed(2) + '%';
                        } else {
                            const absVal = Math.abs(value);
                            displayValue = absVal >= 1000000 ? (value > 0 ? '+' : '') + (value/1000000).toFixed(2) + 'M'
                                         : absVal >= 1000 ? (value > 0 ? '+' : '') + (value/1000).toFixed(1) + 'k'
                                         : Math.round(value).toLocaleString();
                        }
                        
                        ctx.save();
                        ctx.font = `bold ${labelFontSize}px JetBrains Mono`;
                        ctx.fillStyle = dataset.borderColor;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(displayValue, lastPoint.x + 10, lastPoint.y);
                        ctx.restore();
                    }
                });
            }
        }]
    });
};

// ✅ 合併為單一 watch
watch([chartType, timeRange], () => {
  if (timeRange.value === 'CUSTOM') {
    const { start, end } = getDateRange('CUSTOM');
    customStartDate.value = start.toISOString().split('T')[0];
    customEndDate.value = end.toISOString().split('T')[0];
  }
  filterData();
});

watch(() => portfolioStore.history, async () => {
    await nextTick();
    filterData();
}, { deep: true });

watch(() => portfolioStore.selectedBenchmark, (newVal) => {
  benchmarkInput.value = newVal;
});

onMounted(async () => {
    await nextTick();
    filterData();
    
    if (canvas.value && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            if (canvas.value && myChart && myChart.ctx?.canvas) {
                try {
                    myChart.resize();
                } catch (e) {
                    console.warn('Chart resize failed:', e);
                }
            }
        });
        resizeObserver.observe(canvas.value.parentElement);
    }
});

onUnmounted(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    if (myChart) {
        myChart.destroy();
        myChart = null;
    }
});
</script>

<style scoped>
.inner-chart-layout { display: flex; flex-direction: column; height: 100%; padding: 20px; box-sizing: border-box; position: relative; }
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
.canvas-box { flex-grow: 1; position: relative; width: 100%; height: 450px; overflow: hidden; } 
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
    .canvas-box { height: 380px; }
}
</style>