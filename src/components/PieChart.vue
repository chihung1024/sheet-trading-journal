<template>
  <div class="card pie-chart-card">
    <div class="card-header">
      <h3 class="card-title">資產配置</h3>
      <div class="card-actions">
        <select v-model="groupBy" class="select-xs">
          <option value="symbol">按標的 (Symbol)</option>
          <option value="type">按類型 (Type)</option>
        </select>
      </div>
    </div>

    <div class="chart-content">
      <div class="chart-wrapper">
        <canvas ref="canvas"></canvas>
        <div class="center-text">
          <span class="center-label">{{ centerLabel }}</span>
          <span class="center-value">{{ centerValue }}</span>
        </div>
      </div>

      <div class="custom-legend custom-scrollbar">
        <div 
          v-for="(item, index) in chartData" 
          :key="item.label"
          class="legend-item"
          @mouseenter="highlightSegment(index)"
          @mouseleave="resetHighlight"
        >
          <div class="legend-indicator" :style="{ backgroundColor: item.color }"></div>
          <div class="legend-info">
            <span class="legend-label">{{ item.label }}</span>
            <div class="legend-stats">
              <span class="legend-percent">{{ item.percent }}%</span>
              <span class="legend-amount">${{ formatNumber(item.value, 0) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';
import { useDarkMode } from '../composables/useDarkMode';

const store = usePortfolioStore();
const { isDark } = useDarkMode();

const canvas = ref(null);
let myChart = null;
const groupBy = ref('symbol');
const activeIndex = ref(null);

// 預設中心顯示總資產
const totalAssetValue = computed(() => {
  return store.holdings.reduce((sum, h) => sum + (h.market_value_twd || 0), 0);
});

const centerLabel = ref('Total Assets');
const centerValue = ref('');

// Formatters
const formatNumber = (num, d=0) => Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// Data Processing
const chartData = computed(() => {
  const holdings = store.holdings || [];
  if (holdings.length === 0) return [];

  let map = {};
  let total = 0;

  // Grouping Logic
  holdings.forEach(h => {
    const val = h.market_value_twd || 0;
    if (val <= 0) return; // Ignore negative/zero for pie chart

    let key = h.symbol;
    if (groupBy.value === 'type') {
      // 簡單分類邏輯 (可根據實際需求擴充)
      if (['TQQQ', 'SOXL', 'NVDL'].includes(h.symbol)) key = 'Leveraged ETF';
      else if (['VOO', 'QQQ', 'SCHD'].includes(h.symbol)) key = 'Index ETF';
      else key = 'Individual Stock';
    }

    if (!map[key]) map[key] = 0;
    map[key] += val;
    total += val;
  });

  // Convert to Array & Sort
  const sorted = Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Colors Generation (Commercial Palette)
  const baseColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', 
    '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#f43f5e'
  ];

  return sorted.map((item, i) => ({
    ...item,
    percent: ((item.value / total) * 100).toFixed(1),
    color: baseColors[i % baseColors.length]
  }));
});

// Watchers for Center Text
watch(totalAssetValue, (val) => {
  if (activeIndex.value === null) {
    centerValue.value = formatNumber(val);
  }
}, { immediate: true });

// Chart Logic
const drawChart = () => {
  if (!canvas.value) return;
  const ctx = canvas.value.getContext('2d');
  
  if (myChart) myChart.destroy();

  const data = chartData.value;
  const labels = data.map(d => d.label);
  const values = data.map(d => d.value);
  const colors = data.map(d => d.color);
  
  // Theme Variables
  const style = getComputedStyle(document.body);
  const borderColor = isDark.value ? '#1e293b' : '#ffffff';

  myChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: borderColor,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%', // Thinner ring
      plugins: {
        legend: { display: false }, // Use custom legend
        tooltip: {
          enabled: false, // Disable default tooltip for cleaner look
          external: (context) => {
            // Optional: Implement custom HTML tooltip if needed
          }
        }
      },
      onHover: (event, elements) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          highlightSegment(index);
        } else {
          resetHighlight();
        }
      }
    }
  });
};

// Interactions
const highlightSegment = (index) => {
  if (!myChart) return;
  
  // Highlight in chart
  myChart.setActiveElements([{ datasetIndex: 0, index }]);
  myChart.update();

  // Update center text
  const item = chartData.value[index];
  if (item) {
    activeIndex.value = index;
    centerLabel.value = item.label;
    centerValue.value = `$${formatNumber(item.value)}`;
  }
};

const resetHighlight = () => {
  if (!myChart) return;
  
  myChart.setActiveElements([]);
  myChart.update();

  // Reset center text
  activeIndex.value = null;
  centerLabel.value = 'Total Assets';
  centerValue.value = formatNumber(totalAssetValue.value);
};

// Lifecycle
onMounted(() => {
  drawChart();
});

onUnmounted(() => {
  if (myChart) myChart.destroy();
});

watch([chartData, isDark], () => {
  drawChart();
});
</script>

<style scoped>
.pie-chart-card {
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 320px;
  box-shadow: var(--shadow-sm);
}

/* Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.select-xs {
  padding: 4px 8px;
  font-size: 0.8rem;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
}

/* Content Layout */
.chart-content {
  display: flex;
  flex: 1;
  gap: 24px;
  align-items: center;
  min-height: 0; /* Prevent overflow flex item */
}

/* Chart Wrapper */
.chart-wrapper {
  position: relative;
  width: 180px;
  height: 180px;
  flex-shrink: 0;
}

.center-text {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.center-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.center-value {
  display: block;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

/* Custom Legend */
.custom-legend {
  flex: 1;
  height: 200px;
  overflow-y: auto;
  padding-right: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.legend-item:hover {
  background: var(--bg-app);
}

.legend-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.legend-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.legend-stats {
  text-align: right;
}

.legend-percent {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.legend-amount {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

/* Responsive */
@media (max-width: 600px) {
  .chart-content {
    flex-direction: column;
  }
  
  .chart-wrapper {
    width: 200px;
    height: 200px;
  }
  
  .custom-legend {
    width: 100%;
    height: auto;
    max-height: 200px;
  }
}
</style>
