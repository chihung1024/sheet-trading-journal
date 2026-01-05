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
import { ref, onMounted, watch, computed } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let myPieChart = null;
const pieType = ref('tags'); 

const allocation = computed(() => {
    const holdings = store.holdings || [];
    const result = { tags: {}, currency: {} };

    holdings.forEach(h => {
        const tag = h.tag || '未分類';
        result.tags[tag] = (result.tags[tag] || 0) + h.market_value_twd;

        const curr = h.currency || 'USD';
        result.currency[curr] = (result.currency[curr] || 0) + h.market_value_twd;
    });
    return result;
});

const drawPieChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myPieChart) myPieChart.destroy();

    const source = pieType.value === 'tags' ? allocation.value.tags : allocation.value.currency;
    const labels = Object.keys(source);
    const data = Object.values(source);

    // 0.00 版配色：鮮明對比
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

watch([pieType, () => store.holdings], drawPieChart, { deep: true });
onMounted(() => setTimeout(drawPieChart, 100));
</script>

<style scoped>
/* 與 PerformanceChart 共用卡片風格 */
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
    min-height: 300px; /* 防止過度壓縮 */
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
    flex-grow: 1;
    min-height: 200px;
}
</style>
