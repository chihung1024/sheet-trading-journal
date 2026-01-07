<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="header-row main-row">
        <h3 class="title">績效分析</h3>
        <div class="toggle-group">
          <button
            :class="['toggle-btn', { active: chartType === 'pnl' }]"
            @click="chartType = 'pnl'"
            title="損益曲線"
          >
            📈 損益
          </button>
          <button
            :class="['toggle-btn', { active: chartType === 'twr' }]"
            @click="chartType = 'twr'"
            title="時間加權報酬"
          >
            🎯 TWR
          </button>
          <button
            :class="['toggle-btn', { active: chartType === 'asset' }]"
            @click="chartType = 'asset'"
            title="資產配置"
          >
            💰 資產
          </button>
        </div>
      </div>

      <div class="header-row sub-row">
        <div class="toggle-group sm">
          <button
            v-for="range in ['1M', '3M', '6M', 'YTD', '1Y', 'ALL']"
            :key="range"
            :class="['toggle-btn', 'sm', { active: timeRange === range }]"
            @click="switchTimeRange(range)"
          >
            {{ range }}
          </button>
        </div>
      </div>
    </div>

    <div class="chart-container">
      anvas ref="chartCanvas" class="chart-canvas"></canvas>
    </div>

    <div class="chart-stats">
      <div class="stat-item">
        <span class="label">最高</span>
        <span class="value">{{ maxValue }}</span>
      </div>
      <div class="stat-item">
        <span class="label">最低</span>
        <span class="value">{{ minValue }}</span>
      </div>
      <div class="stat-item">
        <span class="label">平均</span>
        <span class="value">{{ avgValue }}</span>
      </div>
      <div class="stat-item">
        <span class="label">波動率</span>
        <span class="value">{{ volatility }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import Chart from 'chart.js/auto';

const store = usePortfolioStore();
const chartCanvas = ref(null);
let chartInstance = null;

const chartType = ref('pnl');
const timeRange = ref('ALL');

const history = computed(() => store.history || []);

const filteredData = computed(() => {
  const data = history.value;
  if (timeRange.value === 'ALL') return data;

  const now = new Date();
  let cutoffDate;

  switch (timeRange.value) {
    case '1M':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case 'YTD':
      cutoffDate = new Date(now.getFullYear(), 0, 1);
      break;
    case '1Y':
      cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      return data;
  }

  return data.filter((item) => new Date(item.date) >= cutoffDate);
});

const maxValue = computed(() => {
  if (filteredData.value.length === 0) return '-';
  const values = filteredData.value.map((d) => d.total_value);
  return Math.max(...values).toLocaleString('zh-TW', { maximumFractionDigits: 0 });
});

const minValue = computed(() => {
  if (filteredData.value.length === 0) return '-';
  const values = filteredData.value.map((d) => d.total_value);
  return Math.min(...values).toLocaleString('zh-TW', { maximumFractionDigits: 0 });
});

const avgValue = computed(() => {
  if (filteredData.value.length === 0) return '-';
  const values = filteredData.value.map((d) => d.total_value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return avg.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
});

const volatility = computed(() => {
  if (filteredData.value.length < 2) return '-';
  const values = filteredData.value.map((d) => d.total_value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return ((stdDev / mean) * 100).toFixed(2) + '%';
});

const switchTimeRange = (range) => {
  timeRange.value = range;
};

const updateChart = () => {
  if (!chartCanvas.value) return;

  const labels = filteredData.value.map((d) => d.date);
  let datasets = [];

  if (chartType.value === 'pnl') {
    datasets = [
      {
        label: '淨值 (TWD)',
        data: filteredData.value.map((d) => d.total_value),
        borderColor: '#1f6feb',
        backgroundColor: 'rgba(31, 110, 251, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'SPY 基準',
        data: filteredData.value.map((d) => d.benchmark_value || null),
        borderColor: '#ffc107',
        backgroundColor: 'rgba(255, 193, 7, 0.05)',
        borderWidth: 1,
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
      },
    ];
  } else if (chartType.value === 'twr') {
    datasets = [
      {
        label: 'TWR 報酬率',
        data: filteredData.value.map((d, idx) => {
          if (idx === 0) return 0;
          const prev = filteredData.value[idx - 1].total_value;
          const curr = filteredData.value[idx].total_value;
          return ((curr - prev) / prev) * 100;
        }),
        borderColor: '#26a641',
        backgroundColor: 'rgba(38, 166, 65, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
    ];
  } else if (chartType.value === 'asset') {
    datasets = [
      {
        label: '投入資金',
        data: filteredData.value.map((d) => d.invested),
        borderColor: '#0969da',
        backgroundColor: 'rgba(9, 105, 218, 0.3)',
        borderWidth: 0,
        fill: true,
      },
      {
        label: '累計收益',
        data: filteredData.value.map((d) => d.total_value - d.invested),
        borderColor: '#26a641',
        backgroundColor: 'rgba(38, 166, 65, 0.3)',
        borderWidth: 0,
        fill: true,
      },
    ];
  }

  const ctx = chartCanvas.value.getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: chartType.value === 'pnl' || chartType.value === 'twr' ? 'line' : 'bar',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'var(--text-secondary)',
            font: { size: 12, weight: '500' },
            padding: 16,
            boxWidth: 12,
            usePointStyle: true,
          },
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
              const value = ctx.parsed.y;
              if (chartType.value === 'twr') {
                return `${ctx.dataset.label}: ${value.toFixed(2)}%`;
              }
              return `${ctx.dataset.label}: ${Number(value).toLocaleString('zh-TW', {
                maximumFractionDigits: 0,
              })}`;
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            color: 'var(--border-light)',
            drawBorder: false,
          },
          ticks: {
            color: 'var(--text-muted)',
            font: { size: 11 },
            maxTicksLimit: 10,
          },
        },
        y: {
          display: true,
          grid: {
            color: 'var(--border-light)',
            drawBorder: false,
          },
          ticks: {
            color: 'var(--text-muted)',
            font: { size: 11 },
            callback: (value) => {
              if (chartType.value === 'twr') {
                return value.toFixed(1) + '%';
              }
              return (value / 1000).toFixed(0) + 'K';
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

watch([chartType, filteredData], () => {
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
  transition: all var(--duration-normal) var(--easing-ease-in-out);
  animation: fadeInUp 500ms var(--easing-ease-out) 100ms both;
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
  margin-bottom: var(--space-lg);
}

.header-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.header-row.main-row {
  justify-content: space-between;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .header-row {
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .header-row.main-row {
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

.toggle-group.sm {
  gap: 6px;
  padding: 3px;
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

.toggle-btn.sm {
  padding: 6px 10px;
  font-size: 0.8rem;
}

.toggle-btn:hover {
  color: var(--text);
  background: rgba(31, 110, 251, 0.1);
}

.toggle-btn.active {
  background: var(--gradient-primary);
  color: white;
}

.chart-container {
  position: relative;
  height: 400px;
  margin-bottom: var(--space-lg);
}

@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
}

.chart-canvas {
  max-height: 100%;
}

.chart-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-item .label {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.stat-item .value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}
</style>
