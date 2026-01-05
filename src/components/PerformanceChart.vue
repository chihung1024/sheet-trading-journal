<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="header-row main-row">
        <h3 class="title">趨勢分析</h3>
        <div class="toggle-group">
          <button :class="{active: chartType==='pnl'}" @click="chartType='pnl'">損益 $</button>
          <button :class="{active: chartType==='twr'}" @click="chartType='twr'">TWR %</button>
          <button :class="{active: chartType==='asset'}" @click="chartType='asset'">資產總值</button>
        </div>
      </div>
      
      <div class="header-row sub-row">
        <div class="toggle-group sm">
          <button v-for="range in ['1M','3M','6M','YTD','1Y','ALL']" 
                  :key="range" 
                  :class="{active: timeRange===range}" 
                  @click="switchTimeRange(range)">
            {{ range }}
          </button>
        </div>
        
        <div class="date-picker-wrapper">
          <input type="date" v-model="startDateStr" class="date-input" @change="onDateChange">
          <span class="separator">to</span>
          <input type="date" v-model="endDateStr" class="date-input" @change="onDateChange">
        </div>
      </div>
    </div>

    <div class="canvas-wrapper">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let myChart = null;

const chartType = ref('pnl');
const timeRange = ref('1Y');
const startDateStr = ref('');
const endDateStr = ref('');
const displayedData = ref([]);

const formatDate = (date) => date.toISOString().split('T')[0];

const switchTimeRange = (range) => {
    timeRange.value = range;
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    
    switch(range) {
        case '1M': start.setMonth(now.getMonth() - 1); break;
        case '3M': start.setMonth(now.getMonth() - 3); break;
        case '6M': start.setMonth(now.getMonth() - 6); break;
        case 'YTD': start = new Date(now.getFullYear(), 0, 1); break;
        case '1Y': start.setFullYear(now.getFullYear() - 1); break;
        case 'ALL': start = new Date('2000-01-01'); break;
    }
    startDateStr.value = formatDate(start);
    endDateStr.value = formatDate(end);
    filterData();
};

const onDateChange = () => {
    timeRange.value = 'CUSTOM';
    filterData();
};

const filterData = () => {
    const fullHistory = store.history || [];
    if (fullHistory.length === 0) return;

    const start = new Date(startDateStr.value);
    const end = new Date(endDateStr.value);
    end.setHours(23, 59, 59);

    const startIndex = fullHistory.findIndex(d => new Date(d.date) >= start);
    
    if (startIndex === -1) {
        displayedData.value = [];
    } else {
        let anchorPoint = (startIndex > 0) ? fullHistory[startIndex - 1] : null;
        const slicedData = fullHistory.filter(d => {
            const dDate = new Date(d.date);
            return dDate >= start && dDate <= end;
        });

        displayedData.value = slicedData.map(d => {
            let pnl_val = d.total_value - d.invested;
            let twr_val = d.twr;
            let spy_val = d.benchmark_twr;

            if (anchorPoint) {
                pnl_val -= (anchorPoint.total_value - anchorPoint.invested);
                const baseTwr = (anchorPoint.twr || 0) / 100;
                const curTwr = (d.twr || 0) / 100;
                twr_val = ((1 + curTwr) / (1 + baseTwr) - 1) * 100;

                const baseSpy = (anchorPoint.benchmark_twr || 0) / 100;
                const curSpy = (d.benchmark_twr || 0) / 100;
                spy_val = ((1 + curSpy) / (1 + baseSpy) - 1) * 100;
            }

            return { ...d, period_pnl: pnl_val, period_twr: twr_val, period_spy: spy_val };
        });
        
        // 為了圖表美觀，補上起始零點
        if (anchorPoint && displayedData.value.length > 0) {
             displayedData.value.unshift({ 
                ...anchorPoint, 
                date: anchorPoint.date,
                period_pnl: 0, period_twr: 0, period_spy: 0 
            });
        }
    }
    drawChart();
};

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    const dataPoints = displayedData.value;
    const labels = dataPoints.map(d => d.date);
    let datasets = [];

    // 設定共同樣式
    const commonOptions = { pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, tension: 0.2 };

    if (chartType.value === 'asset') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 82, 82, 0.25)');
        gradient.addColorStop(1, 'rgba(255, 82, 82, 0)');
        
        datasets = [
            { label: '總資產', data: dataPoints.map(d => d.total_value), borderColor: '#ff5252', backgroundColor: gradient, fill: true, ...commonOptions },
            { label: '淨投入', data: dataPoints.map(d => d.invested), borderColor: '#666', borderDash: [5, 5], fill: false, pointRadius: 0, borderWidth: 1.5, tension: 0 }
        ];
    } else if (chartType.value === 'pnl') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.25)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        
        const dataMap = (timeRange.value === 'ALL') ? dataPoints.map(d => d.total_value - d.invested) : dataPoints.map(d => d.period_pnl);
        datasets = [{ label: '累積損益 ($)', data: dataMap, borderColor: '#ffd700', backgroundColor: gradient, fill: true, ...commonOptions }];
    } else {
        const twrMap = (timeRange.value === 'ALL') ? dataPoints.map(d => d.twr) : dataPoints.map(d => d.period_twr);
        const spyMap = (timeRange.value === 'ALL') ? dataPoints.map(d => d.benchmark_twr) : dataPoints.map(d => d.period_spy);
        
        datasets = [
            { label: '我的 TWR %', data: twrMap, borderColor: '#ff5252', ...commonOptions },
            { label: 'SPY %', data: spyMap, borderColor: '#40a9ff', ...commonOptions }
        ];
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#ccc', boxWidth: 12, padding: 20 }, position: 'top', align: 'end' },
                tooltip: { 
                    backgroundColor: '#1f1f23', 
                    titleColor: '#fff', 
                    bodyColor: '#ccc', 
                    borderColor: '#333', 
                    borderWidth: 1,
                    padding: 10,
                    callbacks: { label: (c) => ` ${c.dataset.label}: ${Number(c.raw).toLocaleString()}` }
                }
            },
            scales: {
                x: { grid: { color: '#2d2d30' }, ticks: { color: '#666', maxTicksLimit: 6 } },
                y: { position: 'right', grid: { color: '#2d2d30' }, ticks: { color: '#666' } }
            }
        }
    });
};

watch(() => store.history, () => { if (store.history.length > 0) switchTimeRange('1Y'); }, { immediate: true });
watch(chartType, drawChart);
onMounted(() => window.addEventListener('resize', () => { if(myChart) drawChart(); }));
</script>

<style scoped>
/* 卡片容器：模擬 index.html 的 .chart-section */
.chart-card {
    background-color: #18181c;
    border: 1px solid #2d2d30;
    border-radius: 12px;
    padding: 20px;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
}

.chart-header { margin-bottom: 15px; }

/* 標題與控制列的排版 */
.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
}
.main-row { margin-bottom: 12px; }
.sub-row { justify-content: flex-end; }

.title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #eee;
    letter-spacing: 0.5px;
}

/* 按鈕群組 (Toggle Group) */
.toggle-group {
    display: flex;
    background: #2d2d30;
    border-radius: 6px;
    padding: 2px;
    border: 1px solid #333;
}

.toggle-group button {
    background: transparent;
    border: none;
    color: #888;
    padding: 6px 14px;
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    font-weight: 500;
}

.toggle-group button:hover { color: #ccc; }
.toggle-group button.active {
    background: #40a9ff;
    color: #fff;
    font-weight: 700;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.toggle-group.sm button { padding: 4px 10px; font-size: 0.8rem; }

/* 日期選擇器美化 */
.date-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #2d2d30;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid #333;
}

.date-input {
    background: transparent;
    border: none;
    color: #ccc;
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
}
/* 讓日期 icon 反白 */
.date-input::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; opacity: 0.6; }
.date-input::-webkit-calendar-picker-indicator:hover { opacity: 1; }

.separator { color: #666; font-size: 0.8rem; }

.canvas-wrapper {
    position: relative;
    width: 100%;
    height: 350px; /* 固定高度，確保圖表不會塌陷 */
    flex-grow: 1;
}

@media (max-width: 600px) {
    .header-row { flex-direction: column; align-items: stretch; }
    .toggle-group { overflow-x: auto; }
    .sub-row { flex-direction: row; flex-wrap: wrap; }
}
</style>
