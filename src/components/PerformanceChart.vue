<template>
  <div>
    <div class="chart-header">
      <div class="chart-controls">
        <button @click="chartType='twr'" :class="{active: chartType==='twr'}">績效 %</button>
        <button @click="chartType='value'" :class="{active: chartType==='value'}">淨值</button>
        <button @click="chartType='pnl'" :class="{active: chartType==='pnl'}">日損益</button>
      </div>
      <div class="chart-controls">
        <button v-for="range in ['1M','3M','6M','YTD','1Y','ALL']" 
                :key="range" 
                @click="timeRange=range" 
                :class="{active: timeRange===range}">
          {{ range }}
        </button>
      </div>
    </div>
    
    <div class="chart-container">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let chartInstance = null;

// UI 狀態
const chartType = ref('twr'); // 'twr', 'value', 'pnl'
const timeRange = ref('1Y');

// 資料處理邏輯 (移植自 index.html)
const getProcessedData = () => {
    const rawData = store.history;
    if (!rawData || rawData.length === 0) return [];

    let startDate = new Date();
    const now = new Date();
    
    switch(timeRange.value) {
        case '1M': startDate.setMonth(now.getMonth() - 1); break;
        case '3M': startDate.setMonth(now.getMonth() - 3); break;
        case '6M': startDate.setMonth(now.getMonth() - 6); break;
        case 'YTD': startDate = new Date(now.getFullYear(), 0, 1); break;
        case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
        case 'ALL': startDate = new Date('2000-01-01'); break;
    }

    // 找出區間內的第一筆資料索引
    let startIndex = rawData.findIndex(d => new Date(d.date) >= startDate);
    if (startIndex === -1) return []; // 都在區間外

    // 基準點 (Base) 設定為 StartIndex 的前一筆，讓圖表起點歸零
    let baseIndex = (startIndex > 0) ? startIndex - 1 : 0;
    const base = rawData[baseIndex];
    
    // 擷取資料
    const filtered = rawData.slice(startIndex);

    if (chartType.value === 'value') return filtered; 
    if (chartType.value === 'pnl') return filtered; // PnL 邏輯需額外處理

    // TWR 歸零重算
    return filtered.map(d => {
        const baseTwrVal = (base.twr !== undefined) ? base.twr : 0;
        const curTwrVal = (d.twr !== undefined) ? d.twr : 0;
        const newTwr = ((1 + curTwrVal/100) / (1 + baseTwrVal/100) - 1) * 100;

        const baseBench = (base.benchmark_twr !== undefined) ? base.benchmark_twr : 0;
        const curBench = (d.benchmark_twr !== undefined) ? d.benchmark_twr : 0;
        const newBench = ((1 + curBench/100) / (1 + baseBench/100) - 1) * 100;
        
        return {
            ...d,
            twr: newTwr,
            benchmark_twr: newBench,
        };
    });
};

const drawChart = () => {
    if (chartInstance) chartInstance.destroy();
    if (!canvas.value) return;

    const processedData = getProcessedData();
    if(processedData.length === 0) return;

    const labels = processedData.map(d => d.date);
    let datasets = [];
    let type = 'line';

    const commonOptions = {
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.1,
        borderWidth: 2
    };

    if (chartType.value === 'value') {
        datasets = [
            { 
                label: '總淨值', 
                data: processedData.map(d => d.total_value), 
                borderColor: '#40a9ff', 
                ...commonOptions 
            },
            { 
                label: '投入成本', 
                data: processedData.map(d => d.invested), 
                borderColor: '#888', 
                borderDash: [5, 5], 
                pointRadius: 0, 
                borderWidth: 1,
                fill: false
            }
        ];
    } else if (chartType.value === 'twr') {
        datasets = [
            { 
                label: 'TWR (%)', 
                data: processedData.map(d => d.twr), 
                borderColor: '#4caf50', 
                ...commonOptions 
            },
            { 
                label: 'SPY (%)', 
                data: processedData.map(d => d.benchmark_twr), 
                borderColor: '#ffc107', 
                borderWidth: 1.5, 
                pointRadius: 0, 
                borderDash: [2, 2], 
                fill: false 
            }
        ];
    } else if (chartType.value === 'pnl') {
        type = 'bar';
        // 計算單日損益
        const fullHistory = store.history;
        const dailyPnl = processedData.map((d) => {
             // 找出這一筆在原始陣列中的位置，以前一天來計算
             const idx = fullHistory.findIndex(x => x.date === d.date);
             if (idx <= 0) return 0;
             const prev = fullHistory[idx-1];
             const valDiff = d.total_value - prev.total_value;
             const costDiff = d.invested - prev.invested;
             return valDiff - costDiff;
        });
        
        datasets = [{
            label: '單日損益 (TWD)',
            data: dailyPnl,
            backgroundColor: dailyPnl.map(v => v >= 0 ? '#4caf50' : '#ff5252')
        }];
    }

    chartInstance = new Chart(canvas.value, {
        type: type,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#e0e0e0' } }
            },
            scales: {
                x: { 
                    grid: { color: '#2d2d30' }, 
                    ticks: { color: '#888', maxTicksLimit: 8 } 
                },
                y: { 
                    grid: { color: '#2d2d30' }, 
                    ticks: { color: '#888' } 
                }
            }
        }
    });
};

watch([chartType, timeRange, () => store.history], drawChart, { deep: true });
onMounted(drawChart);
</script>

<style scoped>
.chart-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 15px; 
    flex-wrap: wrap; 
    gap: 10px; 
}
.chart-controls { 
    display: flex; 
    gap: 5px; 
    background: #222; 
    padding: 4px; 
    border-radius: 8px; 
}
.chart-controls button { 
    background: transparent; 
    border: none; 
    color: #888; 
    padding: 4px 12px; 
    font-size: 0.8rem; 
    cursor: pointer; 
    border-radius: 6px; 
}
.chart-controls button.active { 
    background: #444; 
    color: #fff; 
    font-weight: 600; 
}
.chart-container { position: relative; height: 350px; width: 100%; }
</style>
