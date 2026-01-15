<template>
  <div class="card pie-chart-card">
    <div class="chart-header">
      <h3>資產配置</h3>
      <span v-if="currentGroupId !== 'ALL'" class="group-tag" :style="{ color: currentGroupColor, borderColor: currentGroupColor }">
        {{ currentGroupName }}
      </span>
    </div>

    <div class="chart-container">
      <div v-if="holdings.length === 0" class="empty-chart">
        <span class="empty-icon">🍩</span>
        <p>此群組目前無持倉</p>
      </div>
      <canvas v-show="holdings.length > 0" ref="pieCanvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const pieCanvas = ref(null);
let myChart = null;

// --- Phase 2: 群組連動 ---
// 當 Store 的 currentGroupId 改變時，store.holdings 也會跟著變
const holdings = computed(() => store.holdings || []);

const currentGroupId = computed(() => store.currentGroupId);
const currentGroupName = computed(() => {
  const group = store.availableGroups.find(g => g.id === currentGroupId.value);
  return group ? group.name : currentGroupId.value;
});
const currentGroupColor = computed(() => {
  const group = store.availableGroups.find(g => g.id === currentGroupId.value);
  return group ? group.color : '#666';
});

// 顏色庫 (Material Colors)
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
  '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', 
  '#F97316', '#64748B'
];

const processData = () => {
  if (holdings.value.length === 0) return { labels: [], data: [], colors: [] };

  const totalValue = holdings.value.reduce((sum, h) => sum + h.market_value_twd, 0);
  
  // 排序並處理數據
  let sortedData = [...holdings.value].sort((a, b) => b.market_value_twd - a.market_value_twd);
  
  // 邏輯：如果持倉超過 8 檔，且有小於 2% 的，將其合併為 "其他"
  const labels = [];
  const data = [];
  let otherSum = 0;
  
  if (sortedData.length > 8) {
     const mainHoldings = [];
     
     sortedData.forEach(h => {
        const ratio = h.market_value_twd / totalValue;
        if (ratio >= 0.02 || mainHoldings.length < 5) {
            mainHoldings.push(h);
        } else {
            otherSum += h.market_value_twd;
        }
     });
     
     // 重建數據
     mainHoldings.forEach(h => {
        labels.push(h.symbol);
        data.push(h.market_value_twd);
     });
     
     if (otherSum > 0) {
        labels.push('Others');
        data.push(otherSum);
     }
  } else {
     // 持倉少，直接顯示
     sortedData.forEach(h => {
        labels.push(h.symbol);
        data.push(h.market_value_twd);
     });
  }

  return {
    labels,
    data,
    backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length])
  };
};

const drawChart = () => {
  if (!pieCanvas.value) return;
  
  if (myChart) {
    myChart.destroy();
    myChart = null;
  }

  if (holdings.value.length === 0) return;

  const { labels, data, backgroundColor } = processData();

  const ctx = pieCanvas.value.getContext('2d');
  
  myChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColor,
        borderWidth: 2,
        borderColor: '#1e1e23', // 與背景色相同以產生切割感
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%', // 甜甜圈厚度
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#9ca3af',
            font: { family: "'Inter', sans-serif", size: 11 },
            boxWidth: 12,
            padding: 10
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((val / total) * 100).toFixed(1) + '%';
              // 格式化金額
              const money = Math.round(val).toLocaleString();
              return ` ${context.label}: ${percentage} ($${money})`;
            }
          }
        }
      }
    }
  });
};

// 監聽持倉變化 (包含切換群組)
watch(() => store.holdings, () => {
  drawChart();
}, { deep: true });

onMounted(() => {
  drawChart();
});

onUnmounted(() => {
  if (myChart) myChart.destroy();
});
</script>

<style scoped>
.pie-chart-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 300px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-main);
}

.group-tag {
    font-size: 0.75rem;
    padding: 2px 8px;
    border: 1px solid currentColor;
    border-radius: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.05);
}

.chart-container {
  flex: 1;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.empty-chart {
  text-align: center;
  color: var(--text-sub);
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 8px;
  opacity: 0.5;
}
</style>
