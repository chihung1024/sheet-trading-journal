<template>
  <div class="card chart-card">
    <div class="chart-header">
      <div class="title-group">
        <h3>資產配置</h3>
        <span class="subtitle">{{ type === 'tags' ? '依策略群組' : '依幣別資產' }}</span>
      </div>
      
      <div class="toggle-group">
        <button 
          class="toggle-btn" 
          :class="{ active: type === 'tags' }" 
          @click="setType('tags')"
        >
          策略
        </button>
        <button 
          class="toggle-btn" 
          :class="{ active: type === 'currency' }" 
          @click="setType('currency')"
        >
          幣別
        </button>
      </div>
    </div>
    
    <div class="chart-body">
      <div class="canvas-container">
        <canvas ref="canvasRef"></canvas>
        
        <div v-if="isEmpty" class="empty-overlay">
          <span class="empty-icon">📉</span>
          <span>尚無持倉數據</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick, onUnmounted } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';
import { useDarkMode } from '../composables/useDarkMode';

const store = usePortfolioStore();
const { isDark } = useDarkMode();
const canvasRef = ref(null);
let chartInstance = null;
const type = ref('tags');

const isEmpty = computed(() => store.holdings.length === 0);

const setType = (t) => {
  type.value = t;
};

// 顏色生成器 (固定種子)
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// 預設調色盤 (美觀優先)
const palette = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#06b6d4'
];

const getChartData = () => {
  const dataMap = {};
  let totalValue = 0;

  store.holdings.forEach(h => {
    // 處理多標籤情況，這裡簡化取第一個，或依需求調整
    let key = 'Other';
    if (type.value === 'tags') {
      const tags = (h.tag || '未分類').split(/[,;]/).map(t => t.trim()).filter(t => t);
      key = tags.length > 0 ? tags[0] : '未分類';
    } else {
      key = h.currency || 'USD';
    }
    
    const val = Number(h.market_value_twd) || 0;
    dataMap[key] = (dataMap[key] || 0) + val;
    totalValue += val;
  });

  // 排序：大到小
  const sortedKeys = Object.keys(dataMap).sort((a, b) => dataMap[b] - dataMap[a]);
  
  const bgColors = sortedKeys.map((k, i) => {
    // 前 10 個使用預設調色盤，之後使用雜湊色
    if (i < palette.length) return palette[i];
    return stringToColor(k);
  });

  return {
    labels: sortedKeys,
    datasets: [{
      data: sortedKeys.map(k => dataMap[k]),
      backgroundColor: bgColors,
      borderWidth: 2,
      borderColor: isDark.value ? '#1e293b' : '#ffffff',
      hoverOffset: 4
    }],
    totalValue
  };
};

// 自定義 Plugin: 中心文字
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw: (chart) => {
    const { ctx, width, height } = chart;
    ctx.save();
    
    const activeElements = chart.getActiveElements();
    let text = '總資產';
    let subText = `NT$ ${(chart.config.data.totalValue / 10000).toFixed(0)}萬`;
    let color = isDark.value ? '#f1f5f9' : '#0f172a';
    
    // 如果有懸浮在某個區塊上，顯示該區塊資訊
    if (activeElements.length > 0) {
      const index = activeElements[0].index;
      const label = chart.data.labels[index];
      const value = chart.data.datasets[0].data[index];
      const percentage = ((value / chart.config.data.totalValue) * 100).toFixed(1);
      
      text = label;
      subText = `${percentage}%`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 繪製主標題
    ctx.font = 'bold 16px "Inter", sans-serif';
    ctx.fillStyle = isDark.value ? '#94a3b8' : '#64748b'; // Subtitle color
    ctx.fillText(text, width / 2, height / 2 - 12);
    
    // 繪製數值
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = color;
    ctx.fillText(subText, width / 2, height / 2 + 14);
    
    ctx.restore();
  }
};

const drawChart = () => {
  if (!canvasRef.value) return;
  const ctx = canvasRef.value.getContext('2d');
  
  if (chartInstance) {
    chartInstance.destroy();
  }

  const { labels, datasets, totalValue } = getChartData();

  // 手機版 Legend 放下面，桌面版放右邊
  const legendPosition = window.innerWidth < 768 ? 'bottom' : 'right';

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets,
      totalValue // 傳遞給 Plugin 使用
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%', // 甜甜圈厚度
      plugins: {
        legend: {
          position: legendPosition,
          labels: {
            boxWidth: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            color: isDark.value ? '#cbd5e1' : '#475569',
            font: { family: '"Inter", sans-serif', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: isDark.value ? '#1e293b' : '#ffffff',
          titleColor: isDark.value ? '#f1f5f9' : '#0f172a',
          bodyColor: isDark.value ? '#cbd5e1' : '#475569',
          borderColor: isDark.value ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context) => {
              const value = context.raw;
              const percentage = ((value / totalValue) * 100).toFixed(1);
              return ` NT$ ${Number(value).toLocaleString()} (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateScale: true,
        animateRotate: true
      },
      layout: {
        padding: 10
      }
    },
    plugins: [centerTextPlugin]
  });
};

// 監聽依賴變化
watch([type, () => store.holdings, isDark], async () => {
  await nextTick();
  drawChart();
}, { deep: true });

// 監聽視窗大小改變以調整 Legend 位置
const handleResize = () => {
  if (chartInstance) {
    const newPos = window.innerWidth < 768 ? 'bottom' : 'right';
    if (chartInstance.options.plugins.legend.position !== newPos) {
      chartInstance.options.plugins.legend.position = newPos;
      chartInstance.update();
    }
  }
};

onMounted(async () => {
  await nextTick();
  drawChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  if (chartInstance) chartInstance.destroy();
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.chart-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 24px;
  overflow: hidden;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.title-group h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-group h3::before {
  content: '';
  display: block;
  width: 4px;
  height: 18px;
  background: var(--primary);
  border-radius: 2px;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--text-sub);
  margin-left: 12px;
}

/* Toggle Switch */
.toggle-group {
  display: flex;
  background: var(--bg-secondary);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.toggle-btn {
  background: transparent;
  border: none;
  padding: 6px 16px;
  font-size: 0.85rem;
  color: var(--text-sub);
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-btn:hover {
  color: var(--text-main);
}

.toggle-btn.active {
  background: var(--bg-card);
  color: var(--primary);
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

/* Chart Body */
.chart-body {
  flex: 1;
  position: relative;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 250px;
}

/* Empty State */
.empty-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(var(--bg-card), 0.8);
  backdrop-filter: blur(2px);
  color: var(--text-sub);
  font-size: 0.95rem;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 8px;
  opacity: 0.5;
}

@media (max-width: 768px) {
  .chart-card {
    padding: 16px;
  }
  
  .chart-header {
    flex-direction: row;
    align-items: center;
  }
  
  .subtitle {
    display: none; /* 手機版隱藏副標題以節省空間 */
  }

  .canvas-container {
    min-height: 300px; /* 手機版給高一點，因為 Legend 在下方 */
  }
}
</style>
