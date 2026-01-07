<template>
  <div class="chart-card card">
    <div class="chart-header">
      <h3>資產配置</h3>
      <div class="chart-legend-toggle">
        <button 
          class="legend-btn"
          @click="showLegend = !showLegend"
          :aria-expanded="showLegend"
          aria-label="切換圖例顯示"
        >
          {{ showLegend ? '隱藏' : '顯示' }}圖例
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>載入圖表中...</p>
    </div>

    <div v-else-if="hasError" class="error-state">
      <p>⚠️ {{ errorMessage }}</p>
      <button @click="retryLoad" class="btn btn-sm">重試</button>
    </div>

    <div v-else-if="chartData && chartData.length > 0" class="chart-content">
      <!-- 圖表容器 -->
      <div class="chart-wrapper">
        <canvas ref="chartCanvas" id="pie-chart"></canvas>
      </div>

      <!-- 圖例 -->
      <div v-if="showLegend" class="chart-legend">
        <div 
          v-for="(item, index) in chartData"
          :key="index"
          class="legend-item"
        >
          <div 
            class="legend-color"
            :style="{ backgroundColor: item.backgroundColor }"
          ></div>
          <div class="legend-info">
            <p class="legend-label">{{ item.label }}</p>
            <p class="legend-value">
              ${{ formatCurrency(item.value) }} 
              ({{ formatPercent(item.percentage) }})
            </p>
          </div>
        </div>
      </div>

      <!-- 統計信息 -->
      <div class="chart-stats">
        <div class="stat">
          <span class="stat-label">總資產</span>
          <span class="stat-value">${{ formatCurrency(totalValue) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">持倉數量</span>
          <span class="stat-value">{{ chartData.length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">最大配置</span>
          <span class="stat-value">{{ maxPercentage.toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>📭 暫無資產配置數據</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { Chart } from 'chart.js/auto';

const store = usePortfolioStore();

const chartCanvas = ref(null);
const chartInstance = ref(null);
const isLoading = ref(true);
const hasError = ref(false);
const errorMessage = ref('');
const showLegend = ref(true);
const chartData = ref([]);

// 配色方案
const colors = [
  'rgba(31, 110, 251, 0.8)',
  'rgba(76, 175, 80, 0.8)',
  'rgba(255, 152, 0, 0.8)',
  'rgba(244, 67, 54, 0.8)',
  'rgba(156, 39, 176, 0.8)',
  'rgba(0, 188, 212, 0.8)',
  'rgba(255, 193, 7, 0.8)',
  'rgba(233, 30, 99, 0.8)'
];

const totalValue = computed(() => {
  return chartData.value.reduce((sum, item) => sum + item.value, 0);
});

const maxPercentage = computed(() => {
  return Math.max(...chartData.value.map(item => item.percentage), 0);
});

// 格式化函數
const formatCurrency = (value) => {
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercent = (value) => {
  return value.toFixed(2) + '%';
};

// 載入圖表數據
const loadChartData = async () => {
  isLoading.value = true;
  hasError.value = false;
  errorMessage.value = '';

  try {
    const holdings = store.holdings || [];

    if (holdings.length === 0) {
      throw new Error('暫無持倉數據');
    }

    // 計算每個持倉的市場價值和百分比
    const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);

    chartData.value = holdings
      .map((holding, index) => ({
        label: holding.symbol,
        value: holding.currentValue,
        percentage: (holding.currentValue / total) * 100,
        backgroundColor: colors[index % colors.length],
        borderColor: '#fff',
        borderWidth: 2
      }))
      .sort((a, b) => b.value - a.value);

    renderChart();
  } catch (error) {
    hasError.value = true;
    errorMessage.value = error.message || '載入圖表失敗';
    console.error('Chart loading error:', error);
  } finally {
    isLoading.value = false;
  }
};

// 渲染圖表
const renderChart = () => {
  if (!chartCanvas.value || chartData.value.length === 0) return;

  // 銷毀舊圖表
  if (chartInstance.value) {
    chartInstance.value.destroy();
  }

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  chartInstance.value = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartData.value.map(item => item.label),
      datasets: [{
        data: chartData.value.map(item => item.value),
        backgroundColor: chartData.value.map(item => item.backgroundColor),
        borderColor: chartData.value.map(item => item.borderColor),
        borderWidth: chartData.value.map(item => item.borderWidth)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const item = chartData.value[context.dataIndex];
              return `${item.label}: $${formatCurrency(item.value)} (${item.percentage.toFixed(2)}%)`;
            }
          }
        }
      }
    }
  });
};

// 重試載入
const retryLoad = () => {
  loadChartData();
};

// 監聽 store 數據變化
watch(() => store.holdings, () => {
  loadChartData();
}, { deep: true });

onMounted(() => {
  loadChartData();
});
</script>

<style scoped>
.chart-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
}

.chart-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 700;
}

.chart-legend-toggle {
  display: flex;
}

.legend-btn {
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 200ms ease;
}

.legend-btn:hover {
  background: var(--border);
}

.chart-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.chart-wrapper {
  position: relative;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-wrapper canvas {
  max-width: 100%;
  max-height: 400px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: var(--space-md);
  color: var(--text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  color: var(--error-light);
}

.error-state button {
  margin-top: var(--space-md);
}

.chart-legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.legend-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 2px;
}

.legend-info {
  flex: 1;
  min-width: 0;
}

.legend-label {
  margin: 0;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
}

.legend-value {
  margin: 4px 0 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-family: 'Monaco', 'Menlo', monospace;
}

.chart-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  font-family: 'Monaco', 'Menlo', monospace;
}

.btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  transition: all 200ms ease;
}

.btn:hover {
  background: var(--border);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .chart-wrapper {
    min-height: 250px;
  }

  .chart-legend {
    grid-template-columns: 1fr;
  }

  .chart-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
