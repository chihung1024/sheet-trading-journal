<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <div class="title-row">
        <h3 class="chart-title">趨勢分析</h3>
        <div class="toggle-pills">
          <button :class="{active: chartType==='pnl'}" @click="chartType='pnl'" title="查看損益趨勢">
            損益
          </button>
          <button :class="{active: chartType==='twr'}" @click="chartType='twr'" title="查看報酬率趨勢">
            報酬率
          </button>
          <button :class="{active: chartType==='asset'}" @click="chartType='asset'" title="查看資產趨勢">
            資產
          </button>
        </div>
      </div>
      
      <div class="controls-row">
        <div class="time-pills">
          <button v-for="range in timeRanges" 
                  :key="range.value" 
                  :class="{active: timeRange===range.value}" 
                  @click="switchTimeRange(range.value)"
                  :title="range.label">
            {{ range.label }}
          </button>
          <button :class="{active: timeRange==='CUSTOM'}" 
                  @click="timeRange='CUSTOM'"
                  title="自訂日期範圍">
            自訂
          </button>
        </div>
        
        <div class="right-controls">
          <div class="benchmark-selector" v-if="chartType === 'twr'">
            <label class="benchmark-label">基準標的</label>
            <div class="benchmark-input-group">
              <input 
                type="text" 
                v-model="benchmarkInput" 
                placeholder="代碼"
                @keyup.enter="handleBenchmarkChange"
                :disabled="isChangingBenchmark"
                class="benchmark-input"
              />
              <button 
                @click="handleBenchmarkChange"
                :disabled="isChangingBenchmark || !benchmarkInput || benchmarkInput === portfolioStore.selectedBenchmark"
                class="btn-apply"
                title="套用新的基準標的並重新計算"
              >
                <span v-if="isChangingBenchmark">⏳</span>
                <span v-else>✓</span>
              </button>
            </div>
          </div>
          
          <div class="date-range-selector" v-if="timeRange === 'CUSTOM'">
            <div class="date-input-group">
              <label>起</label>
              <input 
                type="date" 
                v-model="customStartDate" 
                @change="onDateChange"
                :max="customEndDate || todayStr"
              />
            </div>
            <div class="date-separator">—</div>
            <div class="date-input-group">
              <label>訖</label>
              <input 
                type="date" 
                v-model="customEndDate" 
                @change="onDateChange"
                :min="customStartDate"
                :max="todayStr"
              />
            </div>
          </div>
          
          <div class="chart-info" v-if="displayedData.length > 0">
            <span class="info-text">
              共 {{ displayedData.length }} 筆資料
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="canvas-box">
      <canvas ref="canvas"></canvas>
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
  { value: 'ALL', label: '全部' }
];

const handleBenchmarkChange = async () => {
  const newBenchmark = benchmarkInput.value.trim().toUpperCase();
  
  if (!newBenchmark) {
    addToast('請輸入基準標的代碼', 'error');
    return;
  }
  
  if (newBenchmark === portfolioStore.selectedBenchmark) {
    addToast('基準標的未變更', 'info');
    return;
  }
  
  if (!confirm(`確定要將基準標的從 ${portfolioStore.selectedBenchmark} 改為 ${newBenchmark} 嗎？\n\n這將重新計算所有報酬率資料，約需 1-3 分鐘。`)) {
    benchmarkInput.value = portfolioStore.selectedBenchmark;
    return;
  }
  
  isChangingBenchmark.value = true;
  
  try {
    addToast(`🔄 正在切換基準標的至 ${newBenchmark}...`, 'info');
    await portfolioStore.triggerUpdate(newBenchmark);
    addToast(`✅ 已觸發重新計算！系統將在背景處理，完成後自動更新圖表。`, 'success');
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
        case '1M': 
            start.setMonth(now.getMonth() - 1); 
            break;
        case '3M': 
            start.setMonth(now.getMonth() - 3); 
            break;
        case '6M': 
            start.setMonth(now.getMonth() - 6); 
            break;
        case 'YTD': 
            start = new Date(now.getFullYear(), 0, 1); 
            break;
        case '1Y': 
            start.setFullYear(now.getFullYear() - 1); 
            break;
        case 'ALL': 
            start = new Date('2000-01-01'); 
            break;
    }
    
    customStartDate.value = start.toISOString().split('T')[0];
    customEndDate.value = now.toISOString().split('T')[0];
    
    filterData(start, now);
};

const onDateChange = () => {
  if (!customStartDate.value || !customEndDate.value) {
    return;
  }
  
  const start = new Date(customStartDate.value.replace(/-/g, '/'));
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(customEndDate.value.replace(/-/g, '/'));
  end.setHours(23, 59, 59, 999);
  
  if (end < start) {
    return;
  }
  
  timeRange.value = 'CUSTOM';
  filterData(start, end);
};

const filterData = (startDate, endDate = new Date()) => {
    const fullHistory = portfolioStore.history || [];
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        return;
    }

    const startDateOnly = new Date(startDate);
    startDateOnly.setHours(0, 0, 0, 0);
    
    const endDateOnly = new Date(endDate);
    endDateOnly.setHours(23, 59, 59, 999);

    let baseline = null;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const itemDate = new Date(fullHistory[i].date.replace(/-/g, '/'));
        itemDate.setHours(0, 0, 0, 0);
        
        if (itemDate < startDateOnly) {
            baseline = fullHistory[i];
            break;
        }
    }
    
    if (!baseline && fullHistory.length > 0) {
        baseline = fullHistory[0];
    }
    
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

    if (displayedData.value.length === 0 || !baselineData.value) {
        return;
    }

    let datasets = [];
    const common = { 
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2.5, 
        tension: 0.4,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2
    };

    let chartData = [];
    let labels = [];
    
    if (chartType.value === 'asset') {
        labels = displayedData.value.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
        });
        
        chartData = displayedData.value.map(d => d.total_value);
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        datasets = [{
            label: '總資產 (TWD)',
            data: chartData,
            borderColor: '#3b82f6',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else if (chartType.value === 'pnl') {
        let dataWithBaseline = [];
        
        const baselineInDisplayed = displayedData.value.some(d => d.date === baselineData.value.date);
        
        if (baselineInDisplayed) {
            dataWithBaseline = displayedData.value;
        } else {
            dataWithBaseline = [baselineData.value, ...displayedData.value];
        }
        
        labels = dataWithBaseline.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
        });
        
        const baselinePnl = baselineData.value.net_profit;
        chartData = dataWithBaseline.map(d => d.net_profit - baselinePnl);
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        
        datasets = [{
            label: '淨損益變化 (TWD)',
            data: chartData,
            borderColor: '#10b981',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else {
        let dataWithBaseline = [];
        
        const baselineInDisplayed = displayedData.value.some(d => d.date === baselineData.value.date);
        
        if (baselineInDisplayed) {
            dataWithBaseline = displayedData.value;
        } else {
            dataWithBaseline = [baselineData.value, ...displayedData.value];
        }
        
        labels = dataWithBaseline.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
        });
        
        const baseTWR = baselineData.value.twr;
        const baseBenchmark = baselineData.value.benchmark_twr;
        
        const benchmarkLabel = `${portfolioStore.selectedBenchmark} (%)`;
        
        datasets = [
            {
                label: 'TWR (%)',
                data: dataWithBaseline.map(d => ((1 + d.twr/100) / (1 + baseTWR/100) - 1) * 100),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                ...common
            },
            {
                label: benchmarkLabel,
                data: dataWithBaseline.map(d => ((1 + d.benchmark_twr/100) / (1 + baseBenchmark/100) - 1) * 100),
                borderColor: '#94a3b8',
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.4
            }
        ];
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: chartType.value === 'twr',
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 15,
                        font: {
                            size: 12,
                            family: "'Inter', sans-serif"
                        },
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-sub').trim()
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--bg-card').trim(),
                    titleColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--text-main').trim(),
                    bodyColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--text-sub').trim(),
                    borderColor: getComputedStyle(document.documentElement)
                        .getPropertyValue('--border-color').trim(),
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (chartType.value === 'twr') {
                                    const sign = context.parsed.y >= 0 ? '+' : '';
                                    label += sign + context.parsed.y.toFixed(2) + '%';
                                } else if (chartType.value === 'pnl') {
                                    const sign = context.parsed.y >= 0 ? '+' : '';
                                    label += sign + context.parsed.y.toLocaleString('zh-TW', {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    });
                                } else if (chartType.value === 'asset') {
                                    label += context.parsed.y.toLocaleString('zh-TW', {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    });
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkipPadding: 20,
                        font: {
                            size: 12
                        },
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-sub').trim()
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--border-color').trim(),
                        lineWidth: 1
                    },
                    ticks: {
                        font: {
                            size: 12,
                            family: "'JetBrains Mono', monospace"
                        },
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-sub').trim(),
                        callback: function(value) {
                            if (chartType.value === 'twr') {
                                const sign = value >= 0 ? '+' : '';
                                return sign + value.toFixed(1) + '%';
                            } else if (chartType.value === 'pnl') {
                                const sign = value >= 0 ? '+' : '';
                                return sign + value.toLocaleString('zh-TW', {
                                    notation: 'compact',
                                    compactDisplay: 'short'
                                });
                            } else if (chartType.value === 'asset') {
                                return value.toLocaleString('zh-TW', {
                                    notation: 'compact',
                                    compactDisplay: 'short'
                                });
                            }
                        }
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });
};

watch(chartType, () => {
    drawChart();
});

watch(() => portfolioStore.history, async () => {
    await nextTick();
    switchTimeRange(timeRange.value);
});

onMounted(async () => {
    await nextTick();
    switchTimeRange('1Y');
    
    if (canvas.value && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            if (myChart) {
                myChart.resize();
            }
        });
        resizeObserver.observe(canvas.value.parentElement);
    }
});

onUnmounted(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
    if (myChart) {
        myChart.destroy();
    }
});
</script>

<style scoped>
.inner-chart-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
    box-sizing: border-box;
}

.chart-header {
    margin-bottom: 16px;
}

.title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.chart-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-main);
    padding-left: 12px;
    border-left: 4px solid var(--primary);
}

.controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
}

.right-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.benchmark-selector {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 6px 12px;
    border: 2px solid var(--primary);
    animation: highlight-border 2s ease-in-out;
}

@keyframes highlight-border {
  0%, 100% { border-color: var(--primary); }
  50% { border-color: var(--warning); }
}

.benchmark-label {
    font-size: 0.85rem;
    color: var(--text-main);
    font-weight: 700;
    white-space: nowrap;
}

.benchmark-input-group {
    display: flex;
    align-items: center;
    gap: 6px;
}

.benchmark-input {
    padding: 6px 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-card);
    color: var(--text-main);
    font-size: 1rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    width: 80px;
    text-transform: uppercase;
    transition: all 0.2s ease;
}

.benchmark-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.benchmark-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-apply {
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.btn-apply:hover:not(:disabled) {
    background: var(--primary-dark);
    transform: scale(1.05);
}

.btn-apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.toggle-pills,
.time-pills {
    display: flex;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
}

.toggle-pills button,
.time-pills button {
    border: none;
    background: transparent;
    padding: 6px 14px;
    font-size: 0.85rem;
    border-radius: 6px;
    color: var(--text-sub);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
}

.toggle-pills button:hover,
.time-pills button:hover {
    color: var(--text-main);
}

.toggle-pills button.active,
.time-pills button.active {
    background: var(--bg-card);
    color: var(--primary);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.info-text {
    font-size: 0.8rem;
    color: var(--text-sub);
    font-weight: 500;
    white-space: nowrap;
}

.date-range-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 6px 12px;
}

.date-input-group {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
}

.date-input-group label {
    font-size: 0.85rem;
    color: var(--text-main);
    font-weight: 700;
    white-space: nowrap;
}

.date-input-group input[type="date"] {
    padding: 6px 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-card);
    color: var(--text-main);
    font-size: 0.95rem;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    transition: all 0.2s ease;
    width: 135px;
}

.date-input-group input[type="date"]:hover {
    border-color: var(--primary);
}

.date-input-group input[type="date"]:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.date-separator {
    color: var(--text-sub);
    font-size: 1rem;
    font-weight: 700;
}

.canvas-box {
    flex-grow: 1;
    position: relative;
    width: 100%;
    min-height: 0;
}

canvas {
    width: 100% !important;
    height: 100% !important;
}

@media (max-width: 1200px) {
    .controls-row {
        flex-wrap: wrap;
    }
    
    .right-controls {
        width: 100%;
        justify-content: flex-start;
    }
}

/* 📱 手機端深度優化 */
@media (max-width: 768px) {
    .inner-chart-layout {
        padding: 12px;
    }
    
    .chart-header {
        margin-bottom: 12px;
    }
    
    .title-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 10px;
    }
    
    .chart-title {
        font-size: 1rem;
        padding-left: 10px;
        border-left-width: 3px;
    }
    
    /* 🎯 類型切換 pill 縮小 */
    .toggle-pills {
        width: 100%;
        padding: 2px;
        border-radius: 6px;
    }
    
    .toggle-pills button {
        padding: 5px 10px;
        font-size: 0.75rem;
        border-radius: 5px;
    }
    
    .controls-row {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }
    
    /* 👉 時間區間水平滾動 */
    .time-pills {
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding: 2px;
        border-radius: 6px;
        gap: 3px;
    }
    
    .time-pills::-webkit-scrollbar {
        display: none;
    }
    
    .time-pills button {
        padding: 5px 12px;
        font-size: 0.75rem;
        white-space: nowrap;
        flex-shrink: 0;
        border-radius: 5px;
    }
    
    .right-controls {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }
    
    /* 📊 基準標的選擇器 */
    .benchmark-selector {
        width: 100%;
        justify-content: space-between;
        padding: 5px 10px;
    }
    
    .benchmark-label {
        font-size: 0.75rem;
    }
    
    .benchmark-input {
        flex: 1;
        min-width: 60px;
        font-size: 0.9rem;
        padding: 5px 7px;
    }
    
    .btn-apply {
        width: 30px;
        height: 30px;
        font-size: 0.95rem;
    }
    
    /* 📅 日期選擇器縮減 30% */
    .date-range-selector {
        width: 100%;
        justify-content: space-between;
        padding: 5px 10px;
        gap: 8px;
    }
    
    .date-input-group {
        gap: 6px;
    }
    
    .date-input-group label {
        font-size: 0.7rem;
    }
    
    .date-input-group input[type="date"] {
        flex: 1;
        width: auto;
        min-width: 100px;
        font-size: 0.85rem;
        padding: 5px 7px;
    }
    
    .date-separator {
        font-size: 0.85rem;
    }
    
    .chart-info {
        padding: 6px 10px;
        background: var(--bg-secondary);
        border-radius: 6px;
    }
    
    .info-text {
        font-size: 0.7rem;
    }
    
    .canvas-box {
        margin-top: 8px;
    }
}

/* 👍 極小手機 */
@media (max-width: 480px) {
    .inner-chart-layout {
        padding: 10px;
    }
    
    .chart-title {
        font-size: 0.95rem;
        padding-left: 8px;
    }
    
    .toggle-pills button,
    .time-pills button {
        padding: 4px 8px;
        font-size: 0.7rem;
    }
    
    .date-range-selector {
        flex-direction: column;
        gap: 6px;
        padding: 6px 8px;
    }
    
    .date-input-group {
        width: 100%;
        justify-content: space-between;
    }
    
    .date-separator {
        display: none;
    }
    
    .benchmark-input-group {
        width: 100%;
    }
    
    .benchmark-input {
        font-size: 0.85rem;
    }
}

/* 觸控優化 */
@media (hover: none) and (pointer: coarse) {
    .toggle-pills button:hover,
    .time-pills button:hover {
        color: var(--text-sub);
    }
    
    .toggle-pills button:active,
    .time-pills button:active {
        transform: scale(0.97);
    }
}
</style>