<template>
  <div style="position: relative; height: 300px; width: 100%">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const props = defineProps({ type: { type: String, default: 'line' } }); // 'line' or 'pie'
const store = usePortfolioStore();
const canvas = ref(null);
let chartInstance = null;

const render = () => {
  if (chartInstance) chartInstance.destroy();
  if (!canvas.value) return;

  if (props.type === 'line') {
    // Line Chart Logic
    const history = store.history;
    if (!history.length) return;
    
    chartInstance = new Chart(canvas.value, {
      type: 'line',
      data: {
        labels: history.map(d => d.date),
        datasets: [{
          label: 'TWR (%)',
          data: history.map(d => d.twr),
          borderColor: '#2979ff',
          backgroundColor: 'rgba(41, 121, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#333' } },
          y: { grid: { color: '#333' } }
        }
      }
    });
  } else {
    // Pie Chart Logic
    const holdings = store.holdings;
    if (!holdings.length) return;
    
    // Sort and Top 5
    const sorted = [...holdings].sort((a,b) => b.market_value_twd - a.market_value_twd);
    const top = sorted.slice(0, 5);
    const other = sorted.slice(5).reduce((acc, c) => acc + c.market_value_twd, 0);
    
    const labels = top.map(h => h.symbol);
    const data = top.map(h => h.market_value_twd);
    if(other > 0) { labels.push('Others'); data.push(other); }

    chartInstance = new Chart(canvas.value, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#2979ff', '#00e676', '#ffc400', '#ff5252', '#9c27b0', '#666'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#ccc' } } }
      }
    });
  }
};

watch(() => store.history, render, { deep: true });
watch(() => store.holdings, render, { deep: true });
onMounted(render);
</script>
