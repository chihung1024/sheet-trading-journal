<template>
  <div class="chart-section">
    <div class="chart-controls">
        <h3 class="chart-title">資產配置</h3>
        <div class="btn-group">
            <button :class="{active: pieType==='tags'}" @click="pieType='tags'">策略</button>
            <button :class="{active: pieType==='currency'}" @click="pieType='currency'">幣別</button>
        </div>
    </div>
    <div class="pie-container">
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
const pieType = ref('tags'); // 'tags' | 'currency'

// 前端即時計算資產配置 (Aggregation)
const allocation = computed(() => {
    const holdings = store.holdings || [];
    const result = { tags: {}, currency: {} };

    holdings.forEach(h => {
        // 1. 策略分組
        const tag = h.tag || 'Uncategorized';
        result.tags[tag] = (result.tags[tag] || 0) + h.market_value_twd;

        // 2. 幣別分組
        const curr = h.currency || 'USD';
        result.currency[curr] = (result.currency[curr] || 0) + h.market_value_twd;
    });

    return result;
});

const drawPieChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myPieChart) myPieChart.destroy();

    // 根據選擇的類型提取資料
    const source = pieType.value === 'tags' ? allocation.value.tags : allocation.value.currency;
    const labels = Object.keys(source);
    const data = Object.values(source);

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
                borderWidth: 2 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { 
                    position: 'right', 
                    labels: { color: '#ccc', font: { size: 11 }, boxWidth: 12 } 
                } 
            } 
        }
    });
};

watch([pieType, () => store.holdings], drawPieChart, { deep: true });

onMounted(() => {
    // 稍微延遲以確保 canvas 準備好
    setTimeout(drawPieChart, 100);
});
</script>

<style scoped>
.chart-section { 
    background: #18181c; 
    padding: 20px; 
    border-radius: 12px; 
    border: 1px solid #2d2d30; 
    height: 100%; 
    display: flex;
    flex-direction: column;
}
.chart-controls { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 15px; 
}
.chart-title { margin: 0; color: #ddd; font-size: 1.1rem; }

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

.pie-container { position: relative; width: 100%; height: 250px; flex-grow: 1; }
</style>
