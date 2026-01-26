<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <div class="header-top">
        <div class="title-group">
          <h3 class="chart-title">趨勢分析</h3>
          <div class="segmented-control type-selector">
            <button 
              v-for="type in chartTypes" 
              :key="type.value"
              :class="{ active: chartType === type.value }" 
              @click="chartType = type.value"
            >
              {{ type.label }}
            </button>
          </div>
        </div>
        
        <div class="benchmark-wrapper" v-if="chartType === 'twr'">
          <div class="benchmark-input-group" :class="{ 'is-loading': isChangingBenchmark }">
            <span class="prefix-icon">🆚</span>
            <input 
              type="text" 
              v-model="benchmarkInput" 
              placeholder="基準代碼 (如 SPY)"
              @keyup.enter="handleBenchmarkChange"
              :disabled="isChangingBenchmark"
              class="benchmark-input"
            />
            <button 
              class="btn-icon-action"
              @click="handleBenchmarkChange"
              :disabled="isChangingBenchmark || !benchmarkInput || benchmarkInput === portfolioStore.selectedBenchmark"
              title="套用新的基準標的"
            >
              <span v-if="isChangingBenchmark" class="animate-spin">⟳</span>
              <span v-else>✓</span>
            </button>
          </div>
        </div>
      </div>
      
      <div class="header-bottom">
        <div class="segmented-control time-selector">
          <button 
            v-for="range in timeRanges" 
            :key="range.value" 
            :class="{ active: timeRange === range.value }" 
            @click="switchTimeRange(range.value)"
          >
            {{ range.label }}
          </button>
          <button 
            :class="{ active: timeRange === 'CUSTOM' }" 
            @click="timeRange = 'CUSTOM'"
          >
            自訂
          </button>
        </div>
        
        <div class="date-range-group">
          <div class="date-input-wrapper">
            <input 
              type="date" 
              v-model="customStartDate" 
              @change="onDateChange"
              :max="customEndDate || todayStr"
              class="custom-date-input"
            />
          </div>
          <span class="separator">to</span>
          <div class="date-input-wrapper">
            <input 
              type="date" 
              v-model="customEndDate" 
              @change="onDateChange"
              :min="customStartDate"
              :max="todayStr"
              class="custom-date-input"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="canvas-container">
      <div v-if="displayedData.length === 0" class="no-data-overlay">
        <span>暫無數據，請嘗試選擇其他時間範圍</span>
      </div>
      <canvas ref="canvas"></canvas>
    </div>
    
    <div class="chart-footer" v-if="displayedData.length > 0">
      <span class="info-tag">
        <span class="dot"></span>
        共 {{ displayedData.length }} 筆交易日數據
      </span>
      <span class="info-tag" v-if="baselineData">
        基準日: {{ formatDate(baselineData.date) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onUnmounted, computed } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { useDarkMode } from '../composables/useDarkMode';

const portfolioStore = usePortfolioStore();
const { addToast } = useToast();
const { isDark } = useDarkMode();

const canvas = ref(null);
let myChart = null;
let resizeObserver = null;

// UI States
const chartType = ref('pnl');
const timeRange = ref('1Y');
const displayedData = ref([]);
const baselineData = ref(null);
const customStartDate = ref('');
const customEndDate = ref('');

const benchmarkInput = ref(portfolioStore.selectedBenchmark);
const isChangingBenchmark = ref(false);

// Constants
const chartTypes = [
  { value: 'pnl', label: '損益 P&L' },
  { value: 'twr', label: '報酬率 %' },
  { value: 'asset', label: '總資產' }
];

const timeRanges = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' }
];

const todayStr = computed(() => {
  const today = new Date();
  return today.toISOString().split('T')[0];
});

const formatDate = (dateStr) => {
    if(!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-TW');
};

// Benchmark Handler
const handleBenchmarkChange = async () => {
  const newBenchmark = benchmarkInput.value.trim().toUpperCase();
  if (!newBenchmark) {
    addToast('請輸入基準標的代碼', 'error');
    return;
  }
  if (newBenchmark === portfolioStore.selectedBenchmark) return;
  
  if (!confirm(`確定切換基準為 ${newBenchmark} 嗎？\n這將重新計算 TWR 歷史數據。`)) {
    benchmarkInput.value = portfolioStore.selectedBenchmark;
    return;
  }
  
  isChangingBenchmark.value = true;
  try {
    addToast(`正在重新計算基準 ${newBenchmark}...`, 'info');
    await portfolioStore.triggerUpdate(newBenchmark);
    addToast(`已觸發更新！系統將在背景處理。`, 'success');
  } catch (error) {
    addToast(`切換失敗: ${error.message}`, 'error');
    benchmarkInput.value = portfolioStore.selectedBenchmark;
  } finally {
    isChangingBenchmark.value = false;
  }
};

watch(() => portfolioStore.selectedBenchmark, (newVal) => {
  benchmarkInput.value = newVal;
});

// Time Range Logic
const switchTimeRange = (range) => {
    timeRange.value = range;
    const now = new Date();
    let start = new Date(now);
    
    if (range === 'CUSTOM') {
      if (!customStartDate.value || !customEndDate.value) {
        start.setFullYear(now.getFullYear() - 1);
        customStartDate.value = start.toISOString().split('T')[0];
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
  const start = new Date(customStartDate.value);
  const end = new Date(customEndDate.value);
  if (end < start) return;
  
  timeRange.value = 'CUSTOM';
  filterData(start, end);
};

// Data Filtering
const filterData = (startDate, endDate = new Date()) => {
    const fullHistory = portfolioStore.history || [];
    if (fullHistory.length === 0) {
        displayedData.value = [];
        baselineData.value = null;
        drawChart();
        return;
    }

    const startMs = new Date(startDate).setHours(0,0,0,0);
    const endMs = new Date(endDate).setHours(23,59,59,999);

    // Find Baseline
    let baseline = null;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
        const itemDate = new Date(fullHistory[i].date).setHours(0,0,0,0);
        if (itemDate < startMs) {
            baseline = fullHistory[i];
            break;
        }
    }
    if (!baseline && fullHistory.length > 0) baseline = fullHistory[0];
    baselineData.value = baseline;

    // Filter Range
    const filtered = fullHistory.filter(d => {
        const itemMs = new Date(d.date).setHours(0,0,0,0);
        const day = new Date(d.date).getDay();
        return itemMs >= startMs && itemMs <= endMs && day !== 0 && day !== 6;
    });
    
    displayedData.value = filtered;
    drawChart();
};

// Chart Drawing
const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    if (displayedData.value.length === 0 || !baselineData.value) return;

    // --- Theme Variables ---
    const style = getComputedStyle(document.documentElement);
    const colorTextMain = style.getPropertyValue('--text-main').trim();
    const colorTextSub = style.getPropertyValue('--text-sub').trim();
    const colorBorder = style.getPropertyValue('--border-color').trim();
    const colorPrimary = style.getPropertyValue('--primary').trim();
    const colorSuccess = style.getPropertyValue('--success').trim();
    const colorBgCard = style.getPropertyValue('--bg-card').trim();

    // Prepare Data
    let labels = [];
    let datasets = [];
    let dataWithBaseline = [];
    
    const baselineInDisplayed = displayedData.value.some(d => d.date === baselineData.value.date);
    dataWithBaseline = baselineInDisplayed ? displayedData.value : [baselineData.value, ...displayedData.value];
    
    labels = dataWithBaseline.map(d => new Date(d.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }));

    const commonOptions = {
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2,
        tension: 0.3,
        pointBackgroundColor: colorBgCard,
        pointBorderWidth: 2
    };

    // --- Chart Logic ---
    if (chartType.value === 'asset') {
        // Asset Chart
        const data = dataWithBaseline.map(d => d.total_value);
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, isDark.value ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        datasets.push({
            label: '總資產',
            data: data,
            borderColor: colorPrimary,
            backgroundColor: gradient,
            fill: true,
            ...commonOptions
        });

    } else if (chartType.value === 'pnl') {
        // P&L Chart
        const basePnl = baselineData.value.net_profit;
        const data = dataWithBaseline.map(d => d.net_profit - basePnl);
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, isDark.value ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.3)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        datasets.push({
            label: '淨損益變動',
            data: data,
            borderColor: colorSuccess,
            backgroundColor: gradient,
            fill: true,
            ...commonOptions
        });

    } else {
        // TWR Chart
        const baseTWR = baselineData.value.twr;
        const baseBench = baselineData.value.benchmark_twr;
        
        const myTWR = dataWithBaseline.map(d => ((1 + d.twr/100) / (1 + baseTWR/100) - 1) * 100);
        const benchTWR = dataWithBaseline.map(d => ((1 + d.benchmark_twr/100) / (1 + baseBench/100) - 1) * 100);

        datasets.push({
            label: '策略 TWR',
            data: myTWR,
            borderColor: '#8b5cf6', // Violet
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: true,
            ...commonOptions
        });
        
        datasets.push({
            label: `${portfolioStore.selectedBenchmark}`,
            data: benchTWR,
            borderColor: colorTextSub,
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 0,
            tension: 0.3,
            fill: false
        });
    }

    // --- Config ---
    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: chartType.value === 'twr',
                    align: 'end',
                    labels: { color: colorTextSub, usePointStyle: true, boxWidth: 8 }
                },
                tooltip: {
                    backgroundColor: colorBgCard,
                    titleColor: colorTextMain,
                    bodyColor: colorTextSub,
                    borderColor: colorBorder,
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    titleFont: { family: 'Inter', size: 13, weight: '600' },
                    bodyFont: { family: 'JetBrains Mono', size: 12 },
                    callbacks: {
                        label: (ctx) => {
                            let val = ctx.parsed.y;
                            let label = ctx.dataset.label || '';
                            if (chartType.value === 'asset') return `${label}: ${val.toLocaleString()} TWD`;
                            if (chartType.value === 'pnl') return `${label}: ${val > 0 ? '+' : ''}${val.toLocaleString()} TWD`;
                            return `${label}: ${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: colorTextSub, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                    ticks: { color: colorTextSub }
                }
            }
        }
    });
};

// Observers & Watchers
watch([chartType, isDark], () => drawChart());
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
  padding: 24px;
  gap: 16px;
}

/* Header Area */
.chart-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-top, .header-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.chart-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}
.chart-title::before {
  content: '';
  width: 4px; height: 18px;
  background: var(--primary);
  border-radius: 2px;
  display: block;
}

/* Segmented Controls */
.segmented-control {
  display: flex;
  background: var(--bg-secondary);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.segmented-control button {
  background: transparent;
  border: none;
  padding: 6px 14px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-sub);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  white-space: nowrap;
}

.segmented-control button:hover {
  color: var(--text-main);
}

.segmented-control button.active {
  background: var(--bg-card);
  color: var(--primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

/* Benchmark Input */
.benchmark-input-group {
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px 8px;
  transition: border-color 0.2s;
}
.benchmark-input-group:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
.prefix-icon { font-size: 1rem; margin-right: 6px; }

.benchmark-input {
  background: transparent;
  border: none;
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 0.9rem;
  width: 100px;
  text-transform: uppercase;
  outline: none;
}

.btn-icon-action {
  background: var(--primary);
  color: white;
  border: none;
  width: 24px; height: 24px;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  margin-left: 4px;
}
.btn-icon-action:disabled { opacity: 0.5; cursor: not-allowed; }
.animate-spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Date Range */
.date-range-group {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}
.custom-date-input {
  background: transparent;
  border: none;
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
}
.separator { color: var(--text-sub); font-size: 0.8rem; }

/* Canvas Area */
.canvas-container {
  flex: 1;
  position: relative;
  min-height: 300px;
  width: 100%;
}
.no-data-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--bg-card-rgb), 0.5);
  backdrop-filter: blur(2px);
  z-index: 10;
  color: var(--text-sub);
  font-weight: 500;
}

/* Footer */
.chart-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}
.info-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-sub);
}
.dot {
  width: 6px; height: 6px;
  background: var(--success);
  border-radius: 50%;
}

/* Responsive */
@media (max-width: 768px) {
  .header-top, .header-bottom { flex-direction: column; align-items: stretch; }
  .title-group { justify-content: space-between; }
  .benchmark-wrapper { width: 100%; }
  .benchmark-input-group { width: 100%; }
  .benchmark-input { width: 100%; }
  .segmented-control { overflow-x: auto; }
  .date-range-group { justify-content: space-between; }
}
</style>
