<template>
  <div class="chart-section">
    <div class="chart-controls">
      <div class="control-row">
        <h3 class="chart-title">趨勢分析</h3>
        <div class="btn-group">
          <button :class="{active: chartType==='pnl'}" @click="chartType='pnl'">損益$</button>
          <button :class="{active: chartType==='twr'}" @click="chartType='twr'">TWR%</button>
          <button :class="{active: chartType==='asset'}" @click="chartType='asset'">資產</button>
        </div>
      </div>
      
      <div class="control-row">
        <div class="btn-group">
          <button v-for="range in ['1M','3M','6M','1Y','YTD','ALL']" 
                  :key="range" 
                  :class="{active: timeRange===range}" 
                  @click="switchTimeRange(range)">
            {{ range }}
          </button>
        </div>
        <div class="date-picker-group">
          <input type="date" v-model="startDateStr" class="date-input" @change="onDateChange">
          <span style="color:#666;font-size:0.8rem">to</span>
          <input type="date" v-model="endDateStr" class="date-input" @change="onDateChange">
        </div>
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
let myChart = null;

// UI 狀態
const chartType = ref('pnl'); // 'pnl', 'twr', 'asset'
const timeRange = ref('1Y');
const startDateStr = ref('');
const endDateStr = ref('');
const displayedData = ref([]);

const formatDate = (date) => date.toISOString().split('T')[0];

// 切換時間範圍邏輯
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

// 資料過濾與重算邏輯 (Re-anchoring)
const filterData = () => {
    const fullHistory = store.history;
    if (!fullHistory || fullHistory.length === 0) return;

    const start = new Date(startDateStr.value);
    const end = new Date(endDateStr.value);
    end.setHours(23, 59, 59);

    // 找出區間起始點
    const startIndex = fullHistory.findIndex(d => new Date(d.date) >= start);
    
    if (startIndex === -1) {
        displayedData.value = [];
    } else {
        // 錨點 (Anchor Point)：用於歸零計算，通常取區間開始前一筆
        let anchorPoint = (startIndex > 0) ? fullHistory[startIndex - 1] : null;
        
        // 篩選範圍內的資料
        const slicedData = fullHistory.filter(d => {
            const dDate = new Date(d.date);
            return dDate >= start && dDate <= end;
        });

        // 重算相對數值
        displayedData.value = slicedData.map(d => {
            let pnl_val = d.total_value - d.invested;
            let twr_val = d.twr;
            let spy_val = d.benchmark_twr;

            if (anchorPoint) {
                // 累積損益扣除起始點損益
                pnl_val -= (anchorPoint.total_value - anchorPoint.invested);
                
                // TWR 幾何連結重算
                // Formula: (1 + Current) / (1 + Start) - 1
                const baseTwr = (anchorPoint.twr || 0) / 100;
                const curTwr = (d.twr || 0) / 100;
                twr_val = ((1 + curTwr) / (1 + baseTwr) - 1) * 100;

                const baseSpy = (anchorPoint.benchmark_twr || 0) / 100;
                const curSpy = (d.benchmark_twr || 0) / 100;
                spy_val = ((1 + curSpy) / (1 + baseSpy) - 1) * 100;
            }

            return { 
                ...d, 
                period_pnl: pnl_val, 
                period_twr: twr_val, 
                period_spy: spy_val 
            };
        });

        // 如果有錨點，補上一個 (0,0) 的起始點讓圖表好看
        if (anchorPoint && displayedData.value.length > 0) {
            displayedData.value.unshift({ 
                ...anchorPoint, 
                date: anchorPoint.date, // 這裡或許可以用 startDateStr 但為了準確用 anchor date
                period_pnl: 0, 
                period_twr: 0, 
                period_spy: 0 
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
    const isMobile = window.innerWidth < 768;
    
    let datasets = [];

    if (chartType.value === 'asset') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 82, 82, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 82, 82, 0)');
        
        datasets = [
            { 
                label: '總資產', 
                data: dataPoints.map(d => d.total_value), 
                borderColor: '#ff5252', 
                backgroundColor: gradient, 
                borderWidth: 2, 
                fill: true, 
                pointRadius: 0, 
                tension: 0.1 
            }, 
            { 
                label: '淨投入', 
                data: dataPoints.map(d => d.invested), 
                borderColor: '#666', 
                borderWidth: 2, 
                borderDash: [5, 5], 
                fill: false, 
                pointRadius: 0, 
                tension: 0 
            }
        ];
    } else if (chartType.value === 'pnl') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        
        const dataMap = (timeRange.value === 'ALL') 
            ? dataPoints.map(d => d.total_value - d.invested) // ALL 模式顯示絕對損益
            : dataPoints.map(d => d.period_pnl);            // 其他模式顯示區間相對損益
            
        datasets = [{ 
            label: '累積損益 ($)', 
            data: dataMap, 
            borderColor: '#ffd700', 
            backgroundColor: gradient, 
            borderWidth: 2, 
            fill: true, 
            pointRadius: 0, 
            tension: 0.1 
        }];
    } else {
        // TWR
        const twrMap = (timeRange.value === 'ALL') ? dataPoints.map(d => d.twr) : dataPoints.map(d => d.period_twr);
        const spyMap = (timeRange.value === 'ALL') ? dataPoints.map(d => d.benchmark_twr) : dataPoints.map(d => d.period_spy);
        
        datasets = [
            { 
                label: '我的 TWR %', 
                data: twrMap, 
                borderColor: '#ff5252', 
                borderWidth: 2, 
                pointRadius: 0, 
                tension: 0.1 
            }, 
            { 
                label: 'SPY %', 
                data: spyMap, 
                borderColor: '#40a9ff', 
                borderWidth: 2, 
                pointRadius: 0, 
                tension: 0.1 
            }
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
                legend: { 
                    labels: { color: '#ccc' }, 
                    position: 'top', 
                    align: 'end' 
                },
                tooltip: {
                    backgroundColor: 'rgba(24, 24, 28, 0.9)',
                    callbacks: {
                        label: (ctx) => {
                            let val = ctx.parsed.y;
                            return ctx.dataset.label + ': ' + (val ? val.toLocaleString() : '0');
                        }
                    }
                }
            },
            scales: {
                x: { 
                    grid: { color: '#2d2d30' }, 
                    ticks: { color: '#666', maxTicksLimit: isMobile ? 4 : 8 } 
                },
                y: { 
                    position: 'right', 
                    grid: { color: '#2d2d30' }, 
                    ticks: { color: '#666' } 
                }
            }
        }
    });
};

watch(() => store.history, () => {
    // 當資料載入後，預設顯示 1Y
    if (store.history.length > 0) {
        switchTimeRange('1Y');
    }
}, { immediate: true });

watch(chartType, drawChart);

onMounted(() => {
    window.addEventListener('resize', () => { if(myChart) drawChart(); });
});
</script>

<style scoped>
.chart-section { 
    background: #18181c; 
    padding: 20px; 
    border-radius: 12px; 
    border: 1px solid #2d2d30; 
    height: 100%; 
}
.chart-controls { margin-bottom: 15px; }
.chart-title { margin: 0; color: #ddd; font-size: 1.1rem; }
.control-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }

/* 按鈕群組樣式 */
.btn-group { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid #333; background: #2d2d30; }
.btn-group button { 
    background: transparent; 
    border: none; 
    border-right: 1px solid #333; 
    color: #888; 
    padding: 6px 12px; 
    cursor: pointer; 
    font-size: 0.85rem; 
    transition: 0.2s; 
    white-space: nowrap; 
}
.btn-group button:last-child { border-right: none; }
.btn-group button.active { background: #40a9ff; color: #fff; font-weight: bold; }

/* 日期選擇器樣式 */
.date-picker-group { display: flex; align-items: center; gap: 5px; background: #2d2d30; padding: 3px 8px; border-radius: 6px; border: 1px solid #333; }
.date-input { background: transparent; border: none; color: #ccc; font-size: 0.85rem; font-family: inherit; width: 110px; }
.date-input::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }

.chart-container { position: relative; width: 100%; height: 350px; }

@media (max-width: 768px) {
    .control-row { flex-direction: column; align-items: flex-start; }
    .btn-group { width: 100%; overflow-x: auto; }
}
</style>
