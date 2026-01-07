<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="title">資產配置</h3>
      <div class="toggle-group">
        <button
          :class="['toggle-btn', { active: pieType === 'tags' }]"
          @click="pieType = 'tags'"
          title="按標籤分類"
        >
          🏷️ 標籤
        </button>
        <button
          :class="['toggle-btn', { active: pieType === 'currency' }]"
          @click="pieType = 'currency'"
          title="按幣種分類"
        >
          💱 幣種
        </button>
      </div>
    </div>

    <div class="canvas-wrapper">
      anvas ref="chartCanvas"></canvas>
    </div>

    <div class="legend-wrapper">
      <div
        v-for="(item, index) in legendData"
        :key="index"
        class="legend-item"
        @mouseenter="hoverIndex = index"
        @mouseleave="hoverIndex = null"
      >
        <div class="legend-color" :style="{ backgroundColor: item.color }"></div>
        <div class="legend-content">
          <div class="legend-name">{{ item.label }}</div>
          <div class="legend-value">
            {{ item.value }} ({{ item.percentage }}%)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const chartCanvas = ref(null);
let myPieChart = null;
const pieType = ref('tags');
const hoverIndex = ref(null);

const holdings = computed(() => store.holdings || []);

const chartColors = [
  '#1f6feb',
  '#26a641',
  '#da3633',
  '#ffc107',
  '#0969da',
  '#fb8500',
  '#8957e5',
  '#00d9ff',
  '#ff6b9d',
  '#c1666b',
];

const allocation = computed(() => {
  const result = { tags: {}, currency: {} };

  holdings.value.forEach((h) => {
    const value = (h.quantity || 0) * (h.current_price || 0);

    // 按標籤分類
    const tag = h.tag || '未分類';
    result.tags[tag] = (result.tags[tag] || 0) + value;

    // 按幣種分類
    const curr = h.currency || 'USD';
    result.currency[curr] = (result.currency[curr] || 0) + value;
  });

  return result;
});

const totalValue = computed(() => {
  return Object.values(allocation.value[pieType.value]).reduce((a, b) => a + b, 0);
});

const legendData = computed(() => {
  const data = allocation.value[pieType.value];
  return Object.entries(data).map(([label, value], index) => ({
    label,
    value: value.toLocaleString('zh-TW', { maximumFractionDigits: 0 }),
    percentage: totalValue.value > 0 ? ((value / totalValue.value) * 100).toFixed(1) : 0,
    color: chartColors[index % chartColors.length],
  }));
});

const updateChart = () => {
  if (!chartCanvas.value) return;

  const ctx = chartCanvas.value.getContext('2d');
  const data = allocation.value[pieType.value];
  const labels = Object.keys(data);
  const values = Object.values(data);

  if (myPieChart) {
    myPieChart.destroy();
  }

  myPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: chartColors.slice(0, labels.length),
          borderColor: 'var(--card-bg)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'var(--primary)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed;
              const percentage = totalValue.value > 0
                ? ((value / totalValue.value) * 100).toFixed(1)
                : 0;
              return `${Number(value).toLocaleString('zh-TW', {
                maximumFractionDigits: 0,
              })} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
};

onMounted(() => {
  updateChart();
});

watch([pieType, holdings], () => {
  updateChart();
});
</script>

<style scoped>
.chart-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  transition: all var(--duration-normal) var(--easing-ease-in-out);
  animation: fadeInUp 500ms var(--easing-ease-out) 200ms both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .chart-card {
    padding: var(--space-md);
  }
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
  gap: var(--space-md);
}

@media (max-width: 480px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
  }
}

.title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.toggle-group {
  display: flex;
  gap: 8px;
  background: var(--bg-secondary);
  padding: 4px;
  border-radius: var(--radius-md);
}

.toggle-btn {
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 200ms ease;
  white-space: nowrap;
}

.toggle-btn:hover {
  color: var(--text);
  background: rgba(31, 110, 251, 0.1);
}

.toggle-btn.active {
  background: var(--gradient-primary);
  color: white;
}

.canvas-wrapper {
  position: relative;
  height: 300px;
  margin-bottom: var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .canvas-wrapper {
    height: 250px;
  }
}

.legend-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
}

@media (max-width: 480px) {
  .legend-wrapper {
    grid-template-columns: repeat(2, 1fr);
  }
}

.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.legend-item:hover {
  background: var(--bg-secondary);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 2px;
  transition: transform 200ms ease;
}

.legend-item:hover .legend-color {
  transform: scale(1.3);
}

.legend-content {
  flex: 1;
  min-width: 0;
}

.legend-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-value {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
