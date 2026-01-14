<template>
  <div class="inner-chart-layout">
    <div class="chart-header">
      <h3 class="chart-title">資產配置</h3>
      <div class="toggle-pills">
        <button :class="{active: type==='groups'}" @click="type='groups'">群組</button>
        <button :class="{active: type==='currency'}" @click="type='currency'">幣別</button>
      </div>
    </div>
    
    <div class="canvas-box">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import Chart from 'chart.js/auto';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const canvas = ref(null);
let myChart = null;
const type = ref('groups');  // ✅ 預設顯示群組

const drawChart = () => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext('2d');
    if (myChart) myChart.destroy();

    const dataMap = {};
    
    if (type.value === 'groups') {
        // ✅ 群組模式：根據群組計算市值
        const groups = store.groups || [];
        const recordGroups = store.recordGroups || [];
        
        // 初始化所有群組為 0
        groups.forEach(g => {
            dataMap[g.name] = 0;
        });
        
        // 遍歷所有持倉
        store.holdings.forEach(h => {
            // 找出該股票所有交易記錄
            const symbolRecords = (store.records || []).filter(r => r.symbol === h.symbol);
            
            symbolRecords.forEach(record => {
                // 找出該交易屬於哪些群組
                const relatedGroups = recordGroups
                    .filter(rg => rg.record_id === record.id)
                    .map(rg => groups.find(g => g.id === rg.group_id))
                    .filter(g => g !== undefined);
                
                if (relatedGroups.length > 0) {
                    // 市值按群組數量平分
                    const valuePerGroup = h.market_value_twd / relatedGroups.length;
                    relatedGroups.forEach(g => {
                        dataMap[g.name] = (dataMap[g.name] || 0) + valuePerGroup;
                    });
                } else {
                    // 未分配群組
                    dataMap['未分類'] = (dataMap['未分類'] || 0) + h.market_value_twd;
                }
            });
        });
        
        // 移除數值為 0 的群組
        Object.keys(dataMap).forEach(key => {
            if (dataMap[key] === 0) delete dataMap[key];
        });
        
    } else {
        // 幣別模式（保留原有逻輯）
        store.holdings.forEach(h => {
            const key = h.currency || 'USD';
            dataMap[key] = (dataMap[key] || 0) + h.market_value_twd;
        });
    }

    // ✅ 如果沒有數據，顯示提示
    if (Object.keys(dataMap).length === 0) {
        dataMap['無數據'] = 1;
    }

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataMap),
            datasets: [{
                data: Object.values(dataMap),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'right', 
                    labels: { 
                        boxWidth: 10, 
                        font: { size: 11 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#1f2937'
                    } 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: NT$ ${value.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            },
            layout: { padding: 10 }
        }
    });
};

watch(type, drawChart);
watch(() => store.holdings, async () => { await nextTick(); drawChart(); }, { deep: true });
watch(() => store.groups, async () => { await nextTick(); drawChart(); }, { deep: true });  // ✅ 監聽群組變化
watch(() => store.recordGroups, async () => { await nextTick(); drawChart(); }, { deep: true });  // ✅ 監聽關聯變化
onMounted(async () => { await nextTick(); drawChart(); });
</script>

<style scoped>
.inner-chart-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
}

.chart-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 16px;
}

.chart-title { 
    margin: 0; 
    font-size: 1.1rem; 
    font-weight: 700; 
    color: var(--text-main);
    padding-left: 10px;
    border-left: 4px solid var(--primary);
}

.toggle-pills { 
    display: flex; 
    background: var(--bg-secondary);
    border-radius: 6px; 
    padding: 3px; 
    border: 1px solid var(--border-color);
}

.toggle-pills button {
    border: none; 
    background: transparent; 
    padding: 4px 12px; 
    font-size: 0.85rem; 
    border-radius: 4px; 
    color: var(--text-sub);
    cursor: pointer; 
    transition: all 0.2s ease;
    font-weight: 500;
}

.toggle-pills button:hover {
    color: var(--text-main);
}

.toggle-pills button.active { 
    background: var(--bg-card);
    color: var(--primary);
    font-weight: 600; 
    box-shadow: var(--shadow-sm); 
}

:global(.dark) .toggle-pills button.active {
    background: #334155;
    color: #60a5fa;
}

.canvas-box {
    flex-grow: 1;
    position: relative;
    width: 100%;
    min-height: 0;
}
</style>
