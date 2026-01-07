<template>
  <div class="chart-container card">
    <div class="chart-header">
      <h3>投資績效圖表</h3>
      <div class="chart-controls">
        <select 
          v-model="selectedMetric" 
          class="metric-select"
          aria-label="選擇績效指標"
        >
          <option value="cumulative">累積收益</option>
          <option value="monthly">月度收益</option>
          <option value="allocation">資產配置</option>
        </select>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>載入圖表中...</p>
    </div>

    <div v-else-if="hasError" class="error-state">
      <p>⚠️ {{ errorMessage }}</p>
      <button @click="retryLoad" class="btn btn-sm btn-outline">
        重試
      </button>
    </div>

    <div v-else class="chart-content">
      <!-- 圖表展示區域 -->
      <div class="chart-area" ref="chartContainer">
        anvas v-if="chartInstance" id="performance-chart"></canvas>
      </div>

      <!-- 統計摘要 -->
      <div v-if="chartData" class="stats-summary">
        <div class="stat-item">
          <span class="stat-label">總收益</span>
          <span 
            class="stat-value"
            :class="{ positive: totalReturn >= 0, negative: totalReturn < 0 }"
          >
            {{ formatCurrency(totalReturn) }}
          </span>
        </div>

        <div class="stat-item">
          <span class="stat-label">報酬率</span>
          <span 
            class="stat-value"
            :class="{ positive: returnRate >= 0, negative: returnRate < 0 }"
          >
            {{ formatPercent(returnRate) }}
          </span>
        </div>

        <div class="stat-item">
          <span class="stat-label">最大回撤</span>
          <span class="stat-value negative">
            {{ formatPercent(maxDrawdown) }}
          </span>
        </div>

        <div class="stat-item">
          <span class="stat-label">夏普比</span>
          <span class="stat-value">
            {{ sharpeRatio.toFixed(2) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 圖例 -->
    <div v-if="chartData && !isLoading" class="chart-legend">
      <div class="legend-item">
        <span class="legend-color" style="background: rgba(31, 110, 251, 0.8)"></span>
        <span>淨值曲線</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: rgba(76, 175, 80, 0.8)"></span>
        <span>正收益</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: rgba(248, 81, 73, 0.8)"></span>
        <span>負收益</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { Chart } from 'chart.js/auto';

const store = usePortfolioStore();

const selectedMetric = ref('cumulative');
const isLoading = ref(true);
const hasError = ref(false);
const errorMessage = ref('');
const chartInstance = ref(null);
const chartContainer = ref(null);

const chartData = ref(null);

// 計算統計指標
const totalReturn = computed(() => {
  if (!chartData.value) return 0;
  const values = chartData.value.values;
  return values[values.length - 1] - values[0];
});

const returnRate = computed(() => {
  if (!chartData.value) return 0;
  const values = chartData.value.values;
  const initial = values[0];
  if (initial === 0) return 0;
  return ((values[values.length - 1] - initial) / Math.abs(initial)) * 100;
});

const maxDrawdown = computed(() => {
  if (!chartData.value) return 0;
  const values = chartData.value.values;
  let maxVal = values[0];
  let maxDD = 0;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] > maxVal) {
      maxVal = values[i];
    }
    const dd = ((values[i] - maxVal) / maxVal) * 100;
    if (dd < maxDD) {
      maxDD = dd;
    }
  }
  
  return maxDD;
});

const sharpeRatio = computed(() => {
  if (!chartData.value) return 0;
  const values = chartData.value.values;
  
  // 計算日收益率
  const returns = [];
  for (let i = 1; i < values.length; i++) {
    returns.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  
  if (returns.length === 0) return 0;
  
  // 計算平均收益
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  
  // 計算標準差
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  // 夏普比（假設無風險利率為0）
  return (meanReturn * 252) / (stdDev * Math.sqrt(252));
});

// 格式化函數
const formatCurrency = (value) => {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercent = (value) => {
  return `${value.toFixed(2)}%`;
};

// 載入圖表數據
const loadChartData = async () => {
  isLoading.value = true;
  hasError.value = false;
  errorMessage.value = '';

  try {
    // 從 portfolio store 獲取數據
    const records = store.records || [];
    
    if (records.length === 0) {
      throw new Error('沒有交易數據可顯示');
    }

    // 構建圖表數據
    const dates = [];
    const values = [];
    let cumulativeValue = 0;

    // 按日期排序
    const sortedRecords = [...records].sort((a, b) => 
      new Date(a.txn_date) - new Date(b.txn_date)
    );

    sortedRecords.forEach(record => {
      dates.push(record.txn_date);
      
      if (record.txn_type === 'BUY') {
        cumulativeValue += record.total_amount;
      } else if (record.txn_type === 'SELL') {
        cumulativeValue -= record.total_amount;
      } else if (record.txn_type === 'DIV') {
        cumulativeValue += record.total_amount;
      }
      
      values.push(cumulativeValue);
    });

    chartData.value = { dates, values };
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
  if (!chartData.value || !chartContainer.value) return;

  // 銷毀舊圖表
  if (chartInstance.value) {
    chartInstance.value.destroy();
  }

  const ctx = document.getElementById('performance-chart');
  if (!ctx) return;

  const { dates, values } = chartData.value;

  chartInstance.value = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: '投資淨值',
        data: values,
        borderColor: 'rgba(31, 110, 251, 0.8)',
        backgroundColor: 'rgba(31, 110, 251, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(31, 110, 251, 0.8)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            color: 'var(--text-muted)',
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: 'var(--text-muted)',
            maxTicksLimit: 10
          },
          grid: {
            display: false
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

// 監聽指標變化
watch(selectedMetric, () => {
  // 這裡可以根據不同的指標重新渲染圖表
  renderChart();
});

// 監聽 store 數據變化
watch(() => store.records, () => {
  loadChartData();
}, { deep: true });

onMounted(() => {
  loadChartData();
});
</script>

<style scoped>
.chart-container {
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
}

.chart-controls {
  display: flex;
  gap: var(--space-md);
}

.metric-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 200ms ease;
}

.metric-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(31, 110, 251, 0.1);
}

.chart-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.chart-area {
  position: relative;
  min-height: 400px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.chart-area canvas {
  max-width: 100%;
  height: auto;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
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

.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-sm);
  text-align: center;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
}

.stat-value.positive {
  color: #4cb050;
}

.stat-value.negative {
  color: var(--error-light);
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn:hover {
  background: var(--border);
  color: var(--text);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .chart-area {
    min-height: 300px;
  }

  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
