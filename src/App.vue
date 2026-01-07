<template>
  <div class="app-background"></div>
  <div class="container">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="content-wrapper">
      <HeaderBar />
      
      <div v-if="portfolioStore.loading" class="loading-state">
        <div class="spinner"></div>
        <p>正在載入投資組合數據...</p>
      </div>
      
      <div v-else class="dashboard-grid">
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

    <div class="toast-container">
      <TransitionGroup name="toast">
        <div 
          v-for="t in toasts" 
          :key="t.id" 
          class="toast" 
          :class="t.type"
          @click="removeToast(t.id)"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useToast } from './composables/useToast';

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
const { toasts, removeToast } = useToast();

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    document.getElementById('trade-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  }
};

onMounted(() => {
  authStore.initAuth();
});
</script>

<style>
:root { 
    /* 核心色盤 */
    --bg-color: #0f0f13;
    --primary: #40a9ff; 
    --primary-hover: #1890ff;
    --success: #4caf50; 
    --danger: #ff4d4f; 
    --warning: #faad14; 
    
    /* 毛玻璃與卡片設定 */
    --card-bg: rgba(30, 30, 35, 0.7); 
    --card-border: rgba(255, 255, 255, 0.08);
    --backdrop-blur: 12px;
    --text-main: #e0e0e0; 
    --text-muted: #8c8c8c;
    
    /* 圓角與間距 */
    --radius: 16px;
}

body { 
    background-color: var(--bg-color); 
    color: var(--text-main); 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
    margin: 0; 
    padding: 0; 
    line-height: 1.6;
    overflow-x: hidden;
}

.app-background {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: radial-gradient(circle at 15% 50%, rgba(64, 169, 255, 0.08), transparent 25%),
                radial-gradient(circle at 85% 30%, rgba(114, 46, 209, 0.08), transparent 25%);
    z-index: -1;
    pointer-events: none;
}

.container { 
    max-width: 1280px; 
    margin: 0 auto; 
    padding: 20px; 
    min-height: 100vh;
}

/* 現代化卡片樣式 */
.card { 
    background: var(--card-bg); 
    backdrop-filter: blur(var(--backdrop-blur));
    -webkit-backdrop-filter: blur(var(--backdrop-blur));
    padding: 24px; 
    border-radius: var(--radius); 
    border: 1px solid var(--card-border); 
    margin-bottom: 24px; 
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

h2, h3 { color: #fff; margin: 0; font-weight: 600; letter-spacing: 0.5px; }
h3 { font-size: 1.25rem; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }

/* 按鈕樣式優化 */
button { cursor: pointer; font-family: inherit; }
.btn { 
    padding: 8px 16px; 
    border-radius: 8px; 
    border: none; 
    font-size: 0.9rem; 
    font-weight: 500;
    transition: all 0.2s; 
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}
.btn-primary { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(64, 169, 255, 0.3); }
.btn-primary:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }

.btn-danger { background: rgba(255, 77, 79, 0.2); color: #ff4d4f; border: 1px solid rgba(255, 77, 79, 0.3); }
.btn-danger:hover { background: rgba(255, 77, 79, 0.3); }

.btn-outline { 
    background: transparent; 
    border: 1px solid var(--card-border); 
    color: var(--text-muted); 
}
.btn-outline:hover { border-color: var(--text-main); color: var(--text-main); background: rgba(255,255,255,0.05); }
.btn-sm { padding: 4px 10px; font-size: 0.8rem; border-radius: 6px; }

/* 載入動畫 */
.loading-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px; color: var(--text-muted); gap: 15px;
}
.spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(255,255,255,0.1);
    border-radius: 50%;
    border-top-color: var(--primary);
    animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Toast 樣式 */
.toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; }
.toast { 
    padding: 12px 20px; 
    border-radius: 8px; 
    color: white; 
    font-size: 0.95rem; 
    font-weight: 500; 
    box-shadow: 0 8px 16px rgba(0,0,0,0.3); 
    min-width: 280px; 
    cursor: pointer;
    backdrop-filter: blur(10px);
    border-left: 4px solid transparent;
}
.toast.success { background: rgba(16, 185, 129, 0.9); border-left-color: #059669; }
.toast.error { background: rgba(239, 68, 68, 0.9); border-left-color: #b91c1c; }

/* Vue Transitions */
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(20px); }

/* Layout Grid */
.dashboard-grid { display: flex; flex-direction: column; gap: 24px; }
.chart-section { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
@media (max-width: 1024px) { .chart-section { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .container { padding: 10px; } }

/* 表格通用設定 */
table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; }
th, td { padding: 14px 12px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.05); }
th:first-child, td:first-child { text-align: left; padding-left: 16px; }
th:last-child, td:last-child { padding-right: 16px; }
th { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.02); }

/* 文字顏色工具 */
.text-green { color: var(--success) !important; }
.text-red { color: var(--danger) !important; }
.text-muted { color: var(--text-muted) !important; }
</style>
