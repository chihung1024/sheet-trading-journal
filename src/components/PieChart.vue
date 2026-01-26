<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <h3 class="chart-title">資產配置</h3>
      <div class="toggle-pills">
        <button :class="{active: type==='tags'}" @click="type='tags'">策略</button>
        <button :class="{active: type==='currency'}" @click="type='currency'">幣別</button>
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
const type = ref('tags');
const hasData = ref(false);

// 擴充色票 (Modern Finance Palette)
const colorPalette = [
    '#3b82f6', // Blue 500
    '#10b981', // Emerald 500
    '#f59e0b', // Amber 500
    '#ef4444', // Red 500
    '#8b5cf6', // Violet 500
    '#ec4899', // Pink 500
    '#06b6d4', // Cyan 500
    '#84cc16', // Lime 500
    '#6366f1', // Indigo 500
    '#f43f5e', // Rose 500
    '#64748b', // Slate 500
];

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    const dataMap = {};
    let totalValue = 0;

    store.holdings.forEach(h => {
        // 如果是 tags 模式，處理多標籤情況 (這裡簡化取第一個標籤，或歸類為 'Uncategorized')
        let key = 'Other';
        if (type.value === 'tags') {
            const tags = (h.tag || '').split(/[,;]/).map(t => t.trim()).filter(t => t);
            key = tags.length > 0 ? tags[0] : 'Stock'; // 簡單起見，取主標籤
        } else {
            key = h.currency || 'USD';
        }
        
        dataMap[key] = (dataMap[key] || 0) + h.market_value_twd;
        totalValue += h.market_value_twd;
    });

    const labels = Object.keys(dataMap);
    const dataValues = Object.values(dataMap);
    
    hasData.value = labels.length > 0 && totalValue > 0;

    if (!hasData.value) return;

    // RWD 判斷
    const isMobile = window.innerWidth < 768;

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: colorPalette,
                borderWidth: 2,
                borderColor: getComputedStyle(document.body).getPropertyValue('--bg-card').trim(),
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: isMobile ? 10 : 20
            },
            plugins: {
                legend: { 
                    position: isMobile ? 'bottom' : 'right', // 手機放底部，桌面放右側
                    align: 'center',
                    labels: { 
                        boxWidth: 12, 
                        usePointStyle: true, 
                        pointStyle: 'circle',
                        padding: 15,
                        font: { 
                            size: 11,
                            family: "'Inter', sans-serif" 
                        },
                        color: getComputedStyle(document.body).getPropertyValue('--text-sub').trim()
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    padding: 12,
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const percentage = ((val / totalValue) * 100).toFixed(1) + '%';
                            const label = context.label || '';
                            // 格式: 標籤: $1,234 (15.5%)
                            return ` ${label}: ${Number(val).toLocaleString()} (${percentage})`;
                        }
                    }
                }
            },
            cutout: '65%', // 圓環粗細
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
};

watch(type, drawChart);
watch(() => store.holdings, async () => { await nextTick(); drawChart(); }, { deep: true });

onMounted(async () => {
    await nextTick();
    drawChart();
    
    // 監聽容器大小變化，自動重繪以適應圖例位置
    if (canvas.value && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            // 簡單 debounce 或直接重繪
            // 為了效能，這裡我們只在寬度劇烈變化(如轉屏)時重繪可能更好，但 Chart.js 內建 resize 處理畫布
            // 我們主要需要處理 legend position 的邏輯
            requestAnimationFrame(() => {
               if (myChart) {
                   const isMobile = window.innerWidth < 768;
                   const newPos = isMobile ? 'bottom' : 'right';
                   if (myChart.options.plugins.legend.position !== newPos) {
                       myChart.options.plugins.legend.position = newPos;
                       myChart.update();
                   } else {
                       myChart.resize();
                   }
               }
            });
        });
        resizeObserver.observe(canvas.value.parentElement);
    }
});

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (myChart) myChart.destroy();
});
</script>

<style scoped>
.inner-chart-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
    box-sizing: border-box;
    position: relative;
}

.chart-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 12px; 
    flex-shrink: 0;
}

/* 標題樣式 */
.chart-title { 
    margin: 0; 
    font-size: 1.15rem; 
    font-weight: 700; 
    color: var(--text-main); 
    padding-left: 12px;
    border-left: 4px solid var(--primary); 
}

/* 切換按鈕容器 */
.toggle-pills { 
    display: flex; 
    background: var(--bg-secondary); 
    border-radius: 8px; 
    padding: 3px; 
    gap: 2px;
}

/* 按鈕本體 */
.toggle-pills button {
    border: none; 
    background: transparent; 
    padding: 6px 14px; 
    font-size: 0.9rem; 
    border-radius: 6px; 
    color: var(--text-sub); 
    cursor: pointer; 
    transition: all 0.2s ease;
    font-weight: 500;
}

.toggle-pills button:hover {
    color: var(--text-main);
}

/* 選中狀態 */
.toggle-pills button.active { 
    background: var(--bg-card); 
    color: var(--primary); 
    font-weight: 600; 
    box-shadow: 0 1px 2px rgba(0,0,0,0.1); 
}

.canvas-box {
    flex-grow: 1;
    position: relative;
    width: 100%;
    min-height: 250px; /* 確保最小高度 */
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-state-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.02);
    z-index: 10;
}

.empty-text {
    color: var(--text-sub);
    font-size: 0.9rem;
    background: var(--bg-secondary);
    padding: 8px 16px;
    border-radius: 20px;
}

/* 手機版微調 */
@media (max-width: 768px) {
    .inner-chart-layout {
        padding: 16px;
    }
    .chart-title {
        font-size: 1.1rem;
    }
    .toggle-pills button {
        padding: 4px 10px;
        font-size: 0.85rem;
    }
}
</style>
