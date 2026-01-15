<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <div class="title-row">
        <h3 class="chart-title">
          趨勢分析
          <span v-if="store.currentGroupId !== 'ALL'" class="group-tag">
            {{ currentGroupName }}
          </span>
        </h3>
        
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
              <label>起始</label>
              <input 
                type="date" 
                v-model="customStartDate" 
                @change="onDateChange"
                :max="customEndDate || todayStr"
              />
            </div>
            <div class="date-separator">—</div>
            <div class="date-input-group">
              <label>結束</label>
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
              {{ displayedData.length }} 筆數據
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="canvas-box">
      <div v-if="isDataEmpty" class="empty-chart-state">
        <span class="empty-icon">📉</span>
        <p>此群組尚無歷史數據</p>
        <small>請新增交易紀錄以產生圖表</small>
      </div>
      <canvas v-show="!isDataEmpty" ref="canvas"></canvas>
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

// --- Phase 2: 群組相關 ---
const currentGroupName = computed(() => {
  const group = store.availableGroups.find(g => g.id === store.currentGroupId);
  return group ? group.name : store.currentGroupId;
});

const isDataEmpty = computed(() => !store.history || store.history.length === 0);

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

const switchTimeRange = (range) => {
    timeRange.value = range;
    
    // 如果沒有歷史數據，直接返回
    if (isDataEmpty.value) {
        displayedData.value = [];
        return;
    }

    const now = new Date();
    let start = new Date(now);
    
    // 取得歷史數據的第一天
    const firstHistoryDate = new Date(store.history[0].date);

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
            // 設定為比第一筆數據更早的日期
            start = new Date(firstHistoryDate);
            start.setDate(start.getDate() - 1);
            break;
    }
    
    // 確保 start 不會早於 2000 年 (防呆)
    if (start.getFullYear() < 2000) start = new Date('2000-01-01');

    customStartDate.value = start.toISOString().split('T')[0];
    customEndDate.value = now.toISOString().split('T')[0];
    
    filterData(start, now);
};

const onDateChange = () => {
  if (!customStartDate.value || !customEndDate.value) return;
  
  const start = new Date(customStartDate.value);
  const end = new Date(customEndDate.value);
  
  if (end < start) return;
  
  timeRange.value = 'CUSTOM';
  filterData(start, end);
};

const filterData = (startDate, endDate = new Date()) => {
    // 取得當前群組的歷史數據
    // store.history 已經是根據 currentGroupId 過濾過的
    const fullHistory = store.history || [];
    
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        if (myChart) {
            myChart.data.labels = [];
            myChart.data.datasets = [];
            myChart.update();
        }
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
        // 簡單過濾週末 (可選)
        return date >= startDate && date <= endDate && dayOfWeek !== 0 && dayOfWeek !== 6;
    });
    
    drawChart();
};

const drawChart = () => {
    if (!canvas.value) return;
    
    // 如果已有圖表實例，先銷毀
    if (myChart) {
        myChart.destroy();
        myChart = null;
    }

    if (displayedData.value.length === 0) return;

    const ctx = canvas.value.getContext('2d');
    
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

    // 取得 CSS 變數顏色
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#3b82f6';
    const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#10b981';

    if (chartType.value === 'asset') {
        const assetData = displayedData.value.map(d => d.total_value);
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, hexToRgba(primaryColor, 0.3));
        gradient.addColorStop(1, hexToRgba(primaryColor, 0));
        
        datasets = [{
            label: '總資產 (TWD)',
            data: assetData,
            borderColor: primaryColor,
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else if (chartType.value === 'pnl') {
        const pnlData = displayedData.value.map(d => d.net_profit);
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, hexToRgba(successColor, 0.3));
        gradient.addColorStop(1, hexToRgba(successColor, 0));
        
        datasets = [{
            label: '淨損益 (TWD)',
            data: pnlData,
            borderColor: successColor,
            backgroundColor: gradient,
            fill: true,
            ...common
        }];
    } else {
        // TWR 模式
        const baseTWR = baselineData.value ? baselineData.value.twr : 0;
        const baseBenchmark = baselineData.value ? baselineData.value.benchmark_twr : 0;
        
        datasets = [
            {
                label: '策略報酬 (%)',
                data: displayedData.value.map(d => d.twr - baseTWR),
                borderColor: '#8b5cf6', // Purple
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                ...common
            },
            {
                label: 'SPY (%)',
                data: displayedData.value.map(d => d.benchmark_twr - baseBenchmark),
                borderColor: '#94a3b8', // Gray
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
                        font: { size: 12, family: "'Inter', sans-serif" },
                        color: '#64748b'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                if (chartType.value === 'twr') {
                                    const sign = context.parsed.y >= 0 ? '+' : '';
                                    label += sign + context.parsed.y.toFixed(2) + '%';
                                } else {
                                    const sign = (chartType.value === 'pnl' && context.parsed.y >= 0) ? '+' : '';
                                    label += sign + context.parsed.y.toLocaleString('zh-TW', {
                                        minimumFractionDigits: 0, maximumFractionDigits: 0
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
                    grid: { display: false },
                    ticks: { maxRotation: 0, autoSkipPadding: 20, font: { size: 11 }, color: '#94a3b8' }
                },
                y: {
                    display: true,
                    grid: { color: '#e2e8f0', lineWidth: 1 },
                    ticks: {
                        font: { size: 11, family: "'JetBrains Mono', monospace" },
                        color: '#94a3b8',
                        callback: function(value) {
                            if (chartType.value === 'twr') {
                                return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
                            }
                            return (value >= 0 && chartType.value === 'pnl' ? '+' : '') + 
                                   value.toLocaleString('zh-TW', { notation: 'compact' });
                        }
                    }
                }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
};

// 輔助：Hex 轉 RGBA
const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 監聽圖表類型變更
watch(chartType, () => {
    drawChart();
});

// 【核心修改】監聽 store.history 變更
// 當群組切換時，store.history 會自動變更，觸發此 watcher
watch(() => store.history, async () => {
    await nextTick();
    // 切換群組後，重置為預設時間範圍或保留當前範圍
    // 這裡選擇嘗試保留，若無效則自動 fallback 到 ALL
    switchTimeRange(timeRange.value === 'CUSTOM' ? '1Y' : timeRange.value);
}, { deep: true });

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
    display: flex;
    align-items: center;
    gap: 8px;
}

.group-tag {
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--bg-secondary);
    color: var(--text-sub);
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid var(--border-color);
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

/* 空狀態樣式 */
.empty-chart-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text-sub);
    width: 100%;
}

.empty-icon {
    font-size: 3rem;
    margin-bottom: 12px;
    display: block;
    opacity: 0.5;
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
