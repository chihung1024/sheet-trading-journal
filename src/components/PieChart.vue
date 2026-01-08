<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <h3 class="chart-title">資產配置</h3>
      <div class="toggle-pills">
        <button :class="{active: type==='tags'}" @click="type='tags'">策略</button>
        <button :class="{active: type==='currency'}" @click="type='currency'">幣別</button>
      </div>
    </div>
    
    <div class="canvas-box">
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
let myChart = null;
const type = ref('tags');

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    const dataMap = {};
    store.holdings.forEach(h => {
        const key = type.value === 'tags' ? (h.tag || 'Stock') : (h.currency || 'USD');
        dataMap[key] = (dataMap[key] || 0) + h.market_value_twd;
    });

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataMap),
            datasets: [{
                data: Object.values(dataMap),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } }
            },
            layout: { padding: 10 }
        }
    });
};

watch(type, drawChart);
watch(() => store.holdings, async () => { await nextTick(); drawChart(); }, { deep: true });
onMounted(async () => { await nextTick(); drawChart(); });
</script>

<style scoped>
.inner-chart-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
}
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }

/* 修正：統一標題大小 */
.chart-title { 
    margin: 0; 
    font-size: 1.1rem; 
    font-weight: 700; 
    color: #1f2937;
    padding-left: 10px;
    border-left: 4px solid #2563eb;
}

.toggle-pills { display: flex; background: #f3f4f6; border-radius: 6px; padding: 2px; }
.toggle-pills button {
    border: none; background: transparent; padding: 4px 10px; font-size: 0.85rem; 
    border-radius: 4px; color: #6b7280; cursor: pointer; transition: 0.2s;
}
.toggle-pills button.active { background: white; color: #2563eb; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

.canvas-box {
    flex-grow: 1;
    position: relative;
    width: 100%;
    min-height: 0;
}
</style>
