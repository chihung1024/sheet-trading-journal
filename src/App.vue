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
:root { --bg-app: #f8f9fa; --bg-card: #ffffff; --border-color: #e2e8f0; --primary: #2563eb; --primary-dark: #1e40af; --text-main: #0f172a; --text-sub: #64748b; --success: #10b981; --danger: #ef4444; --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05); --radius: 8px; }
body { background-color: var(--bg-app); color: var(--text-main); font-family: 'Inter', system-ui, sans-serif; margin: 0; font-size: 15px; line-height: 1.5; }

.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
.top-nav { background: #fff; border-bottom: 1px solid var(--border-color); padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; z-index: 100; }
.nav-brand { display: flex; align-items: center; gap: 10px; }
.nav-brand h1 { font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--text-main); }
.badge { background: #1f2937; color: #fff; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px; vertical-align: middle; }
.logo-icon { font-size: 1.4rem; }

.nav-status { display: flex; align-items: center; gap: 16px; font-size: 0.85rem; font-weight: 500; }
.status-indicator { display: flex; align-items: center; gap: 6px; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.loading .dot { animation: pulse 1s infinite; }

.user-profile { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px; border-radius: 20px; transition: background 0.2s; }
.user-profile:hover { background: rgba(0,0,0,0.05); }
.avatar { width: 32px; height: 32px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #666; }
.avatar-img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid #ddd; }
.logout-text { font-size: 0.85rem; color: #666; }

/* 核心佈局修正 */
.content-container { 
    max-width: 1600px; 
    margin: 0 auto; 
    padding: 24px; 
    display: grid; 
    /* 左欄 3fr，右欄固定 320px，中間 gap 24px */
    grid-template-columns: minmax(0, 1fr) 340px; 
    gap: 24px; 
    width: 100%; 
    box-sizing: border-box; 
    align-items: start; 
}

.main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }

/* 圖表區塊 Grid 修正：強制不重疊 */
.section-charts { 
    display: grid; 
    grid-template-columns: 2fr 1fr; /* 2:1 比例 */
    gap: 24px; 
    width: 100%;
}

.chart-wrapper {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    height: 400px; /* 固定高度 */
    width: 100%;
    overflow: hidden; /* 關鍵：防止內容溢出 */
    display: flex;
    flex-direction: column;
}

.side-column { min-width: 0; }
.sticky-panel { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 24px; z-index: 10; }

/* RWD 修正 */
@media (max-width: 1280px) {
    .content-container { grid-template-columns: 1fr; } /* 變為單欄 */
    .side-column { order: -1; } /* 手機版將表單拉到最上方 (可選) */
    .section-charts { grid-template-columns: 1fr; height: auto; }
    .chart-wrapper { height: 350px; }
    .sticky-panel { position: static; }
    .desktop-only { display: none; }
}

.card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow-sm); }
.card h3 { font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0 0 16px 0; padding-left: 10px; border-left: 4px solid var(--primary); }

.toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; }
.toast { background: #fff; border: 1px solid #ddd; border-left: 4px solid transparent; padding: 12px 16px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; gap: 12px; cursor: pointer; min-width: 250px; }
.toast.success { border-left-color: var(--success); } .toast.error { border-left-color: var(--danger); }
.toast-msg { font-size: 0.9rem; color: #333; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s ease; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateX(30px); }
</style>
