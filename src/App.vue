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
                <span class="dot"></span> 更新中...
            </div>
            <div v-else class="status-indicator ready">
                <span class="dot"></span> 連線正常
            </div>
            
            <div class="user-profile" @click="handleLogout" title="點擊登出">
                <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="avatar-img" alt="User">
                <div v-else class="avatar">{{ userInitial }}</div>
                <span class="logout-text desktop-only">登出</span>
            </div>
        </div>
      </header>

      <div class="content-container">
        <main class="main-column">
            <section class="section-stats">
                <StatsGrid />
            </section>
            
            <section class="section-charts">
                <div class="chart-wrapper">
                    <PerformanceChart />
                </div>
                <div class="chart-wrapper">
                    <PieChart />
                </div>
            </section>

            <section class="section-holdings">
                <HoldingsTable />
            </section>

            <section class="section-records">
                <RecordList @edit="handleEditRecord" />
            </section>
        </main>

        <aside class="side-column">
            <div class="sticky-panel">
                <TradeForm ref="tradeFormRef" />
            </div>
        </aside>
      </div>
    </div>

    <div class="toast-container">
      <TransitionGroup name="toast-slide">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" @click="removeToast(t.id)">
          <div class="toast-icon">{{ t.type === 'success' ? '✓' : '!' }}</div>
          <div class="toast-body"><div class="toast-msg">{{ t.message }}</div></div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
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
    if (window.innerWidth < 1024) {
        document.querySelector('.side-column').scrollIntoView({ behavior: 'smooth' });
    }
  }
};

const userInitial = computed(() => {
    return authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U';
});

const handleLogout = () => {
    if (confirm("確定要登出系統嗎？")) {
        authStore.logout();
    }
};

onMounted(async () => {
  authStore.initAuth();
  if (authStore.token) {
      await portfolioStore.fetchAll();
  }
});
</script>

<style>
/* 引入現代字體 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

/* 全域變數定義 */
:root {
    --bg-app: #f1f5f9;       /* 柔和淺灰背景 */
    --bg-card: #ffffff;
    --primary: #3b82f6;      /* 現代藍 */
    --primary-dark: #2563eb;
    --text-main: #0f172a;    /* 深藍黑 */
    --text-sub: #64748b;     /* 冷灰色 */
    --border-color: #e2e8f0; /* 極淡邊框 */
    --success: #10b981;
    --danger: #ef4444;
    
    /* 陰影系統 */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    
    --radius: 16px;
}

body {
    background-color: var(--bg-app);
    color: var(--text-main);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
}

/* 佈局容器 */
.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; }

.top-nav {
    background: #fff;
    border-bottom: 1px solid var(--border-color);
    padding: 0 32px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 100;
    box-shadow: var(--shadow-sm);
}

.nav-brand { display: flex; align-items: center; gap: 12px; }
.nav-brand h1 { font-size: 1.25rem; font-weight: 700; margin: 0; color: var(--text-main); letter-spacing: -0.01em; }
.badge { background: #0f172a; color: #fff; font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
.logo-icon { font-size: 1.5rem; }

/* 用戶狀態區 */
.nav-status { display: flex; align-items: center; gap: 24px; font-size: 0.9rem; font-weight: 500; }
.status-indicator { display: flex; align-items: center; gap: 8px; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.loading .dot { animation: pulse 1.5s infinite; }

.user-profile { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 8px; border-radius: 99px; transition: background 0.2s; }
.user-profile:hover { background: #f1f5f9; }
.avatar { width: 36px; height: 36px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #475569; }
.avatar-img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color); }

/* 主內容 Grid */
.content-container { 
    max-width: 1600px; 
    margin: 0 auto; 
    padding: 32px; 
    display: grid; 
    grid-template-columns: minmax(0, 1fr) 380px; 
    gap: 24px;
    width: 100%; 
    box-sizing: border-box; 
    align-items: start; 
}

.main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.section-charts { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; width: 100%; }
.side-column { min-width: 0; }
.sticky-panel { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 24px; z-index: 10; }

/* 統一卡片風格 */
.card, .chart-wrapper { 
    background: var(--bg-card); 
    border: 1px solid var(--border-color); 
    border-radius: var(--radius); 
    padding: 24px; 
    box-shadow: var(--shadow-card);
    transition: transform 0.2s, box-shadow 0.2s;
}

.chart-wrapper { height: 400px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }

.card h3 { 
    font-size: 1.125rem; 
    font-weight: 700; 
    color: var(--text-main); 
    margin: 0 0 20px 0; 
    letter-spacing: -0.01em;
}

/* 全域表格樣式優化 */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { 
    text-align: left; color: var(--text-sub); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; 
    padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: #f8fafc;
}
th:first-child { border-top-left-radius: 8px; }
th:last-child { border-top-right-radius: 8px; }
td { padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-main); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background-color: #f8fafc; transition: background 0.15s; }

/* Toast */
.toast-container { position: fixed; bottom: 32px; right: 32px; z-index: 9999; display: flex; flex-direction: column; gap: 12px; }
.toast { background: #fff; border: 1px solid #e2e8f0; border-left: 4px solid transparent; padding: 16px 20px; border-radius: 12px; box-shadow: var(--shadow-card); display: flex; gap: 12px; cursor: pointer; min-width: 280px; }
.toast.success { border-left-color: var(--success); } .toast.error { border-left-color: var(--danger); }
.toast-msg { font-size: 0.9rem; color: #334155; font-weight: 500; }

@media (max-width: 1280px) {
    .content-container { grid-template-columns: 1fr; padding: 20px; gap: 20px; }
    .side-column { order: -1; } 
    .section-charts { grid-template-columns: 1fr; }
    .sticky-panel { position: static; }
    .desktop-only { display: none; }
}
</style>
