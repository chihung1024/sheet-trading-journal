<template>
  <div class="app-layout">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
            <span class="logo-icon">📊</span>
            <h1>Trading Journal <span class="badge">PRO</span></h1>
        </div>
        <div class="nav-status">
            <div v-if="portfolioStore.loading" class="status-indicator loading">
                <span class="dot"></span> 更新數據中...
            </div>
            <div v-else class="status-indicator ready">
                <span class="dot"></span> 系統連線正常
            </div>
            <div class="user-profile">
                <div class="avatar">U</div>
            </div>
        </div>
      </header>

      <div class="content-container">
        <main class="main-column">
            <section class="section-stats">
                <StatsGrid />
            </section>
            
            <section class="section-charts">
                <div class="chart-container main-chart">
                    <PerformanceChart />
                </div>
                <div class="chart-container sub-chart">
                    <PieChart />
                </div>
            </section>

            <section class="section-holdings">
                <HoldingsTable />
            </section>
        </main>

        <aside class="side-column">
            <div class="sticky-panel">
                <TradeForm ref="tradeFormRef" />
                <div class="spacer"></div>
                <RecordList @edit="handleEditRecord" />
            </div>
        </aside>
      </div>
    </div>

    <div class="toast-container">
      <TransitionGroup name="toast-slide">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" @click="removeToast(t.id)">
          <div class="toast-icon">{{ t.type === 'success' ? '✓' : '!' }}</div>
          <div class="toast-body">
             <div class="toast-title">{{ t.type === 'success' ? '操作成功' : '發生錯誤' }}</div>
             <div class="toast-msg">{{ t.message }}</div>
          </div>
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
    // 在手機版時滾動到頂部
    if (window.innerWidth < 1024) {
        document.querySelector('.side-column').scrollIntoView({ behavior: 'smooth' });
    }
  }
};

onMounted(() => {
  authStore.initAuth();
});
</script>

<style>
:root {
    --bg-app: #f8f9fa;
    --bg-card: #ffffff;
    --border-color: #e2e8f0;
    --primary: #2563eb;
    --primary-dark: #1e40af;
    --text-main: #0f172a;
    --text-sub: #64748b;
    --success: #10b981;
    --danger: #ef4444;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --radius: 8px;
}

body {
    background-color: var(--bg-app);
    color: var(--text-main);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
}

.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; }

/* Top Navigation */
.top-nav {
    background: #fff;
    border-bottom: 1px solid var(--border-color);
    padding: 0 32px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: var(--shadow-sm);
    z-index: 100;
}

.nav-brand { display: flex; align-items: center; gap: 12px; }
.nav-brand h1 { font-size: 1.25rem; font-weight: 700; margin: 0; color: var(--text-main); letter-spacing: -0.5px; }
.badge { background: var(--text-main); color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 8px; }
.logo-icon { font-size: 1.5rem; }

.nav-status { display: flex; align-items: center; gap: 24px; font-size: 0.9rem; font-weight: 500; }
.status-indicator { display: flex; align-items: center; gap: 8px; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.loading .dot { animation: pulse 1s infinite; }
.avatar { width: 32px; height: 32px; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--text-sub); }

/* Layout Grid - 關鍵修正 */
.content-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 24px 32px;
    display: grid;
    /* 強制設定兩欄比例，minmax(0, ...) 防止內容撐開 */
    grid-template-columns: minmax(0, 3fr) minmax(320px, 1fr);
    gap: 24px;
    width: 100%;
    box-sizing: border-box;
    align-items: start;
}

/* 左側主欄位 */
.main-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0; /* 防止 Flex 子元素溢出 */
}

/* 圖表區塊修正：確保不重疊 */
.section-charts {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); /* 強制限制寬度 */
    gap: 24px;
    /* 移除固定 height，改用 min-height */
    min-height: 400px; 
}

/* 確保圖表容器有固定高度，讓 Canvas 正確渲染 */
.chart-container {
    height: 400px; 
    width: 100%;
    overflow: hidden; /* 防止內容溢出 */
}

/* 右側欄位 */
.side-column {
    min-width: 0;
}

.sticky-panel {
    position: sticky;
    top: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    z-index: 10;
}

.spacer { height: 1px; background: var(--border-color); opacity: 0.5; }

/* RWD 修正 */
@media (max-width: 1280px) {
    .content-container {
        grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
        padding: 20px;
    }
    .section-charts {
        grid-template-columns: 1fr; /* 變為單欄 */
        min-height: auto;
    }
    .chart-container {
        height: 350px; /* 手機版高度 */
        margin-bottom: 24px; /* 增加間距 */
    }
    /* 修復最後一個圖表的 margin */
    .chart-container:last-child {
        margin-bottom: 0;
    }
}

@media (max-width: 1024px) {
    .content-container {
        display: flex; /* 改用 Flex 垂直排列 */
        flex-direction: column;
    }
    .sticky-panel {
        position: static; /* 取消 sticky */
    }
    .side-column {
        width: 100%;
    }
    .nav-status span { display: none; } /* 手機版隱藏文字 */
    .nav-status .user-profile { display: flex; }
}

/* Card Common */
.card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: var(--shadow-sm);
}
.card h3 { 
    font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0 0 20px 0; 
    border-left: 4px solid var(--primary); padding-left: 12px;
}

/* Toast */
.toast-container { position: fixed; bottom: 32px; right: 32px; z-index: 9999; display: flex; flex-direction: column; gap: 12px; }
.toast { 
    background: #fff; border: 1px solid var(--border-color); border-left: 4px solid transparent;
    padding: 16px; border-radius: 4px; box-shadow: var(--shadow-md); 
    display: flex; gap: 12px; min-width: 300px; cursor: pointer;
}
.toast.success { border-left-color: var(--success); }
.toast.error { border-left-color: var(--danger); }
.toast-icon { font-size: 1.2rem; font-weight: bold; }
.toast.success .toast-icon { color: var(--success); }
.toast.error .toast-icon { color: var(--danger); }
.toast-title { font-weight: 700; font-size: 0.95rem; margin-bottom: 2px; }
.toast-msg { font-size: 0.85rem; color: var(--text-sub); }

.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s ease; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateX(30px); }
</style>
