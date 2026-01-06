<script setup>
import { computed, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // 必須引入 Filler 才能做漸層
} from 'chart.js'
import { usePortfolioStore } from '../stores/portfolio'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const store = usePortfolioStore()
const timeRange = ref('ALL') // 1M, 1Y, ALL

const chartData = computed(() => {
  const history = store.history || []
  let data = [...history]

  // 簡單的日期過濾邏輯
  if (timeRange.value === '1M') data = data.slice(-30)
  if (timeRange.value === '1Y') data = data.slice(-252)

  return {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Total Net Worth',
        data: data.map(d => d.total_equity),
        borderColor: '#4f46e5', // Indigo-600
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(79, 70, 229, 0.2)');
          gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
          return gradient;
        },
        fill: true,
        tension: 0.4, // 曲線平滑度
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 2
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      titleColor: '#1e293b',
      bodyColor: '#475569',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      displayColors: false,
      padding: 10,
      callbacks: {
        label: (context) => {
           let label = context.dataset.label || '';
           if (label) label += ': ';
           if (context.parsed.y !== null) {
               label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
           }
           return label;
        }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 8, color: '#94a3b8' }
    },
    y: {
      grid: { borderDash: [4, 4], color: '#f1f5f9' },
      ticks: { color: '#94a3b8' },
      beginAtZero: false
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}
</script>

<template>
  <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
    <div class="flex justify-between items-center mb-6">
      <h3 class="font-bold text-slate-700">Portfolio Performance</h3>
      <div class="flex space-x-1 bg-slate-100 p-1 rounded-lg">
        <button v-for="range in ['1M', '1Y', 'ALL']" :key="range"
                @click="timeRange = range"
                class="px-3 py-1 text-xs font-medium rounded-md transition-all duration-200"
                :class="timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
          {{ range }}
        </button>
      </div>
    </div>
    <div class="h-64 md:h-80">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
