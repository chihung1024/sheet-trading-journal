<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <!-- 臨時移除登入檢查 -->
    <!-- <LoginOverlay v-if="!authStore.token" /> -->
    
    <div class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
            <span class="logo-icon">📊</span>
            <h1>Trading Journal <span class="badge">PRO</span></h1>
        </div>
        <div class="nav-status">
            <div class="status-indicator ready">
                <span class="dot"></span> 測試模式
            </div>
            
            <button class="theme-toggle" @click="toggleTheme">
                <span v-if="isDark">☀️</span>
                <span v-else>🌙</span>
            </button>
        </div>
      </header>

      <div class="content-container">
        <main class="main-column">
            <section class="section-stats">
                <div class="card">
                    <h3>應用運行測試</h3>
                    <p>如果您看到這個頁面，表示 Vue 應用已成功啟動。</p>
                    <p>當前時間: {{ new Date().toLocaleString('zh-TW') }}</p>
                    <button @click="testAlert" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">
                      測試互動
                    </button>
                </div>
            </section>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useToast } from './composables/useToast';
import { useDarkMode } from './composables/useDarkMode';

import LoginOverlay from './components/LoginOverlay.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import PieChart from './components/PieChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';

// Skeleton components
import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { toasts, removeToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();

const isInitialLoading = ref(true);

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    if (window.innerWidth < 1024) {
        document.querySelector('.side-column')?.scrollIntoView({ behavior: 'smooth' });
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
      isInitialLoading.value = true;
      await portfolioStore.fetchAll();
      // 模擬最小載入時間，讓骨架屏更自然
      setTimeout(() => {
        isInitialLoading.value = false;
      }, 600);
  }
  
  // 移除載入畫面
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) {
    loadingEl.style.opacity = '0';
    setTimeout(() => loadingEl.remove(), 300);
  }
});
</script>

<style>
/* 引入現代字體 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

/* 全域變數定義 - Light Mode */
:root {
    --bg-app: #f1f5f9;
    --bg-card: #ffffff;
    --bg-secondary: #f8fafc;
    --primary: #3b82f6;
    --primary-dark: #2563eb;
    --text-main: #0f172a;
    --text-sub: #64748b;
    --border-color: #e2e8f0;
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
    
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    
    --radius: 16px;
    --radius-sm: 8px;
}

/* Dark Mode Variables */
html.dark {
    --bg-app: #0f172a;
    --bg-card: #1e293b;
    --bg-secondary: #334155;
    --primary: #60a5fa;
    --primary-dark: #3b82f6;
    --text-main: #f1f5f9;
    --text-sub: #94a3b8;
    --border-color: #334155;
    --success: #34d399;
    --danger: #f87171;
    --warning: #fbbf24;
    
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
    --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4);
}

* {
    box-sizing: border-box;
}

body {
    background-color: var(--bg-app);
    color: var(--text-main);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    transition: background-color 0.3s ease, color 0.3s ease;
}

/* 佈局容器 */
.main-wrapper { 
    min-height: 100vh; 
    display: flex; 
    flex-direction: column; 
}

.top-nav {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    padding: 0 32px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 100;
    box-shadow: var(--shadow-sm);
    transition: all 0.3s ease;
}

.nav-brand { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
}

.nav-brand h1 { 
    font-size: 1.25rem; 
    font-weight: 700; 
    margin: 0; 
    color: var(--text-main); 
    letter-spacing: -0.01em; 
}

.badge { 
    background: var(--text-main);
    color: var(--bg-card);
    font-size: 0.7rem; 
    padding: 2px 8px; 
    border-radius: 99px; 
    font-weight: 600; 
}

.logo-icon { 
    font-size: 1.5rem; 
}

/* 用戶狀態區 */
.nav-status { 
    display: flex; 
    align-items: center; 
    gap: 20px; 
    font-size: 0.9rem; 
    font-weight: 500; 
}

.status-indicator { 
    display: flex; 
    align-items: center; 
    gap: 8px; 
}

.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }

.dot { 
    width: 8px; 
    height: 8px; 
    border-radius: 50%; 
    background: currentColor; 
}

.loading .dot { 
    animation: pulse 1.5s infinite; 
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* 深色模式切換按鈕 */
.theme-toggle {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1.2rem;
}

.theme-toggle:hover {
    background: var(--primary);
    border-color: var(--primary);
    transform: scale(1.1);
}

.user-profile { 
    display: flex; 
    align-items: center; 
    gap: 10px; 
    cursor: pointer; 
    padding: 4px 12px; 
    border-radius: 99px; 
    transition: background 0.2s; 
}

.user-profile:hover { 
    background: var(--bg-secondary); 
}

.avatar { 
    width: 36px; 
    height: 36px; 
    background: var(--bg-secondary); 
    border-radius: 50%; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-weight: 600; 
    color: var(--text-sub); 
}

.avatar-img { 
    width: 36px; 
    height: 36px; 
    border-radius: 50%; 
    object-fit: cover; 
    border: 2px solid var(--border-color); 
}

/* 主內容 Grid */
.content-container { 
    max-width: 1600px; 
    margin: 0 auto; 
    padding: 32px; 
    display: grid; 
    grid-template-columns: minmax(0, 1fr) 380px; 
    gap: 24px;
    width: 100%; 
    align-items: start; 
}

.main-column { 
    display: flex; 
    flex-direction: column; 
    gap: 24px; 
    min-width: 0; 
}

.section-charts { 
    display: grid; 
    grid-template-columns: 2fr 1fr; 
    gap: 24px; 
    width: 100%; 
}

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

/* 統一卡片風格 */
.card, .chart-wrapper { 
    background: var(--bg-card); 
    border: 1px solid var(--border-color); 
    border-radius: var(--radius); 
    padding: 24px; 
    box-shadow: var(--shadow-card);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.chart-wrapper { 
    height: 400px; 
    padding: 0; 
    overflow: hidden; 
    display: flex; 
    flex-direction: column; 
}

.card h3 { 
    font-size: 1.125rem; 
    font-weight: 700; 
    color: var(--text-main); 
    margin: 0 0 20px 0; 
    letter-spacing: -0.01em;
}

/* 全域表格樣式優化 */
table { 
    width: 100%; 
    border-collapse: separate; 
    border-spacing: 0; 
}

th { 
    text-align: left; 
    color: var(--text-sub); 
    font-size: 0.75rem; 
    text-transform: uppercase; 
    letter-spacing: 0.05em; 
    font-weight: 600; 
    padding: 12px 16px; 
    border-bottom: 1px solid var(--border-color); 
    background: var(--bg-secondary);
}

th:first-child { border-top-left-radius: var(--radius-sm); }
th:last-child { border-top-right-radius: var(--radius-sm); }

td { 
    padding: 16px; 
    border-bottom: 1px solid var(--border-color); 
    font-size: 0.9rem; 
    color: var(--text-main); 
    vertical-align: middle; 
}

tr:last-child td { border-bottom: none; }
tr:hover td { 
    background-color: var(--bg-secondary); 
    transition: background 0.15s; 
}

/* Toast 通知 */
.toast-container { 
    position: fixed; 
    bottom: 32px; 
    right: 32px; 
    z-index: 9999; 
    display: flex; 
    flex-direction: column; 
    gap: 12px; 
}

.toast { 
    background: var(--bg-card); 
    border: 1px solid var(--border-color); 
    border-left: 4px solid transparent; 
    padding: 16px 20px; 
    border-radius: 12px; 
    box-shadow: var(--shadow-lg); 
    display: flex; 
    gap: 12px; 
    cursor: pointer; 
    min-width: 280px;
    animation: slideIn 0.3s ease;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.toast.success { border-left-color: var(--success); }
.toast.error { border-left-color: var(--danger); }

.toast-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}

.toast.success .toast-icon {
    background: #dcfce7;
    color: #166534;
}

.toast.error .toast-icon {
    background: #fee2e2;
    color: #991b1b;
}

.toast-msg { 
    font-size: 0.9rem; 
    color: var(--text-main); 
    font-weight: 500; 
}

.toast-slide-enter-active,
.toast-slide-leave-active {
    transition: all 0.3s ease;
}

.toast-slide-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.toast-slide-leave-to {
    transform: translateX(100%);
    opacity: 0;
}

/* 響應式設計 */
@media (max-width: 1280px) {
    .content-container { 
        grid-template-columns: 1fr; 
        padding: 20px; 
        gap: 20px; 
    }
    
    .side-column { order: -1; } 
    .section-charts { grid-template-columns: 1fr; }
    .sticky-panel { position: static; }
    .desktop-only { display: none; }
}

@media (max-width: 768px) {
    .top-nav {
        padding: 0 16px;
        height: 56px;
    }
    
    .nav-brand h1 {
        font-size: 1.1rem;
    }
    
    .logo-icon {
        font-size: 1.3rem;
    }
    
    .status-indicator {
        font-size: 0.8rem;
    }
    
    .content-container {
        padding: 16px;
    }
    
    .toast-container {
        bottom: 16px;
        right: 16px;
        left: 16px;
    }
    
    .toast {
        min-width: auto;
    }
}

@media (max-width: 480px) {
    .nav-status {
        gap: 12px;
    }
    
    .status-indicator:not(.loading):not(.ready) {
        display: none;
    }
    
    .theme-toggle {
        width: 36px;
        height: 36px;
        font-size: 1rem;
    }
}
</style>
