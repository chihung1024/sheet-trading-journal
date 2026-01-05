<template>
  <canvas ref="canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let chartInstance = null;

const render = () => {
    if (chartInstance) chartInstance.destroy();
    if (!canvas.value) return;
    if (store.holdings.length === 0) return;

    let sorted = [...store.holdings].sort((a,b) => b.market_value_twd - a.market_value_twd);
    if (sorted.length > 8) {
        const others = sorted.slice(8).reduce((acc, curr) => acc + curr.market_value_twd, 0);
        sorted = sorted.slice(0, 8);
        sorted.push({ symbol: 'Others', market_value_twd: others });
    }

    const colors = [
        '#40a9ff', '#4caf50', '#ffc107', '#ff5252', '#9c27b0', 
        '#00bcd4', '#ff9800', '#795548', '#607d8b'
    ];

    chartInstance = new Chart(canvas.value, {
        type: 'doughnut',
        data: {
            labels: sorted.map(i => i.symbol),
            datasets: [{
                data: sorted.map(i => i.market_value_twd),
                backgroundColor: colors,
                borderColor: '#18181c',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#e0e0e0', boxWidth: 12 } }
            }
        }
    });
};

watch(() => store.holdings, render, { deep: true });
onMounted(render);
</script>
