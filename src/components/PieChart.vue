<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="title">資產配置</h3>
      <div class="toggle-group">
        <button :class="{active: pieType==='tags'}" @click="pieType='tags'">策略</button>
        <button :class="{active: pieType==='currency'}" @click="pieType='currency'">幣別</button>
      </div>
    </div>
    
    <div class="canvas-wrapper">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let myPieChart = null;
const pieType = ref('tags'); 

// 根據 holdings 即時計算配置
const allocation = computed(() => {
    const holdings = store.holdings || [];
    const result = { tags: {}, currency: {} };

    holdings.forEach(h => {
        // 若無 tag 則歸類為 Uncategorized
        const tag = h.tag || 'Uncategorized';
        result.tags[tag] = (result.tags[tag] || 0) + h.market_value_twd;

        const curr = h.currency || 'USD';
        result.currency[curr] = (result.currency[curr] || 0) + h.market_value_twd;
    });
    return result;
});

const drawPieChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    
    // 銷毀舊圖表以防重複繪製
    if (myPieChart) myPieChart.destroy();

    const source = pieType.value === 'tags' ? allocation.value.tags : allocation.value.currency;
    const labels = Object.keys(source);
    const data = Object.values(source);

    // 若無數據則不繪製
    if (labels.length === 0) return;

    // 0.00 版配色
    const colors = ['#40a9ff', '#ff5252', '#ffd700', '#69c0ff', '#ff85c0', '#95de64', '#5cdbd3'];

    myPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels, 
            datasets: [{ 
                data, 
                backgroundColor: colors, 
                borderColor: '#18181c', 
                borderWidth: 2,
                hoverOffset: 4
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { 
                    position: 'right', 
                    labels: { color: '#ccc', font: { size: 12 }, boxWidth: 12, padding: 15 } 
                },
                tooltip: {
                    backgroundColor: '#1f1f23',
                    titleColor: '#fff',
                    bodyColor: '#ccc',
                    borderColor: '#333',
                    borderWidth: 1,
                    callbacks: {
                         label: (c) => {
                             const val = Number(c.raw);
                             const total = c.dataset.data.reduce((a,b)=>a+b, 0);
                             const pct = ((val/total)*100).toFixed(1) + '%';
                             return ` ${c.label}: ${pct} ($${val.toLocaleString()})`;
                         }
                    }
                }
            },
            layout: { padding: 10 }
        }
    });
};

const initChart = () => {
    if (store.holdings && store.holdings.length > 0 && canvas.value) {
        drawPieChart();
    }
};

// 監聽類型切換
watch(pieType, drawPieChart);

// 監聽數據變化 (非同步載入)
watch(() => store.holdings, async () => {
    await nextTick();
    initChart();
}, { deep: true });

// 組件掛載 (若已有數據)
onMounted(async () => {
    await nextTick();
    initChart();
});
</script>

<style scoped>
.chart-card {
    background-color: #18181c;
    border: 1px solid #2d2d30;
    border-radius: 12px;
    padding: 20px;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    /* 0.00 版風格高度 */
}

.chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #eee;
}

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
    padding: 4px 12px;
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
}

.toggle-group button:hover { color: #ccc; }
.toggle-group button.active {
    background: #40a9ff;
    color: #fff;
    font-weight: 700;
}

.canvas-wrapper {
    position: relative;
    width: 100%;
    height: 250px; /* 固定高度，對齊 0.00 版 */
    flex-grow: 1;
}
</style>
