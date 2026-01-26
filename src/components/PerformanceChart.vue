<template>
  <div class="card chart-card">
    <div class="chart-header">
      <div class="header-title">
        <h3>資產走勢</h3>
        <span class="trend-badge" :class="trend >= 0 ? 'bg-green' : 'bg-red'" v-if="filteredHistory.length > 1">
           {{ trend >= 0 ? '▲' : '▼' }} {{ Math.abs(trend).toFixed(2) }}%
        </span>
      </div>
      
      <div class="period-selector">
        <button 
          v-for="p in periods" 
          :key="p.key"
          class="btn-period"
          :class="{ active: selectedPeriod === p.key }"
          @click="setPeriod(p.key)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div class="chart-container">
      <Line
        v-if="chartData.labels.length > 0"
        :data="chartData"
        :options="chartOptions"
        ref="chartRef"
      />
      
      <div v-else class="empty-chart">
         <div class="empty-msg">尚無足夠的歷史數據繪製圖表</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'vue-chartjs';
import { usePortfolioStore } from '../stores/portfolio';
import { useDarkMode } from '../composables/useDarkMode';

// 註冊 Chart.js 組件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const store = usePortfolioStore();
const { isDark } = useDarkMode();
const chartRef = ref(null);

const selectedPeriod = ref('ALL');
const periods = [
  { key: '1M', label: '1月' },
  { key: '3M', label: '3月' },
  { key: 'YTD', label: '今年' },
  { key: '1Y', label: '1年' },
  { key: 'ALL', label: '全' }
];

// 根據選擇的時間區間過濾數據
const filteredHistory = computed(() => {
  const history = store.history || [];
  if (history.length === 0) return [];
  if (selectedPeriod.value === 'ALL') return history;

  const now = new Date();
  let startDate = new Date();

  switch (selectedPeriod.value) {
    case '1M': startDate.setMonth(now.getMonth() - 1); break;
    case '3M': startDate.setMonth(now.getMonth() - 3); break;
    case 'YTD': startDate = new Date(now.getFullYear(), 0, 1); break;
    case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
  }

  return history.filter(item => new Date(item.date) >= startDate);
});

// 計算區間漲跌幅
const trend = computed(() => {
  const data = filteredHistory.value;
  if (data.length < 2) return 0;
  const start = data[0].total_value || 0;
  const end = data[data.length - 1].total_value || 0;
  if (start === 0) return 0;
  return ((end - start) / start) * 100;
});

// 建立漸層背景
const createGradient = (ctx, colorStart, colorEnd) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
};

// 圖表數據 Data
const chartData = computed(() => {
  const labels = filteredHistory.value.map(h => {
    const d = new Date(h.date);
    return `${d.getMonth()+1}/${d.getDate()}`;
  });
  
  const values = filteredHistory.value.map(h => h.total_value);
  
  // 根據漲跌決定線條顏色
  const isPositive = trend.value >= 0;
  const primaryColor = isPositive ? '#10b981' : '#ef4444'; // Green or Red
  
  return {
    labels,
    datasets: [
      {
        label: '總資產 (TWD)',
        data: values,
        borderColor: primaryColor,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          if (!ctx) return 'rgba(0,0,0,0)';
          // 根據深淺模式調整漸層透明度
          const opacityStart = isDark.value ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)';
          const opacityEnd = isDark.value ? 'rgba(16, 185, 129, 0)' : 'rgba(16, 185, 129, 0)';
          
          if (!isPositive) {
             return createGradient(ctx, isDark.value ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0)');
          }
          return createGradient(ctx, opacityStart, opacityEnd);
        },
        borderWidth: 2,
        pointRadius: 0, // 預設隱藏點，Hover時顯示
        pointHoverRadius: 6,
        pointBackgroundColor: primaryColor,
        fill: true,
        tension: 0.4 // 平滑曲線
      }
    ]
  };
});

// 圖表選項 Options (響應式 + 主題適配)
const chartOptions = computed(() => {
  const textColor = isDark.value ? '#94a3b8' : '#64748b';
  const gridColor = isDark.value ? '#334155' : '#e2e8f0';
  const tooltipBg = isDark.value ? '#1e293b' : '#ffffff';
  const tooltipText = isDark.value ? '#f1f5f9' : '#0f172a';
  const tooltipBorder = isDark.value ? '#334155' : '#e2e8f0';

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false // 隱藏預設圖例，使用自定義標題
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 12,
        titleFont: { family: 'JetBrains Mono', size: 13 },
        bodyFont: { family: 'JetBrains Mono', size: 14, weight: 'bold' },
        displayColors: false,
        callbacks: {
          label: (context) => {
            return ` NT$ ${Number(context.raw).toLocaleString('en-US')}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          color: textColor,
          font: { size: 11 },
          maxTicksLimit: 6, // 限制 X 軸標籤數量，避免擁擠
          maxRotation: 0
        }
      },
      y: {
        grid: {
          color: gridColor,
          borderDash: [4, 4],
          drawBorder: false
        },
        ticks: {
          color: textColor,
          font: { family: 'JetBrains Mono', size: 11 },
          callback: (value) => {
             if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
             if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
             return value;
          }
        }
      }
    }
  };
});

const setPeriod = (p) => {
  selectedPeriod.value = p;
};
</script>

<style scoped>
.chart-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h3 {
  margin: 0;
  font-size: 1.15rem;
}

.trend-badge {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
}
.bg-green { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.bg-red { background: rgba(239, 68, 68, 0.15); color: var(--danger); }

.period-selector {
  display: flex;
  background: var(--bg-secondary);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.btn-period {
  background: transparent;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-period:hover {
  color: var(--text-main);
}

.btn-period.active {
  background: var(--bg-card);
  color: var(--primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.chart-container {
  flex: 1;
  position: relative;
  min-height: 300px;
  width: 100%;
}

.empty-chart {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-sub);
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-title {
    justify-content: space-between;
  }
  
  .period-selector {
    justify-content: space-between;
    width: 100%;
  }
  
  .btn-period {
    flex: 1;
    padding: 8px 0;
    font-size: 0.8rem;
  }
  
  .chart-container {
    min-height: 250px;
  }
}
</style>
