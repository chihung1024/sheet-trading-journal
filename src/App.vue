<template>
  <div class="app-container" :data-theme="themeStore.isDark ? 'dark' : 'light'">
    <LoginOverlay v-if="!authStore.token" />
    <div v-else>
      <HeaderBar ref="headerRef" />
      <main class="main-content">
        <div v-if="portfolioStore.loading" class="loading-wrapper">
          <div class="skeleton-grid">
            <div v-for="i in 4" :key="i" class="skeleton-card" />
          </div>
        </div>
        <div v-else>
          <StatsGrid />
          <div class="chart-section">
            <PerformanceChart />
            <PieChart />
          </div>
          <HoldingsTable />
          <TradeForm ref="tradeFormRef" id="trade-form-anchor" @success="handleTradeSuccess" />
          <RecordList @edit="handleEditRecord" />
        </div>
      </main>
    </div>
    <!-- 全局組件 -->
    <ToastContainer />
    <ConfirmDialog />
    <NavigationDrawer ref="drawerRef" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useToastStore } from './stores/toast';
import { useThemeStore } from './stores/theme';

// Components
import LoginOverlay from './components/LoginOverlay.vue';
import HeaderBar from './components/HeaderBar.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import PieChart from './components/PieChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import ToastContainer from './components/ToastContainer.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import NavigationDrawer from './components/NavigationDrawer.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const toastStore = useToastStore();
const themeStore = useThemeStore();

const tradeFormRef = ref(null);
const headerRef = ref(null);
const drawerRef = ref(null);

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    document.getElementById('trade-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  }
};

const handleTradeSuccess = (message) => {
  toastStore.success(message || '操作成功！');
};

onMounted(() => {
  authStore.initAuth();
  themeStore.initTheme();
});

watch(
  () => themeStore.isDark,
  (isDark) => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  },
  { immediate: true }
);

// 暴露方法供外部調用
defineExpose({ drawerRef, headerRef });
</script>

<style>
/* ========== CSS 變數系統（支援亮/暗主題） ========== */
:root[data-theme='dark'] {
  --bg: #0f1117;
  --bg-secondary: #161b22;
  --card-bg: #0d1117;
  --border: #30363d;
  --border-light: rgba(48, 54, 61, 0.5);
  --primary: #1f6feb;
  --primary-dark: #1a5ba0;
  --primary-light: #3b8bff;
  --success: #238636;
  --success-light: #26a641;
  --warning: #9e6a03;
  --warning-light: #d29922;
  --error: #da3633;
  --error-light: #f85149;
  --info: #0969da;
  --info-light: #2884e8;
  --text: #e6edf3;
  --text-secondary: #c9d1d9;
  --text-tertiary: #8b949e;
  --text-muted: #6e7681;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 16px 40px rgba(0, 0, 0, 0.6);
  --gradient-primary: linear-gradient(135deg, #1f6feb 0%, #0969da 100%);
  --gradient-success: linear-gradient(135deg, #238636 0%, #26a641 100%);
  --gradient-error: linear-gradient(135deg, #da3633 0%, #f85149 100%);
}

:root[data-theme='light'] {
  --bg: #ffffff;
  --bg-secondary: #f6f8fa;
  --card-bg: #ffffff;
  --border: #d0d7de;
  --border-light: rgba(208, 215, 222, 0.5);
  --primary: #0969da;
  --primary-dark: #0860ca;
  --primary-light: #2884e8;
  --success: #1a7f37;
  --success-light: #238636;
  --warning: #9e6a03;
  --warning-light: #d29922;
  --error: #cf222e;
  --error-light: #da3633;
  --info: #0969da;
  --info-light: #2884e8;
  --text: #24292f;
  --text-secondary: #424a53;
  --text-tertiary: #57606a;
  --text-muted: #768390;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 16px 40px rgba(0, 0, 0, 0.25);
  --gradient-primary: linear-gradient(135deg, #0969da 0%, #033d8b 100%);
  --gradient-success: linear-gradient(135deg, #1a7f37 0%, #238636 100%);
  --gradient-error: linear-gradient(135deg, #cf222e 0%, #da3633 100%);
}

/* ========== 全域重置與基礎樣式 ========== */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: -0.5px;
  transition: background-color 300ms ease, color 300ms ease;
  overflow-x: hidden;
}

/* ========== 間距系統 ========== */
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
}

/* ========== 圓角系統 ========== */
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}

/* ========== 過渡時間 ========== */
:root {
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --easing-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --easing-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --easing-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}

/* ========== 應用容器 ========== */
.app-container {
  min-height: 100vh;
  background-color: var(--bg);
  transition: background-color 300ms ease;
}

.main-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 80px;
}

@media (max-width: 768px) {
  .main-content {
    padding: 12px;
    padding-bottom: 100px;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 8px;
    padding-bottom: 120px;
  }
}

/* ========== 卡片樣式 ========== */
.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-normal) var(--easing-ease-in-out);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

/* ========== 加載狀態 ========== */
.loading-wrapper {
  width: 100%;
  padding: var(--space-lg);
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-lg);
}

.skeleton-card {
  height: 200px;
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 0%,
    var(--border) 50%,
    var(--bg-secondary) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-lg);
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* ========== 圖表部分 ========== */
.chart-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
  margin-bottom: var(--space-lg);
}

@media (max-width: 1024px) {
  .chart-section {
    grid-template-columns: 1fr;
  }
}

/* ========== 響應式調整 ========== */
@media (max-width: 768px) {
  .app-container {
    min-height: 100vh;
  }
}
</style>
