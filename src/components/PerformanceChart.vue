<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <div class="title-row">
        <h3 class="chart-title">趨勢分析</h3>
        <div class="toggle-pills">
          <button :class="{active: chartType==='pnl'}" @click="chartType='pnl'">損益</button>
          <button :class="{active: chartType==='twr'}" @click="chartType='twr'">報酬率</button>
          <button :class="{active: chartType==='asset'}" @click="chartType='asset'">資產</button>
        </div>
      </div>
      
      <div class="controls-row">
        <div class="time-pills">
          <button v-for="range in ['1M','6M','YTD','1Y','ALL']" 
                  :key="range" 
                  :class="{active: timeRange===range}" 
                  @click="switchTimeRange(range)">
            {{ range }}
          </button>
        </div>
      </div>
    </div>

    <div class="canvas-box">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let myChart = null;

const chartType = ref('pnl');
const timeRange = ref('1Y');
const displayedData = ref([]);

const switchTimeRange = (range) => {
    timeRange.value = range;
    const now = new Date();
    let start = new Date(now);
    
    switch(range) {
        case '1M': start.setMonth(now.getMonth() - 1); break;
        case '6M': start.setMonth(now.getMonth() - 6); break;
        case 'YTD': start = new Date(now.getFullYear(), 0, 1); break;
        case '1Y': start.setFullYear(now.getFullYear() - 1); break;
        case 'ALL': start = new Date('2000-01-01'); break;
    }
    
    filterData(start);
};

const filterData = (startDate) => {
    const fullHistory = store.history || [];
    if (fullHistory.length === 0) return;

    displayedData.value = fullHistory.filter(d => new Date(d.date) >= startDate);
    drawChart();
};

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    const labels = displayedData.value.map(d => d.date);
    let datasets = [];
    const common = { pointRadius: 0, borderWidth: 2, tension: 0.3 };

    if (chartType.value === 'asset') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');
        datasets = [{ label: '總資產', data: displayedData.value.map(d => d.total_value), borderColor: '#2563eb', backgroundColor: gradient, fill: true, ...common }];
    } else if (chartType.value === 'pnl') {
        datasets = [{ label: '損益', data: displayedData.value.map(d => d.total_value - d.invested), borderColor: '#10b981', ...common }];
    } else {
        datasets = [
            { label: 'TWR %', data: displayedData.value.map(d => d.twr), borderColor: '#8b5cf6', ...common },
            { label: 'SPY %', data: displayedData.value.map(d => d.benchmark_twr), borderColor: '#9ca3af', borderDash: [4,4], borderWidth: 1, pointRadius: 0 }
        ];
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false, // 關鍵：讓 canvas 填滿容器
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { grid: { color: '#f3f4f6' } }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
};

watch(chartType, drawChart);
watch(() => store.history, async () => { await nextTick(); switchTimeRange('1Y'); });
onMounted(async () => { await nextTick(); switchTimeRange('1Y'); window.addEventListener('resize', () => myChart && drawChart()); });
</script>

<style scoped>
.inner-chart-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
}

.chart-header { margin-bottom: 10px; }
.title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.chart-title { margin: 0; font-size: 1rem; color: #374151; }

.toggle-pills, .time-pills { display: flex; background: #f3f4f6; border-radius: 6px; padding: 2px; }
.toggle-pills button, .time-pills button {
    border: none; background: transparent; padding: 4px 10px; font-size: 0.75rem; 
    border-radius: 4px; color: #6b7280; cursor: pointer; transition: 0.2s;
}
.toggle-pills button.active, .time-pills button.active { background: white; color: #2563eb; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

.canvas-box {
    flex-grow: 1;
    position: relative;
    width: 100%;
    min-height: 0; /* 讓 Flex item 可以收縮 */
}
</style>
