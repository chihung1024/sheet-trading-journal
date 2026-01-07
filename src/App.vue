<template>
  <div class="app-layout">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-content">
      <HeaderBar />
      
      <div class="page-container">
        <div class="page-header">
            <div class="header-left">
                <h2>投資組合總覽</h2>
                <p class="subtitle">追蹤您的資產表現與交易紀錄</p>
            </div>
            <div class="header-actions">
                 <span v-if="portfolioStore.loading" class="loading-badge">
                    <span class="dot"></span> 更新中...
                 </span>
            </div>
        </div>

        <div v-if="portfolioStore.loading && !portfolioStore.stats" class="loading-state">
            <div class="spinner"></div>
            <p>正在載入數據...</p>
        </div>
        
        <div v-else class="dashboard-grid">
            <StatsGrid />
            
            <div class="charts-row">
               <PerformanceChart class="chart-card" />
               <PieChart class="chart-card" />
            </div>

            <HoldingsTable />

            <div class="management-row">
                <TradeForm ref="tradeFormRef" />
                <RecordList @edit="handleEditRecord" />
            </div>
        </div>
      </div>
    </div>

    <div class="toast-container">
      <TransitionGroup name="toast-pop">
        <div 
          v-for="t in toasts" 
          :key="t.id" 
          class="toast" 
          :class="t.type"
          @click="removeToast(t.id)"
        >
          <div class="toast-icon">
            <span v-if="t.type === 'success'">✓</span>
            <span v-else>!</span>
          </div>
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
    // 滾動到表單
    document.querySelector('.management-row')?.scrollIntoView({ behavior: 'smooth' });
  }
};

onMounted(() => {
  authStore.initAuth();
});
</script>

<style>
:root {
    /* 明亮主題色盤 */
    --bg-body: #f3f4f6;       /* 淺灰背景 */
    --bg-card: #ffffff;       /* 純白卡片 */
    --bg-hover: #f9fafb;      /* 列表 Hover */
    
    --text-primary: #111827;  /* 深黑主字 */
    --text-secondary: #6b7280;/* 灰階次要文字 */
    --text-light: #9ca3af;    /* 淺灰註解 */
    
    --border-color: #e5e7eb;  /* 極細邊框 */
    
    --primary: #2563eb;       /* 專業藍 */
    --primary-hover: #1d4ed8;
    --success: #059669;       /* 翡翠綠 */
    --danger: #dc2626;        /* 警示紅 */
    --warning: #d97706;       /* 琥珀橘 */

    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    
    --radius: 12px;
}

body {
    background-color: var(--bg-body);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
}

.app-layout { min-height: 100vh; display: flex; flex-direction: column; }
.main-content { flex: 1; }
.page-container { max-width: 1200px; margin: 0 auto; padding: 32px 20px; }

/* 標題區 */
.page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
.page-header h2 { font-size: 1.875rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.subtitle { color: var(--text-secondary); margin: 4px 0 0 0; font-size: 0.95rem; }

/* 卡片通用樣式 */
.card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.2s;
}
.card:hover { box-shadow: var(--shadow-md); }
.card h3 { 
    font-size: 1.125rem; font-weight: 600; color: var(--text-primary); 
    margin: 0 0 20px 0; display: flex; align-items: center; justify-content: space-between;
}

/* 佈局 Grid */
.dashboard-grid { display: flex; flex-direction: column; gap: 24px; }
.charts-row { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.management-row { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; align-items: start; }

@media (max-width: 1024px) {
    .charts-row, .management-row { grid-template-columns: 1fr; }
}

/* 按鈕樣式 */
.btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 8px 16px; border-radius: 6px; font-weight: 500; font-size: 0.875rem;
    border: 1px solid transparent; cursor: pointer; transition: all 0.2s; gap: 6px;
}
.btn-primary { background-color: var(--primary); color: white; }
.btn-primary:hover:not(:disabled) { background-color: var(--primary-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline { background: white; border-color: var(--border-color); color: var(--text-secondary); }
.btn-outline:hover { border-color: var(--text-primary); color: var(--text-primary); background: var(--bg-hover); }

.btn-sm { padding: 4px 10px; font-size: 0.75rem; }

/* Loading Badge */
.loading-badge { 
    display: inline-flex; align-items: center; gap: 6px; 
    font-size: 0.85rem; color: var(--primary); background: #eff6ff; 
    padding: 4px 12px; border-radius: 20px; font-weight: 600; 
}
.dot { width: 6px; height: 6px; background: var(--primary); border-radius: 50%; animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

/* Toast */
.toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 50; display: flex; flex-direction: column; gap: 12px; }
.toast {
    background: white; border: 1px solid var(--border-color);
    padding: 12px 16px; border-radius: 8px; box-shadow: var(--shadow-md);
    display: flex; align-items: center; gap: 12px; font-size: 0.9rem; color: var(--text-primary);
    cursor: pointer; border-left: 4px solid transparent; min-width: 250px;
}
.toast.success { border-left-color: var(--success); }
.toast.error { border-left-color: var(--danger); }
.toast-icon { 
    width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; 
    color: white; font-weight: bold; font-size: 12px;
}
.toast.success .toast-icon { background: var(--success); }
.toast.error .toast-icon { background: var(--danger); }
.toast-pop-enter-active, .toast-pop-leave-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-pop-enter-from, .toast-pop-leave-to { opacity: 0; transform: translateY(20px) scale(0.95); }

/* Table Reset */
table { width: 100%; border-collapse: collapse; }
th { text-align: left; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 16px; background: var(--bg-hover); font-weight: 600; border-bottom: 1px solid var(--border-color); }
td { padding: 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); font-size: 0.9rem; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--bg-hover); }

.text-green { color: var(--success); }
.text-red { color: var(--danger); }
</style>
