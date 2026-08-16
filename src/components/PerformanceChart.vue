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
            <button :class="{active: chartType==='asset'}" @click="chartType='asset'">持倉市值</button>
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
            <div class="benchmark-control-row">
              <label class="control-label">基準</label>
              <div class="input-group-merged">
                <input 
                  type="text"
                  list="benchmark-symbol-options"
                  v-model="benchmarkInput" 
                  placeholder="SPY"
                  @keyup.enter="handleBenchmarkChange"
                  :disabled="isChangingBenchmark"
                  class="benchmark-input"
                  aria-label="要求使用的基準標的"
                />
                <datalist id="benchmark-symbol-options">
                  <option v-for="symbol in benchmarkSuggestions" :key="symbol" :value="symbol" />
                </datalist>
                <button 
                  @click="handleBenchmarkChange"
                  :disabled="isChangingBenchmark || !normalizedBenchmarkInput || normalizedBenchmarkInput === portfolioStore.selectedBenchmark"
                  class="btn-icon-apply"
                  title="儲存要求值並觸發重新計算"
                >
                  ✓
                </button>
              </div>
            </div>
            <div class="benchmark-status" :class="benchmarkApplicationState.status">
              {{ benchmarkApplicationState.statusText }}
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
        <span class="twr-reliability-warning" v-if="chartType === 'twr' && twrInvalidSince">
            策略 TWR 自 {{ twrInvalidSince }} 起無法可靠計算；該段停止繪製
        </span>
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
import {
  benchmarkLegendLabel,
  normalizeBenchmarkSymbol,
  resolveBenchmarkApplicationState,
} from '../services/benchmarkState.js';
import {
  buildComparableTwrComparison,
  firstTwrInvalidDate,
  lastFiniteSeriesIndex,
} from '../services/twrState.js';
import {
  buildCanvasSemanticFont,
  resolveSemanticFontPx,
} from '../services/designTypography.js';

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
const benchmarkSuggestions = ['SPY', '^GSPC', 'QQQ', 'VT', 'URTH', 'IXN', '^SOX', '^TWII'];

const normalizedBenchmarkInput = computed(() => normalizeBenchmarkSymbol(benchmarkInput.value));
const benchmarkApplicationState = computed(() => resolveBenchmarkApplicationState({
  snapshot: portfolioStore.rawData,
  requestedBenchmark: portfolioStore.selectedBenchmark,
}));
const publishedBenchmarkLegend = computed(() => benchmarkLegendLabel(benchmarkApplicationState.value));
const twrInvalidSince = computed(() => firstTwrInvalidDate(
  [baselineData.value, ...displayedData.value].filter(Boolean),
));

const todayStr = computed(() => new Date().toISOString().split('T')[0]);

const timeRanges = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' }
];

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
  const newBenchmark = normalizedBenchmarkInput.value;
  if (!newBenchmark) {
    addToast('基準標的格式無效', 'error');
    benchmarkInput.value = portfolioStore.selectedBenchmark;
    return;
  }
  if (newBenchmark === portfolioStore.selectedBenchmark) {
    benchmarkInput.value = portfolioStore.selectedBenchmark;
    return;
  }
  
  if (!confirm(`確定要將要求的基準標的改為 ${newBenchmark} 嗎？需重新計算所有資料。`)) {
    benchmarkInput.value = portfolioStore.selectedBenchmark;
    return;
  }
  
  isChangingBenchmark.value = true;
  try {
    addToast(`🔄 儲存要求基準 ${newBenchmark} 並觸發重新計算...`, 'info');
    await portfolioStore.triggerUpdate(newBenchmark);
    addToast('✅ 要求值已儲存；新快照完成前，圖表仍標示目前已發布基準。', 'success');
  } catch (error) {
    addToast(`❌ 切換失敗: ${error.message}`, 'error');
    benchmarkInput.value = portfolioStore.selectedBenchmark;
  } finally {
    isChangingBenchmark.value = false;
  }
};

const applyCustomRange = () => {
  if (!customStartDate.value || !customEndDate.value) return;
  const start = parseDate(customStartDate.value);
  const end = parseDate(customEndDate.value);
  if (end < start) {
    addToast('結束日期不能早於開始日期', 'error');
    return;
  }
  
  if (timeRange.value !== 'CUSTOM') {
    timeRange.value = 'CUSTOM';
  } else {
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

    let baseline = null;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const itemDate = parseDate(fullHistory[i].date);
        if (itemDate < startDateOnly) {
            baseline = fullHistory[i];
            break;
        }
    }
    if (!baseline) baseline = fullHistory[0];
    baselineData.value = baseline;

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
    const captionFontSize = resolveSemanticFontPx('--type-caption');
    const labelFontSize = resolveSemanticFontPx('--type-label');
    const canvasValueFont = buildCanvasSemanticFont({ token: '--type-label' });

    let datasets = [];
    const common = { 
        pointRadius: 0, 
        pointHoverRadius: 5, 
        borderWidth: 2, 
        tension: 0,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2
    };

    const dataWithBaseline = displayedData.value[0]?.date === baselineData.value.date 
      ? displayedData.value 
      : [baselineData.value, ...displayedData.value];
    const twrComparison = chartType.value === 'twr'
      ? buildComparableTwrComparison(dataWithBaseline)
      : null;
    const chartRows = chartType.value === 'asset'
      ? displayedData.value
      : chartType.value === 'twr'
        ? twrComparison.rows
        : dataWithBaseline;
    
    const labels = chartRows.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    });

    if (chartType.value === 'asset') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        datasets = [{
            label: '持倉市值',
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
        datasets = [
            {
                label: '策略 TWR',
                data: twrComparison.strategy,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.05)',
                fill: true,
                ...common
            },
            {
                label: publishedBenchmarkLegend.value,
                data: twrComparison.benchmark,
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
            layout: { padding: { left: 5, right: 80, top: 20, bottom: 0 } },
            plugins: {
                legend: {
                    display: chartType.value === 'twr' || (chartType.value === 'pnl' && datasets.length > 1),
                    position: 'top',
                    align: 'end',
                    labels: { boxWidth: 10, padding: 10, font: captionFontSize ? { size: captionFontSize } : undefined }
                },
                tooltip: {
                    mode: 'index', intersect: false,
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleFont: labelFontSize ? { size: labelFontSize } : undefined,
                    bodyFont: labelFontSize ? { size: labelFontSize } : undefined,
                    padding: 10,
                    callbacks: {
                        label: (context) => {
                            let label = context.dataset.label ? context.dataset.label + ': ' : '';
                            if (context.parsed.y !== null) {
                                if (chartType.value === 'twr') label += (context.parsed.y > 0 ? '+' : '') + context.parsed.y.toFixed(2) + '%';
                                else label += Math.round(context.parsed.y).toLocaleString();
                            }
                            return label;
                        },
                        afterBody: (tooltipItems) => {
                             if (chartType.value === 'pnl' && tooltipItems.length > 1) {
                                 const realized = tooltipItems.find(i => i.dataset.label === '已實現損益')?.parsed.y;
                                 const total = tooltipItems.find(i => i.dataset.label === '總淨損益')?.parsed.y;
                                 if (realized !== undefined && total !== undefined) return `----------------\n未實現: ${Math.round(total - realized).toLocaleString()}`;
                             }
                             return '';
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: isMobile ? 5 : 10, font: captionFontSize ? { size: captionFontSize } : undefined } },
                y: { display: false, grid: { color: 'rgba(200, 200, 200, 0.1)' }, grace: '5%' }
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
                        const lastIndex = lastFiniteSeriesIndex(dataset.data);
                        if (lastIndex < 0) return;
                        const lastPoint = meta.data[lastIndex];
                        const value = Number(dataset.data[lastIndex]);
                        if (!lastPoint) return;
                        let displayValue;
                        if (chartType.value === 'twr') displayValue = (value > 0 ? '+' : '') + value.toFixed(2) + '%';
                        else {
                            const absVal = Math.abs(value);
                            displayValue = absVal >= 1000000 ? (value > 0 ? '+' : '') + (value/1000000).toFixed(2) + 'M'
                                         : absVal >= 1000 ? (value > 0 ? '+' : '') + (value/1000).toFixed(1) + 'k'
                                         : Math.round(value).toLocaleString();
                        }
                        ctx.save();
                        if (canvasValueFont) ctx.font = canvasValueFont;
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

watch(() => portfolioStore.rawData?.benchmark_symbol, async () => {
  if (chartType.value === 'twr') {
    await nextTick();
    filterData();
  }
});

onMounted(async () => {
    await nextTick();
    filterData();
    if (canvas.value && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            if (canvas.value && myChart && myChart.ctx?.canvas) {
                try { myChart.resize(); }
                catch (e) { console.warn('Chart resize failed:', e); }
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
.chart-title { margin: 0; font-size: var(--type-section); font-weight: 700; color: var(--text-main); padding-left: 12px; border-left: 4px solid var(--primary); }
.loading-badge { font-size: var(--type-label); color: var(--primary); display: flex; align-items: center; gap: 6px; }
.spinner-sm { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
.toggle-pills-scroll, .time-pills-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
.toggle-pills-scroll::-webkit-scrollbar, .time-pills-scroll::-webkit-scrollbar { display: none; }
.toggle-pills { display: flex; background: var(--bg-secondary); border-radius: 8px; padding: 3px; gap: 2px; white-space: nowrap; }
.toggle-pills button { border: none; background: transparent; padding: 6px 14px; font-size: var(--type-control); border-radius: 6px; color: var(--text-sub); cursor: pointer; transition: all 0.2s; font-weight: 500; }
.toggle-pills button.active { background: var(--bg-card); color: var(--primary); font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.controls-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.time-pills { display: flex; background: var(--bg-secondary); border-radius: 8px; padding: 3px; gap: 2px; white-space: nowrap; }
.time-pills button { border: none; background: transparent; padding: 6px 12px; font-size: var(--type-control); border-radius: 6px; color: var(--text-sub); cursor: pointer; transition: all 0.2s; }
.time-pills button:hover { color: var(--text-main); }
.time-pills button.active { background: var(--bg-card); color: var(--text-main); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.right-controls { display: flex; gap: 10px; align-items: flex-start; }
.benchmark-selector { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: 360px; }
.benchmark-control-row { display: flex; align-items: center; gap: 6px; }
.benchmark-status { font-size: var(--type-caption); line-height: 1.35; text-align: right; color: var(--text-sub); }
.benchmark-status.applied { color: var(--success); }
.benchmark-status.pending { color: #d97706; }
.benchmark-status.unknown { color: var(--text-sub); }
.control-label { font-size: var(--type-label); font-weight: 600; color: var(--text-sub); }
.input-group-merged { display: flex; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; background: var(--bg-card); }
.benchmark-input { border: none; padding: 4px 8px; width: 72px; font-family: 'JetBrains Mono', monospace; font-size: var(--type-control); text-transform: uppercase; background: transparent; color: var(--text-main); text-align: center; }
.benchmark-input:focus { outline: none; background: var(--bg-secondary); }
.btn-icon-apply { border: none; background: var(--bg-secondary); color: var(--success); cursor: pointer; padding: 0 8px; font-weight: bold; border-left: 1px solid var(--border-color); }
.btn-icon-apply:disabled { color: var(--text-sub); cursor: not-allowed; }
.date-range-selector { display: flex; align-items: center; gap: 6px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 6px; }
.date-input { border: none; background: transparent; font-size: var(--type-control); width: 110px; color: var(--text-main); font-family: 'JetBrains Mono', monospace; }
.date-sep { font-size: var(--type-label); color: var(--text-sub); }
.canvas-box { flex-grow: 1; position: relative; width: 100%; height: 450px; overflow: hidden; } 
.no-data-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: var(--text-sub); font-size: var(--type-emphasis); }
.chart-footer { margin-top: 8px; text-align: right; border-top: 1px solid var(--border-color); padding-top: 8px; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
.twr-reliability-warning { font-size: var(--type-caption); color: var(--warning); }
.info-text { font-size: var(--type-caption); color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
@media (max-width: 768px) {
    .inner-chart-layout { padding: 16px; }
    .header-top { flex-direction: column; align-items: flex-start; gap: 12px; }
    .toggle-pills-scroll { width: 100%; } 
    .toggle-pills { width: max-content; } 
    .controls-row { flex-direction: column; align-items: flex-start; gap: 12px; }
    .time-pills-scroll { width: 100%; }
    .time-pills { width: max-content; }
    .right-controls { width: 100%; justify-content: space-between; }
    .benchmark-selector { flex: 1; align-items: flex-start; max-width: none; }
    .benchmark-status { text-align: left; }
    .benchmark-input { width: 100%; min-width: 0; }
    .date-range-selector { width: 100%; justify-content: space-between; }
    .date-input { width: auto; flex: 1; }
    .canvas-box { height: 380px; }
}
</style>