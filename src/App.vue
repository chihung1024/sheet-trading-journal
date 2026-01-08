<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
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
          
          <!-- GitHub Action 手動觸發按鈕 -->
          <button 
            class="action-trigger-btn" 
            @click="triggerGitHubAction" 
            :disabled="isActionTriggerLoading"
            title="手動觸發投資組合數據更新"
          >
            <span v-if="!isActionTriggerLoading">⚙️</span>
            <span v-else class="spinner">⟳</span>
            {{ isActionTriggerLoading ? '更新中...' : '更新數據' }}
          </button>
          
          <!-- 深色模式切換按鈕 -->
          <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切換為淺色模式' : '切換為深色模式'">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>
          
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
            <StatsGrid v-if="!isInitialLoading" />
            <StatsGridSkeleton v-else />
          </section>
          
          <section class="section-charts">
            <div class="chart-wrapper">
              <PerformanceChart v-if="!isInitialLoading" />
              <ChartSkeleton v-else />
            </div>
            <div class="chart-wrapper">
              <PieChart v-if="!isInitialLoading" />
              <ChartSkeleton v-else />
            </div>
          </section>
          <section class="section-holdings">
            <HoldingsTable v-if="!isInitialLoading" />
            <TableSkeleton v-else />
          </section>
          <section class="section-records">
            <RecordList v-if="!isInitialLoading" @edit="handleEditRecord" />
            <TableSkeleton v-else />
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
import { usePWA } from './composables/usePWA';

const { 
  isInstallable, 
  isInstalled, 
  isOnline, 
  install 
} = usePWA();

import { ref, onMounted, computed, nextTick } from 'vue';
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
const { toasts, removeToast, addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();

const isInitialLoading = ref(true);
const isActionTriggerLoading = ref(false);

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

// GitHub Action 手動觸發函數
const triggerGitHubAction = async () => {
  if (!authStore.token) {
    addToast('請先登入', 'error');
    return;
  }

  isActionTriggerLoading.value = true;
  try {
    const response = await fetch(
      'https://api.github.com/repos/chihung1024/sheet-trading-journal/actions/workflows/update.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main'
        })
      }
    );

    if (response.ok) {
      addToast('✓ 已觸發數據更新，將在數秒內完成', 'success');
      setTimeout(async () => {
        await portfolioStore.fetchAll();
        addToast('✓ 數據已更新', 'success');
      }, 3000);
    } else if (response.status === 404) {
      addToast('❌ 找不到 GitHub 工作流程', 'error');
    } else if (response.status === 403) {
      addToast('❌ 無權限觸發工作流程', 'error');
    } else {
      addToast('❌ 觸發失敗，請稍後再試', 'error');
    }
  } catch (error) {
    console.error('觸發 GitHub Action 失敗:', error);
    addToast('❌ 網路錯誤，請檢查連線', 'error');
  } finally {
    isActionTriggerLoading.value = false;
  }
};

onMounted(async () => {
  authStore.initAuth();
  await nextTick();
  
  if (authStore.token) {
    isInitialLoading.value = true;
    try {
      await portfolioStore.fetchAll();
      console.log('📊 首次載入完成');
    } catch (error) {
      console.error('❌ 載入數據失敗:', error);
    } finally {
      setTimeout(() => {
        isInitialLoading.value = false;
      }, 600);
    }
  }
  
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) {
    loadingEl.style.opacity = '0';
    setTimeout(() => loadingEl.remove(), 300);
  }
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

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

.action-trigger-btn {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  border: none;
  border-radius: 8px;
  color: white;
  padding: 8px 14px;
  font-weight: 600;
