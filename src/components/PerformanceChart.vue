<template>
  <div class="chart-container card">
    <div class="chart-header">
      <h3>投資績效圖表</h3>
      <div class="chart-controls">
        <select
          v-model="selectedMetric"
          class="metric-select"
          aria-label="選擇績效指標"
          @change="handleMetricChange"
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
      <div class="chart-area" ref="chartContainer">
        <canvas id="performance-chart"></canvas>
      </div>

      <div v-if="chartData" class="stats-summary">
        <div class="stat-item">
          <span class="stat-label">總收益</span>
          <span
            class="stat-value"
            :class="{
              positive: totalReturn >= 0,
              negative: totalReturn < 0
            }"
          >
            {{ formatCurrency(totalReturn) }}
          </span>
        </div>

        <div class="stat-item">
          <span class="stat-label">報酬率</span>
          <span
            class="stat-value"
            :class="{
              positive: returnRate >= 0,
              negative: returnRate < 0
            }"
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
          <span class="stat-label">夏普比率</span>
          <span class="stat-value">
            {{ formatNumber(sharpeRatio) }}
          </span>
        </div>
      </div>

      <div v-if="chartData && !isLoading" class="chart-legend">
        <div class="legend-item" v-for="(item, index) in legendItems" :key="index">
          <span
            class="legend-color"
            :style="{ backgroundColor: `rgba(${item.color})` }"
          ></span>
          <span class="legend-label">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'PerformanceChart',
  data() {
    return {
      selectedMetric: 'cumulative',
      isLoading: false,
      hasError: false,
      errorMessage: '',
      chartData: null,
      chartInstance: null,
      totalReturn: 0,
      returnRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      legendItems: [
        { label: '淨值曲線', color: '31, 110, 251, 0.8' },
        { label: '收益', color: '76, 175, 80, 0.8' },
        { label: '回撤', color: '248, 81, 73, 0.8' }
      ]
    };
  },
  computed: {
    chartContainerRef() {
      return this.$refs.chartContainer;
    }
  },
  watch: {
    selectedMetric: 'handleMetricChange'
  },
  methods: {
    async handleMetricChange() {
      await this.loadChartData();
    },
    async loadChartData() {
      this.isLoading = true;
      this.hasError = false;
      try {
        // 模擬數據加載
        await new Promise(resolve => setTimeout(resolve, 800));
        // 實現圖表數據邏輯
        this.chartData = this.generateMockData();
        this.calculateMetrics();
        this.$nextTick(() => {
          this.renderChart();
        });
      } catch (error) {
        this.hasError = true;
        this.errorMessage = error.message || '圖表加載失敗';
        console.error('圖表加載錯誤:', error);
      } finally {
        this.isLoading = false;
      }
    },
    generateMockData() {
      // 生成模擬圖表數據
      return {
        labels: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
        datasets: [
          {
            label: '淨值',
            data: Array.from({ length: 12 }, () => Math.random() * 1000 + 9000),
            borderColor: 'rgba(31, 110, 251, 0.8)',
            backgroundColor: 'rgba(31, 110, 251, 0.1)',
            tension: 0.4
          }
        ]
      };
    },
    calculateMetrics() {
      if (!this.chartData) return;
      // 計算績效指標
      this.totalReturn = Math.random() * 10000 - 5000;
      this.returnRate = Math.random() * 40 - 10;
      this.maxDrawdown = Math.random() * -30;
      this.sharpeRatio = (Math.random() * 2).toFixed(2);
    },
    renderChart() {
      // Chart.js 渲染邏輯
      if (!this.chartData) return;
      // 實現 Chart.js 初始化
      console.log('圖表已渲染');
    },
    formatCurrency(value) {
      return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        minimumFractionDigits: 2
      }).format(value);
    },
    formatPercent(value) {
      return `${(value * 100).toFixed(2)}%`;
    },
    formatNumber(value) {
      return parseFloat(value).toFixed(2);
    },
    retryLoad() {
      this.hasError = false;
      this.errorMessage = '';
      this.loadChartData();
    }
  },
  mounted() {
    this.loadChartData();
  },
  beforeUnmount() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }
});
</script>

<style scoped>
.chart-container {
  padding: 24px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.chart-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.chart-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.metric-select {
  padding: 8px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.metric-select:hover {
  border-color: var(--border);
}

.metric-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(31, 110, 251, 0.1);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e0e0e0;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 16px;
  background: #fff5f5;
  border: 1px solid #feb2b2;
  border-radius: 8px;
  padding: 24px;
}

.error-state p {
  margin: 0;
  font-size: 16px;
  color: #c53030;
}

.chart-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chart-area {
  position: relative;
  width: 100%;
  min-height: 300px;
  background: #fafafa;
  border-radius: 6px;
  padding: 16px;
  border: 1px solid #e0e0e0;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
  border-left: 3px solid var(--primary);
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.stat-value.positive {
  color: #27ae60;
}

.stat-value.negative {
  color: #e74c3c;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 6px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.legend-color {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-label {
  color: #666;
  font-weight: 500;
}

.btn {
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-outline {
  border-color: var(--border);
  background: transparent;
  color: var(--text);
}

.btn-outline:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

:root {
  --primary: #1f6efb;
  --border: #d0d0d0;
  --text: #333;
}

@media (max-width: 768px) {
  .chart-container {
    padding: 16px;
  }

  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-legend {
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .chart-header h3 {
    font-size: 16px;
  }

  .stats-summary {
    grid-template-columns: 1fr;
  }

  .stat-value {
    font-size: 18px;
  }
}
</style>
