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
        </div>
        
        <div class="chart-info" v-if="displayedData.length > 0">
          <span class="info-text">
            共 {{ displayedData.length }} 筆數據
          </span>
        </div>
      </div>
    </div>

    <div class="canvas-box">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let myChart = null;
let resizeObserver = null;

const chartType = ref('pnl');
const timeRange = ref('1Y');
const displayedData = ref([]);

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
    
    filterData(start);
};

const filterData = (startDate) => {
    const fullHistory = store.history || [];
    if (fullHistory.length === 0) {
        displayedData.value = [];
        return;
    }

    displayedData.value = fullHistory.filter(d => new Date(d.date) >= startDate);
    drawChart();
};

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    if (displayedData.value.length === 0) {
        return;
    }

    const labels = displayedData.value.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
    });
    
    let datasets = [];
    const common = { 
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2.5, 
        tension: 0.4,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2
    };

    if (chartType.value === 'asset') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        datasets = [{
            label: '總資產 (TWD)',
            data: displayedData.value.map(d => d.total_value),
            borderColor: '#3b82f6',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else if (chartType.value === 'pnl') {
        const pnlData = displayedData.value.map(d => d.total_value - d.invested);
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        
        datasets = [{
            label: '損益 (TWD)',
            data: pnlData,
            borderColor: '#10b981',
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else {
        datasets = [
            {
                label: 'TWR (%)',
                data: displayedData.value.map(d => d.twr),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                ...common
            },
            {
                label: 'SPY (%)',
                data: displayedData.value.map(d => d.benchmark_twr),
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
                            size: 11,
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
                                    label += context.parsed.y.toFixed(2) + '%';
                                } else {
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
                            size: 10
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
                            size: 10,
                            family: "'JetBrains Mono', monospace"
                        },
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-sub').trim(),
                        callback: function(value) {
                            if (chartType.value === 'twr') {
                                return value.toFixed(1) + '%';
                            }
                            return value.toLocaleString('zh-TW', {
                                notation: 'compact',
                                compactDisplay: 'short'
                            });
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

// 監聽圖表類型變化
watch(chartType, () => {
    drawChart();
});

// 監聽數據變化
watch(() => store.history, async () => {
    await nextTick();
    switchTimeRange(timeRange.value);
});

onMounted(async () => {
    await nextTick();
    switchTimeRange('1Y');
    
    // 使用 ResizeObserver 監聽容器大小變化
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
    gap: 12px;
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

/* 響應式設計 */
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
    }
    
    .time-pills {
        width: 100%;
        justify-content: space-between;
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
}
</style>
