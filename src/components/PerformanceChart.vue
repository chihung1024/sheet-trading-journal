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
    console.log(`📈 [filterData] 收到 ${fullHistory.length} 筆 history 數據`);
    
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        drawChart(); // Clear chart
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
    console.log(`📈 [filterData] 過濾後 ${filteredData.length} 筆數據，準備繪圖`);
    drawChart();
};

const drawChart = () => {
    console.log('🎨 [drawChart] 開始繪製圖表...');
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    if (displayedData.value.length === 0 || !baselineData.value) return;

    // RWD 設定：檢查視窗寬度，動態調整字體
    const isMobile = window.innerWidth < 768;
    const fontSize = isMobile ? 10 : 12;
    const labelFontSize = isMobile ? 11 : 14; /* ✅ 最終數值標籤字體加大 */

    let datasets = [];
    const common = { 
        pointRadius: 0, 
        pointHoverRadius: 5, 
        borderWidth: 2, 
        tension: 0, /* ✅ IB 風格：直線圖，無平滑 */
        pointBackgroundColor: 'white',
        pointBorderWidth: 2
    };

    let chartData = [];
    let labels = [];
    
    // 準備數據 (確保包含 baseline 以正確計算起始點 0%)
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
        // 資產模式 (絕對值)
        chartData = displayedData.value.map(d => d.total_value);
        // 重設 labels 對應 displayedData
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
        // [v2.40] 支援已實現/未實現分離顯示
        const hasBreakdown = dataWithBaseline.every(d => d.realized_pnl !== undefined);
        
        if (hasBreakdown) {
             const baseRealized = baselineData.value.realized_pnl || 0;
             const baseUnrealized = baselineData.value.unrealized_pnl || 0;
             
             // Dataset 1: 已實現損益 (Area)
             const realizedData = dataWithBaseline.map(d => (d.realized_pnl || 0) - baseRealized);
             
             // Dataset 2: 總損益 (Line)
             const totalData = dataWithBaseline.map(d => (d.net_profit || 0) - baselineData.value.net_profit);
             
             datasets = [
                {
                    label: '已實現損益',
                    data: realizedData,
                    borderColor: 'rgba(34, 197, 94, 0.5)',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    fill: 'origin',
                    order: 2,
                    ...common,
                    borderWidth: 1
                },
                {
                    label: '總淨損益',
                    data: totalData,
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    fill: false,
                    order: 1,
                    ...common
                }
             ];
        } else {
            // [v2.39] 舊版相容邏輯
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
        }
    } else {
        // TWR 模式 (百分比)
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
                padding: { left: 5, right: 80, top: 20, bottom: 0 } /* ✅ 右側 padding 增加至 80px */
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
                        },
                        afterBody: function(tooltipItems) {
                             if (chartType.value === 'pnl' && tooltipItems.length > 1) {
                                 const realizedItem = tooltipItems.find(i => i.dataset.label === '已實現損益');
                                 const totalItem = tooltipItems.find(i => i.dataset.label === '總淨損益');
                                 
                                 if (realizedItem && totalItem) {
                                     const realized = realizedItem.parsed.y;
                                     const total = totalItem.parsed.y;
                                     const unrealized = total - realized;
                                     return `----------------\n未實現: ${Math.round(unrealized).toLocaleString()}`;
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
                    display: false, /* ✅ 隱藏 Y 軸刻度，避免與標籤重疊 */
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
                            if (absVal >= 1000000) {
                                displayValue = (value > 0 ? '+' : '') + (value/1000000).toFixed(2) + 'M';
                            } else if (absVal >= 1000) {
                                displayValue = (value > 0 ? '+' : '') + (value/1000).toFixed(1) + 'k';
                            } else {
                                displayValue = Math.round(value).toLocaleString();
                            }
                        }
                        
                        ctx.save();
                        ctx.font = `bold ${labelFontSize}px JetBrains Mono`; /* ✅ 使用動態字體大小 */
                        ctx.fillStyle = dataset.borderColor;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(displayValue, lastPoint.x + 10, lastPoint.y); /* ✅ 標籤左移 10px */
                        ctx.restore();
                    }
                });
            }
        }]
    });
    console.log('✅ [drawChart] 圖表繪製完成');
};

watch(chartType, () => {
    console.log('🎨 [chartType changed] 重新繪製圖表');
    drawChart();
});

// 🔧 修復：使用 deep watch 確保檢測到 array 內容變化
watch(() => portfolioStore.history, async (newHistory, oldHistory) => {
    const newLength = newHistory?.length || 0;
    const oldLength = oldHistory?.length || 0;
    const latestRealized = newHistory?.[newHistory.length - 1]?.realized_pnl || 0;
    
    console.log(`📊 [history watch 觸發] 長度: ${oldLength} → ${newLength}, 最新 realized_pnl: ${latestRealized}`);
    
    await nextTick();
    switchTimeRange(timeRange.value);
}, { deep: true }); // ✅ 添加 deep: true

onMounted(async () => {
    console.log('🎬 [PerformanceChart] 組件已掛載');
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

/* 頂部區域：標題 + 圖表類型 */
.header-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }

.title-group { display: flex; align-items: center; gap: 12px; }
.chart-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); padding-left: 12px; border-left: 4px solid var(--primary); }
.loading-badge { font-size: 0.8rem; color: var(--primary); display: flex; align-items: center; gap: 6px; }
.spinner-sm { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }

/* 捲動容器：Pills (手機優化) */
.toggle-pills-scroll, .time-pills-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
.toggle-pills-scroll::-webkit-scrollbar, .time-pills-scroll::-webkit-scrollbar { display: none; }

.toggle-pills { display: flex; background: var(--bg-secondary); border-radius: 8px; padding: 3px; gap: 2px; white-space: nowrap; }
.toggle-pills button { border: none; background: transparent; padding: 6px 14px; font-size: 0.9rem; border-radius: 6px; color: var(--text-sub); cursor: pointer; transition: all 0.2s; font-weight: 500; }
.toggle-pills button.active { background: var(--bg-card); color: var(--primary); font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

/* 控制列：時間 + 右側工具 */
.controls-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.time-pills { display: flex; background: var(--bg-secondary); border-radius: 8px; padding: 3px; gap: 2px; white-space: nowrap; }
.time-pills button { border: none; background: transparent; padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; color: var(--text-sub); cursor: pointer; transition: all 0.2s; }
.time-pills button:hover { color: var(--text-main); }
.time-pills button.active { background: var(--bg-card); color: var(--text-main); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

.right-controls { display: flex; gap: 10px; align-items: center; }

/* 基準輸入框 (Compact) */
.benchmark-selector { display: flex; align-items: center; gap: 6px; }
.control-label { font-size: 0.8rem; font-weight: 600; color: var(--text-sub); }
.input-group-merged { display: flex; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; background: var(--bg-card); }
.benchmark-input { border: none; padding: 4px 8px; width: 60px; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; text-transform: uppercase; background: transparent; color: var(--text-main); text-align: center; }
.benchmark-input:focus { outline: none; background: var(--bg-secondary); }
.btn-icon-apply { border: none; background: var(--bg-secondary); color: var(--success); cursor: pointer; padding: 0 8px; font-weight: bold; border-left: 1px solid var(--border-color); }
.btn-icon-apply:disabled { color: var(--text-sub); cursor: not-allowed; }

/* 日期選擇器 */
.date-range-selector { display: flex; align-items: center; gap: 6px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 6px; }
.date-input { border: none; background: transparent; font-size: 0.85rem; width: 110px; color: var(--text-main); font-family: 'JetBrains Mono', monospace; }
.date-sep { font-size: 0.8rem; color: var(--text-sub); }

/* 圖表畫布 */
.canvas-box { 
    flex-grow: 1; 
    position: relative; 
    width: 100%; 
    height: 450px; /* ✅ 桓面版高度從 350px 增加至 450px */
    overflow: hidden; 
} 

.no-data-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: var(--text-sub); font-size: 1rem; }

.chart-footer { margin-top: 8px; text-align: right; border-top: 1px solid var(--border-color); padding-top: 8px; }
.info-text { font-size: 0.75rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }

/* RWD Mobile */
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
    
    .canvas-box { height: 380px; } /* ✅ 手機版高度從 300px 增加至 380px */
}
</style>