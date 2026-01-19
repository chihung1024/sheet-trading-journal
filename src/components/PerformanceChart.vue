<template>
  <div class="performance-chart-container">
    <div class="chart-header">
      <div class="title-group">
        <h3>投資組合表現</h3>
        <span class="subtitle">累積報酬率 vs 基準標的 ({{ portfolioStore.selectedBenchmark }})</span>
      </div>
      <div class="time-filters">
        <button 
          v-for="range in ranges" 
          :key="range.val"
          @click="activeRange = range.val"
          :class="{ active: activeRange === range.val }"
          class="range-btn"
        >
          {{ range.label }}
        </button>
      </div>
    </div>

    <div v-if="hasData" class="chart-main">
      <apexchart
        type="area"
        height="100%"
        :options="chartOptions"
        :series="series"
      ></apexchart>
    </div>

    <div v-else class="empty-chart">
      <div class="empty-content">
        <span class="empty-icon">📈</span>
        <p>目前尚無足夠的歷史數據生成圖表</p>
        <p class="sub-text">請在添加交易紀錄並完成後端計算後查看</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useDarkMode } from '../composables/useDarkMode';

const portfolioStore = usePortfolioStore();
const { isDark } = useDarkMode();

const activeRange = ref('all');
const ranges = [
  { label: '1M', val: '30' },
  { label: '3M', val: '90' },
  { label: '6M', val: '180' },
  { label: 'YTD', val: 'ytd' },
  { label: '1Y', val: '365' },
  { label: 'ALL', val: 'all' }
];

/**
 * ✅ 檢查是否有有效的歷史數據
 */
const hasData = computed(() => {
  return portfolioStore.history && portfolioStore.history.length > 1;
});

/**
 * 核心邏輯：過濾並處理圖表數據
 * 增加對數據歸零後的極致防禦
 */
const series = computed(() => {
  if (!hasData.value) return [];

  // 過濾時間區段 (邏輯保持完整)
  let data = [...portfolioStore.history];
  const now = new Date();
  
  if (activeRange.value === 'ytd') {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    data = data.filter(d => new Date(d.date) >= yearStart);
  } else if (activeRange.value !== 'all') {
    const days = parseInt(activeRange.value);
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - days);
    data = data.filter(d => new Date(d.date) >= cutoff);
  }

  // 若過濾後無數據，回傳空陣列以觸發 UI 空狀態
  if (data.length === 0) return [];

  return [
    {
      name: '投資組合',
      data: data.map(d => ({
        x: new Date(d.date).getTime(),
        y: parseFloat((Number(d.roi) * 100).toFixed(2)) || 0
      }))
    },
    {
      name: `基準標的 (${portfolioStore.selectedBenchmark})`,
      data: data.map(d => ({
        x: new Date(d.date).getTime(),
        y: parseFloat((Number(d.benchmark_roi) * 100).toFixed(2)) || 0
      }))
    }
  ];
});

/**
 * ApexCharts 配置
 */
const chartOptions = computed(() => {
  const textColor = isDark.value ? '#94a3b8' : '#64748b';
  const gridColor = isDark.value ? '#334155' : '#e2e8f0';

  return {
    chart: {
      id: 'performance-roi',
      type: 'area',
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif'
    },
    colors: ['#3b82f6', '#94a3b8'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100]
      }
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      padding: { left: 10, right: 10 }
    },
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: textColor } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: textColor },
        formatter: (val) => val.toFixed(1) + '%'
      }
    },
    tooltip: {
      theme: isDark.value ? 'dark' : 'light',
      x: { format: 'yyyy/MM/dd' },
      y: { formatter: (val) => val + '%' }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: textColor },
      markers: { radius: 12 }
    }
  };
});
</script>

<style scoped>
.performance-chart-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.title-group h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}

.subtitle {
  font-size: 0.85rem;
  color: var(--text-sub);
}

.time-filters {
  display: flex;
  background: var(--bg-secondary);
  padding: 4px;
  border-radius: 8px;
  gap: 4px;
}

.range-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text-sub);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.range-btn:hover {
  color: var(--text-main);
}

.range-btn.active {
  background: var(--bg-card);
  color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.chart-main {
  flex-grow: 1;
  min-height: 0;
}

.empty-chart {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 2px dashed var(--border-color);
}

.empty-content {
  text-align: center;
  color: var(--text-sub);
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 16px;
  opacity: 0.3;
}

.sub-text {
  font-size: 0.85rem;
  opacity: 0.7;
  margin-top: 4px;
}

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .time-filters {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
