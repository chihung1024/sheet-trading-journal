<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <h3 class="chart-title">資產配置 (NAV)</h3>
      <div class="toggle-pills">
        <button :class="{ active: type === 'tags' }" @click="type = 'tags'">策略</button>
        <button :class="{ active: type === 'currency' }" @click="type = 'currency'">幣別</button>
      </div>
    </div>
    
    <div class="canvas-box">
      <div v-if="!hasData" class="empty-state-overlay">
        <span class="empty-text">尚無持倉數據</span>
      </div>
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onUnmounted, computed } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let myChart = null;
let resizeObserver = null;
const type = ref('tags'); // 預設顯示標籤分類
const hasData = ref(false);

// 擴充色票 (Modern Finance Palette) - v14.0 保持一致
const colorPalette = [
    '#3b82f6', // Blue 500
    '#10b981', // Emerald 500
    '#f59e0b', // Amber 500
    '#ef4444', // Red 500
    '#8b5cf6', // Violet 500
    '#06b6d4', // Cyan 500
    '#ec4899', // Pink 500
    '#6366f1', // Indigo 500
    '#f97316', // Orange 500
    '#84cc16', // Lime 500
];

/**
 * 🚀 [v14.0] 準備圖表數據
 * 根據 NAV (重估後的台幣價值) 進行比例分配
 */
const chartData = computed(() => {
    const holdings = store.holdings || [];
    if (holdings.length === 0) return { labels: [], datasets: [] };

    const groups = {};
    
    if (type.value === 'tags') {
        // 策略分類：依標籤彙總市場價值 (NAV)
        holdings.forEach(h => {
            const tag = h.tag || '未分類';
            groups[tag] = (groups[tag] || 0) + h.market_value_twd;
        });
    } else {
        // 幣別分類：依資產原始幣別彙總
        holdings.forEach(h => {
            const cur = h.currency || 'TWD';
            groups[cur] = (groups[cur] || 0) + h.market_value_twd;
        });
    }

    const sortedLabels = Object.keys(groups).sort((a, b) => groups[b] - groups[a]);
    const dataValues = sortedLabels.map(label => groups[label]);

    return {
        labels: sortedLabels,
        datasets: [{
            data: dataValues,
            backgroundColor: colorPalette,
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 15
        }]
    };
});

/**
 * 更新或初始化圖表
 */
const updateChart = () => {
    const data = chartData.computed ? chartData.value : chartData.value;
    hasData.value = data.labels.length > 0;

    if (!canvas.value) return;

    if (myChart) {
        myChart.data = data;
        myChart.update();
    } else {
        const ctx = canvas.value.getContext('2d');
        myChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: { size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return ` ${label}: ${Math.round(value).toLocaleString()} TWD (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
};

// 監聽數據變動或類型切換
watch([() => store.holdings, type], () => {
    nextTick(() => updateChart());
}, { deep: true });

onMounted(() => {
    updateChart();
    
    // 建立 ResizeObserver 確保 Canvas 大小正確響應
    if (canvas.value && canvas.value.parentElement) {
        resizeObserver = new ResizeObserver(() => {
            if (myChart) myChart.resize();
        });
        resizeObserver.observe(canvas.value.parentElement);
    }
});

onUnmounted(() => {
    if (myChart) myChart.destroy();
    if (resizeObserver) resizeObserver.disconnect();
});
</script>

<style scoped>
.inner-chart-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 380px;
}

.chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.chart-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-main, #1e293b);
    padding-left: 12px;
    border-left: 4px solid var(--primary, #6366f1); 
}

/* 切換按鈕容器 */
.toggle-pills { 
    display: flex; 
    background: var(--bg-secondary, #f1f5f9); 
    border-radius: 8px; 
    padding: 3px; 
    gap: 2px;
}

.toggle-pills button {
    border: none; 
    background: transparent; 
    padding: 6px 14px; 
    font-size: 0.85rem; 
    border-radius: 6px; 
    color: var(--text-sub, #64748b); 
    cursor: pointer; 
    transition: all 0.2s ease;
    font-weight: 600;
}

.toggle-pills button:hover {
    color: var(--text-main, #1e293b);
}

.toggle-pills button.active { 
    background: #ffffff; 
    color: var(--primary, #6366f1); 
    box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
}

.canvas-box {
    flex-grow: 1;
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-state-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #94a3b8;
    font-size: 0.9rem;
    pointer-events: none;
}
</style>
