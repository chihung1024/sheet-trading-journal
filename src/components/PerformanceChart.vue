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
          <!-- ✅ 新增：基準標的輸入框 -->
          <div class="benchmark-selector" v-if="chartType === 'twr'">
            <label class="benchmark-label">基準標的</label>
            <div class="benchmark-input-group">
              <input 
                type="text" 
                v-model="benchmarkInput" 
                placeholder="例: SPY, QQQ, 0050.TW"
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
          
          <!-- 日期選擇器 -->
          <div class="date-range-selector">
            <div class="date-input-group">
              <label>起始日期</label>
              <input 
                type="date" 
                v-model="customStartDate" 
                @change="onDateChange"
                :max="customEndDate || todayStr"
              />
            </div>
            <div class="date-separator">—</div>
            <div class="date-input-group">
              <label>結束日期</label>
              <input 
                type="date" 
                v-model="customEndDate" 
                @change="onDateChange"
                :min="customStartDate"
                :max="todayStr"
              />
            </div>
          </div>
          
          <!-- ✅ [關鍵修正] 數據筆數顯示，防止跳行 -->
          <div class="chart-info" v-if="displayedData.length > 0">
            <span class="info-text">
              共 {{ displayedData.length }} 筆數據
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

const store = usePortfolioStore();
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

// ✅ 新增：基準標的相關狀態
const benchmarkInput = ref(portfolioStore.selectedBenchmark);
const isChangingBenchmark = ref(false);

// 計算今天的日期字串
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

// ✅ 新增：處理基準標的變更
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
  
  if (!confirm(`確定要將基準標的從 ${portfolioStore.selectedBenchmark} 改為 ${newBenchmark} 嗎？\n\n這將重新計算所有報酬率數據，約需 1-3 分鐘。`)) {
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

// ✅ 監聽 Store 中的 selectedBenchmark 變化，同步更新輸入框
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
  
  const start = new Date(customStartDate.value);
  const end = new Date(customEndDate.value);
  
  if (end < start) {
    return;
  }
  
  timeRange.value = 'CUSTOM';
  filterData(start, end);
};

const filterData = (startDate, endDate = new Date()) => {
    const fullHistory = store.history || [];
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        return;
    }

    let baseline = null;
    for (let i = 0; i < fullHistory.length; i++) {
        const date = new Date(fullHistory[i].date.replace(/-/g, '/'));
        if (date >= startDate) {
            if (i > 0) {
                baseline = fullHistory[i - 1];
            } else {
                baseline = fullHistory[i];
            }
            break;
        }
    }
    
    if (!baseline && fullHistory.length > 0) {
        baseline = fullHistory[0];
    }
    
    baselineData.value = baseline;

    displayedData.value = fullHistory.filter(d => {
        const date = new Date(d.date.replace(/-/g, '/'));
        const dayOfWeek = date.getDay();
        return date >= startDate && date <= endDate && dayOfWeek !== 0 && dayOfWeek !== 6;
    });
    
    drawChart();
};

// ✅ [關鍵修正] 優化數字格式化函數
const formatYAxisValue = (value, type) => {
    if (type === 'twr') {
        // 報酬率：使用百分比
        const sign = value >= 0 ? '+' : '';
        return sign + value.toFixed(1) + '%';
    } else {
        // 損益/資產：智能簡化顯示
        const absValue = Math.abs(value);
        const sign = (type === 'pnl' && value >= 0) ? '+' : 
                     (type === 'pnl' && value < 0) ? '-' : '';
        
        let formatted;
        if (absValue >= 1000000) {
            // 大於 100 萬：顯示為 "XXM"
            formatted = (absValue / 1000000).toFixed(1) + 'M';
        } else if (absValue >= 10000) {
            // 1萬到10萬之間：顯示為 "XXK"
            formatted = (absValue / 1000).toFixed(0) + 'K';
        } else if (absValue >= 1000) {
            // 1000到1萬之間：顯示為 "X.XK"
            formatted = (absValue / 1000).toFixed(1) + 'K';
        } else {
            // 小於 1000：直接顯示
            formatted = absValue.toFixed(0);
        }
        
        return sign + formatted;
    }
};

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    if (displayedData.value.length === 0 || !baselineData.value) {
        return;
    }

    const labels = displayedData.value.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
    });
    
    let datasets = [];
    const common = { 
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2.5, 
        tension: 0.4,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2
    };

    if (chartType.value === 'asset') {
        const assetData = displayedData.value.map(d => d.total_value);
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        datasets = [{
            label: '總資產 (TWD)',
            data: assetData,
            borderColor: '#3b82f6',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else if (chartType.value === 'pnl') {
        const pnlData = displayedData.value.map(d => d.net_profit);
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        
        datasets = [{
            label: '淾損益 (TWD)',
            data: pnlData,
            borderColor: '#10b981',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else {
        const baseTWR = baselineData.value.twr;
        const baseBenchmark = baselineData.value.benchmark_twr;
        
        // ✅ 動態顯示當前的基準標的名稱
        const benchmarkLabel = `${portfolioStore.selectedBenchmark} (%)`;
        
        datasets = [
            {
                label: 'TWR (%)',
                data: displayedData.value.map(d => d.twr - baseTWR),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                ...common
            },
            {
                label: benchmarkLabel, // ✅ 使用動態標籤
                data: displayedData.value.map(d => d.benchmark_twr - baseBenchmark),
                borderColor: '#94a3b8',
                borderDash: [5, 5],
                borderWidth: 2,
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
                                } else if (chartType.value === 'asset' || chartType.value === 'pnl') {
                                    const sign = (chartType.value === 'pnl' && context.parsed.y >= 0) ? '+' : 
                                                 (chartType.value === 'pnl' && context.parsed.y < 0) ? '' : '';
                                    label += sign + context.parsed.y.toLocaleString('zh-TW', {
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
                        // ✅ [關鍵修正] 使用新的格式化函數
                        callback: function(value) {
                            return formatYAxisValue(value, chartType.value);
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

watch(() => store.history, async () => {
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
    gap: 16px;
    flex-wrap: wrap;
}

/* ✅ 新增：基準標的選擇器樣式 */
.benchmark-selector {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 8px 12px;
    border: 2px solid var(--primary);
    animation: highlight-border 2s ease-in-out;
}

@keyframes highlight-border {
  0%, 100% { border-color: var(--primary); }
  50% { border-color: var(--warning); }
}

.benchmark-label {
    font-size: 0.7rem;
    color: var(--text-sub);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.benchmark-input-group {
    display: flex;
    align-items: center;
    gap: 6px;
}

.benchmark-input {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-card);
    color: var(--text-main);
    font-size: 0.85rem;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    min-width: 140px;
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

/* ✅ [關鍵修正] 數據筆數顯示，防止跳行 */
.chart-info {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 8px 16px;
    min-width: 120px; /* ✅ 固定最小寬度 */
}

.info-text {
    font-size: 0.8rem;
    color: var(--text-sub);
    font-weight: 500;
    white-space: nowrap; /* ✅ 防止文字換行 */
    font-family: 'JetBrains Mono', monospace; /* ✅ 使用等寬字體 */
}

.date-range-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 6px 12px;
}

.date-input-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.date-input-group label {
    font-size: 0.7rem;
    color: var(--text-sub);
    font-weight: 500;
    white-space: nowrap;
}

.date-input-group input[type="date"] {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-card);
    color: var(--text-main);
    font-size: 0.8rem;
    font-family: 'Inter', sans-serif;
    transition: all 0.2s ease;
    min-width: 130px;
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
    font-size: 0.9rem;
    padding: 0 4px;
    align-self: flex-end;
    padding-bottom: 6px;
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
        justify-content: space-between;
    }
}

@media (max-width: 768px) {
    .inner-chart-layout {
        padding: 16px;
    }
    
    .title-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
    
    .controls-row {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
    }
    
    .time-pills {
        width: 100%;
        justify-content: space-between;
    }
    
    .right-controls {
        flex-direction: column;
        gap: 12px;
    }
    
    .benchmark-selector {
        width: 100%;
    }
    
    .benchmark-input {
        flex: 1;
        min-width: auto;
    }
    
    .date-range-selector {
        width: 100%;
        justify-content: center;
    }
    
    .toggle-pills button,
    .time-pills button {
        padding: 8px 10px;
        font-size: 0.8rem;
    }
    
    .chart-info {
        justify-content: center;
        width: 100%;
    }
}

@media (max-width: 480px) {
    .toggle-pills,
    .time-pills {
        padding: 2px;
    }
    
    .toggle-pills button,
    .time-pills button {
        padding: 6px 8px;
        font-size: 0.75rem;
    }
    
    .chart-title {
        font-size: 1rem;
        padding-left: 10px;
        border-left-width: 3px;
    }
    
    .date-range-selector {
        flex-direction: column;
        gap: 8px;
        padding: 8px;
    }
    
    .date-input-group {
        width: 100%;
    }
    
    .date-input-group input[type="date"] {
        width: 100%;
    }
    
    .date-separator {
        display: none;
    }
    
    .benchmark-input-group {
        width: 100%;
    }
    
    .benchmark-input {
        font-size: 0.8rem;
    }
}
</style>