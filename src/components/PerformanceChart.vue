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

const store = usePortfolioStore();
const canvas = ref(null);
let myChart = null;
let resizeObserver = null;

const chartType = ref('pnl');
const timeRange = ref('1Y');
const displayedData = ref([]);
const baselineData = ref(null);
const customStartDate = ref('');
const customEndDate = ref('');

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

// ✅ 修正：排除週末但保留區間第一天，週一的基準點為週日
const filterData = (startDate, endDate = new Date()) => {
    const fullHistory = store.history || [];
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        return;
    }

    // 1. 先找到區間內的所有資料（不過濾）
    const rangeData = fullHistory.filter(d => {
        const date = new Date(d.date.replace(/-/g, '/'));
        return date >= startDate && date <= endDate;
    });
    
    if (rangeData.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        return;
    }

    // 2. 取得區間第一天的資料
    const firstData = rangeData[0];
    const firstDate = new Date(firstData.date.replace(/-/g, '/'));
    const firstDayOfWeek = firstDate.getDay(); // 0=週日, 1=週一, ..., 6=週六

    // 3. 過濾數據：排除週末，但保留第一天（即使是週末）
    const filteredData = rangeData.filter((d, index) => {
        const date = new Date(d.date.replace(/-/g, '/'));
        const dayOfWeek = date.getDay();
        
        // 第一筆資料一定保留
        if (index === 0) return true;
        
        // 其他資料排除週六、週日
        return dayOfWeek !== 0 && dayOfWeek !== 6;
    });

    // 4. 計算基準點
    let baseline = null;
    
    // 先嘗試從 fullHistory 中找到前一天的資料
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const date = new Date(fullHistory[i].date.replace(/-/g, '/'));
        if (date < firstDate) {
            const dayOfWeek = date.getDay();
            // 如果前一天不是週末，使用它作為基準點
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                baseline = fullHistory[i];
                break;
            }
        }
    }
    
    // 5. 如果找不到非週末的前一天，或第一天就是週一，創建虛擬基準點
    if (!baseline) {
        // 計算前一天的日期（可能是週日）
        const baselineDate = new Date(firstDate);
        baselineDate.setDate(baselineDate.getDate() - 1);
        
        baseline = {
            date: baselineDate.toISOString().split('T')[0],
            total_value: firstData.invested, // 設定為投入資本，使 pnl 為 0
            invested: firstData.invested,
            twr: 0,
            benchmark_twr: 0
        };
        
        console.log('📌 創建虛擬基準點:', {
            '基準日期': baseline.date,
            '星期': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][baselineDate.getDay()],
            '第一天': firstData.date,
            '第一天星期': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][firstDayOfWeek]
        });
    }
    
    baselineData.value = baseline;
    displayedData.value = filteredData;
    
    console.log('📅 過濾資料:', {
        '區間': `${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}`,
        '第一筆資料': filteredData[0]?.date,
        '第一天星期': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][firstDayOfWeek],
        '基準點日期': baseline.date,
        '總筆數': filteredData.length,
        '包含週末': filteredData.some(d => {
            const date = new Date(d.date.replace(/-/g, '/'));
            const dow = date.getDay();
            return dow === 0 || dow === 6;
        })
    });
    
    drawChart();
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
        const basePnL = baselineData.value.total_value - baselineData.value.invested;
        const pnlData = displayedData.value.map(d => {
            const currentPnL = d.total_value - d.invested;
            return currentPnL - basePnL;
        });
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        
        datasets = [{
            label: '損益變化 (TWD)',
            data: pnlData,
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
                label: 'TWR (%)',
                data: displayedData.value.map(d => d.twr - baseTWR),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                ...common
            },
            {
                label: 'SPY (%)',
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
                                } else if (chartType.value === 'asset') {
                                    label += context.parsed.y.toLocaleString('zh-TW', {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    });
                                } else {
                                    const sign = context.parsed.y >= 0 ? '+' : '';
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
                        callback: function(value) {
                            if (chartType.value === 'twr') {
                                const sign = value >= 0 ? '+' : '';
                                return sign + value.toFixed(1) + '%';
                            } else if (chartType.value === 'asset') {
                                return value.toLocaleString('zh-TW', {
                                    notation: 'compact',
                                    compactDisplay: 'short'
                                });
                            } else {
                                const sign = value >= 0 ? '+' : '';
                                return sign + value.toLocaleString('zh-TW', {
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
}

.right-controls {
    display: flex;
    align-items: center;
    gap: 16px;
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
}
</style>