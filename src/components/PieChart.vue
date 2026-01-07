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

const allocation = computed(() => {
    const holdings = store.holdings || [];
    const result = { tags: {}, currency: {} };
    holdings.forEach(h => {
        const tag = h.tag || 'Stock';
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

    if (labels.length === 0) return;

    // 明亮系配色 (Tailwind Colors: Blue, Emerald, Amber, Rose, Violet...)
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899'];

    myPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels, 
            datasets: [{ 
                data, 
                backgroundColor: colors, 
                borderColor: '#ffffff', // 切割線改為白色
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
                    labels: { color: '#374151', font: { size: 12, family:'Inter' }, boxWidth: 12, padding: 15 } 
                },
                tooltip: {
                    backgroundColor: '#ffffff',
                    titleColor: '#111827',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 10,
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

const initChart = () => { if (store.holdings && store.holdings.length > 0 && canvas.value) drawPieChart(); };

watch(pieType, drawPieChart);
watch(() => store.holdings, async () => { await nextTick(); initChart(); }, { deep: true });
onMounted(async () => { await nextTick(); initChart(); });
</script>

<style scoped>
.chart-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    height: 100%;
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
    color: var(--text-primary);
}

.toggle-group {
    display: flex;
    background: var(--bg-body);
    border-radius: 6px;
    padding: 2px;
    border: 1px solid var(--border-color);
}

.toggle-group button {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 4px 12px;
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
    font-weight: 500;
}

.toggle-group button:hover { color: var(--text-primary); }
.toggle-group button.active {
    background: #ffffff;
    color: var(--primary);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.canvas-wrapper {
    position: relative;
    width: 100%;
    height: 250px;
    flex-grow: 1;
}
</style>
