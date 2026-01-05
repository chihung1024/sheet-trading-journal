<template>
  <div class="container">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else>
      <HeaderBar />
      
      <div v-if="portfolioStore.loading" class="loading-text">
        正在載入投資組合數據...
      </div>
      
      <div v-else>
        <StatsGrid />
        
        <div class="chart-section">
           <PerformanceChart />
           <PieChart />
        </div>

        <HoldingsTable />

        <TradeForm ref="tradeFormRef" />
        
        <RecordList @edit="handleEditRecord" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';

// Components
import LoginOverlay from './components/LoginOverlay.vue';
import HeaderBar from './components/HeaderBar.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import PieChart from './components/PieChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);

// 當 RecordList 觸發編輯時，呼叫 TradeForm 的 setupForm 方法
const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    // 滾動到表單位置
    document.getElementById('trade-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  }
};

onMounted(() => {
  authStore.initAuth();
});
</script>

<style>
/* --- 全域變數與重置 (還原自原本的 index.html) --- */
:root { 
    --bg: #101014; 
    --card-bg: #18181c; 
    --border: #2d2d30; 
    --primary: #40a9ff; 
    --text: #e0e0e0; 
    --text-muted: #888;
    --green: #4caf50; 
    --red: #ff5252; 
    --yellow: #ffc107; 
}

body { 
    background-color: var(--bg); 
    color: var(--text); 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
    margin: 0; 
    padding: 20px; 
    line-height: 1.5;
}

.container { 
    max-width: 1200px; 
    margin: 0 auto; 
    padding-bottom: 60px; 
}

/* 共用卡片樣式 */
.card { 
    background: var(--card-bg); 
    padding: 20px; 
    border-radius: 12px; 
    border: 1px solid var(--border); 
    margin-bottom: 20px; 
}

h2, h3 { margin: 0; font-weight: 600; color: #fff; }
h3 { font-size: 1.1rem; margin-bottom: 10px; }

/* 版面配置 */
.chart-section { 
    display: grid; 
    grid-template-columns: 2fr 1fr; 
    gap: 20px; 
    margin-bottom: 20px; 
}
@media (max-width: 900px) { .chart-section { grid-template-columns: 1fr; } }

.loading-text { text-align: center; padding: 40px; color: #666; font-style: italic; }

/* 按鈕共用樣式 */
button { cursor: pointer; }
.btn { 
    padding: 6px 12px; 
    border-radius: 6px; 
    border: none; 
    font-size: 0.9rem; 
    transition: all 0.2s; 
    white-space: nowrap;
}
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger { background: var(--red); color: white; }
.btn-outline { 
    background: transparent; 
    border: 1px solid var(--border); 
    color: var(--text); 
}
.btn-outline:hover { background: #333; color: white; }
.btn-sm { padding: 4px 8px; font-size: 0.8rem; }

/* 顏色輔助類 */
.text-green { color: var(--green); }
.text-red { color: var(--red); }
.text-yellow { color: var(--yellow); }
.text-muted { color: var(--text-muted); }

/* 表格共用樣式 */
table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.95rem; }
th, td { text-align: right; padding: 12px 10px; border-bottom: 1px solid var(--border); }
th:first-child, td:first-child { text-align: left; }
th { color: var(--text-muted); font-weight: 500; font-size: 0.85rem; }
tr:hover { background: #222; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; background: #333; color: #ccc; border: 1px solid #444; }
</style>
