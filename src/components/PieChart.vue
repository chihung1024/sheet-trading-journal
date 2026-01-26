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

.chart-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 16px; /* 增加一點間距 */
}

/* 標題樣式 - 使用 CSS 變數適配深色模式 */
.chart-title { 
    margin: 0; 
    font-size: 1.1rem; 
    font-weight: 700; 
    color: var(--text-main); /* ✅ 改用變數 */
    padding-left: 10px;
    border-left: 4px solid var(--primary); /* ✅ 改用變數 */
}

/* 切換按鈕容器 - 使用變數 */
.toggle-pills { 
    display: flex; 
    background: var(--bg-secondary); /* ✅ 改用變數，深色模式會變深灰 */
    border-radius: 6px; 
    padding: 3px; 
    border: 1px solid var(--border-color); /* ✅ 增加邊框 */
}

/* 按鈕本體 */
.toggle-pills button {
    border: none; 
    background: transparent; 
    padding: 4px 12px; 
    font-size: 0.85rem; 
    border-radius: 4px; 
    color: var(--text-sub); /* ✅ 改用變數 */
    cursor: pointer; 
    transition: all 0.2s ease;
    font-weight: 500;
}

/* 懸停效果 */
.toggle-pills button:hover {
    color: var(--text-main);
}

/* 選中狀態 - 深色模式適配 */
.toggle-pills button.active { 
    background: var(--bg-card); /* ✅ 亮色是白，深色是深藍灰 */
    color: var(--primary); /* ✅ 主色調 */
    font-weight: 600; 
    box-shadow: var(--shadow-sm); 
}

/* 針對深色模式的微調 (利用 :global(.dark) 補丁技巧，確保權重) */
:global(.dark) .toggle-pills button.active {
    background: #334155; /* 更明顯的深色高亮 */
    color: #60a5fa;
}

.canvas-box {
    flex-grow: 1;
    position: relative;
    width: 100%;
    min-height: 0;
}
</style>

