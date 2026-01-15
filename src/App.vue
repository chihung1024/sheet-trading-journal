<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
          <span class="logo-icon">📊</span>
          <h1>Trading Journal <span class="badge">PRO</span></h1>
          
          <!-- ✅ 新增：群組切換器 -->
          <div class="group-selector">
            <button class="group-btn" @click="toggleGroupMenu">
              <span class="group-icon">{{ currentGroup.icon }}</span>
              <span class="group-name">{{ currentGroup.name }}</span>
              <span class="chevron">▼</span>
            </button>
            
            <!-- 下拉選單 -->
            <Transition name="dropdown">
              <div v-if="showGroupMenu" class="group-menu">
                <div v-for="group in groups" :key="group.id"
                     class="group-item"
                     :class="{ active: currentGroupId === group.id }"
                     @click="switchGroup(group.id)">
                  <span class="group-icon">{{ group.icon }}</span>
                  <span class="group-name">{{ group.name }}</span>
                  <span v-if="currentGroupId === group.id" class="check">✓</span>
                </div>
                
                <div class="group-divider"></div>
                <button class="group-manage-btn" @click="openGroupManager">
                  ⚙️ 管理群組
                </button>
              </div>
            </Transition>
          </div>
        </div>
        <div class="nav-status">
          <!-- 狀態 1: 正在載入資料 -->
          <div v-if="portfolioStore.loading" class="status-indicator loading">
            <span class="dot"></span> 更新中...
          </div>
          
          <!-- ✅ 新增狀態 2: 正在輪詢監控 (橘燈閃爍) -->
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling">
            <span class="dot pulse-orange"></span> 計算中...
          </div>
          
          <!-- 狀態 3: 正常連線 -->
          <div v-else class="status-indicator ready">
            <span class="dot"></span> 連線正常
          </div>
          
          <!-- ✅ 修改 @click 事件繫定 -->
          <button 
            class="action-trigger-btn" 
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
            :title="portfolioStore.isPolling ? '系統正在背景計算中...' : '手動觸發投資組合數據更新'"
          >
            <span>⚙️</span>
            更新數據
          </button>
          
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
            <!-- 使用 portfolioStore.loading 控制骸架屏 -->
            <StatsGrid v-if="!portfolioStore.loading" />
            <StatsGridSkeleton v-else />
          </section>
          
          <!-- ✅ 優化圖表區域：隱藏圓餅圖，讓趋勢分析圖佔滿寬度 -->
          <section class="section-charts">
            <div class="chart-wrapper chart-full">
              <PerformanceChart v-if="!portfolioStore.loading" />
              <ChartSkeleton v-else />
            </div>
          </section>
          
          <section class="section-holdings">
            <HoldingsTable v-if="!portfolioStore.loading" />
            <TableSkeleton v-else />
          </section>
          
          <section class="section-records">
            <RecordList v-if="!portfolioStore.loading" @edit="handleEditRecord" />
            <TableSkeleton v-else />
          </section>
          
          <!-- ✅ 新增：配息管理區塊 -->
          <section class="section-dividends" v-if="!portfolioStore.loading && hasPendingDividends">
            <DividendManager />
          </section>
        </main>
        
        <aside class="side-column">
          <div class="sticky-panel">
            <TradeForm ref="tradeFormRef" />
            
            <!-- ✅ 新增：配息提醒卡片 -->
            <div v-if="hasPendingDividends" class="dividend-alert card">
              <div class="alert-header">
                <span class="alert-icon">🔔</span>
                <h4>待確認配息</h4>
              </div>
              <p class="alert-text">
                您有 <strong>{{ pendingDividendsCount }}</strong> 筆配息待確認
              </p>
              <button class="btn-alert" @click="scrollToDividends">
                前往確認
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
    
    <!-- ✅ 新增：群組管理器 Modal -->
    <GroupManager 
      :show="portfolioStore.showGroupManagerModal" 
      @close="portfolioStore.showGroupManagerModal = false"
      @saved="handleGroupsSaved"
    />
    
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
import { CONFIG } from './config';

import LoginOverlay from './components/LoginOverlay.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import DividendManager from './components/DividendManager.vue';  // ✅ 新增
import GroupManager from './components/GroupManager.vue';  // ✅ 新增

// Skeleton components
import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { toasts, removeToast, addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();

// ✅ 新增：群組選單控制
const showGroupMenu = ref(false);
const groups = computed(() => portfolioStore.groups);
const currentGroupId = computed(() => portfolioStore.currentGroupId);
const currentGroup = computed(() => portfolioStore.currentGroup);

const toggleGroupMenu = () => {
  showGroupMenu.value = !showGroupMenu.value;
};

const switchGroup = (groupId) => {
  portfolioStore.switchGroup(groupId);
  showGroupMenu.value = false;
};

const openGroupManager = () => {
  portfolioStore.showGroupManagerModal = true;
  showGroupMenu.value = false;
};

const handleGroupsSaved = () => {
  addToast('✅ 群組配置已儲存', 'success');
};

// ✅ 新增：計算是否有待確認配息
const hasPendingDividends = computed(() => {
  return portfolioStore.pending_dividends && portfolioStore.pending_dividends.length > 0;
});

const pendingDividendsCount = computed(() => {
  return portfolioStore.pending_dividends ? portfolioStore.pending_dividends.length : 0;
});

// ✅ 新增：滾動至配息管理區塊
const scrollToDividends = () => {
  const dividendSection = document.querySelector('.section-dividends');
  if (dividendSection) {
    dividendSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// ✅ 更新後的處理函式：配合輪詢機制
const handleTriggerUpdate = async () => {
  // 1. 如果正在輪詢，提示使用者並阻擋重複觸發
  if (portfolioStore.isPolling) {
    addToast("⌛ 系統已在背景監控更新中，請稍候...", "info");
    return;
  }

  // 2. 確認是否觸發
  if (!confirm("確定要觸發後端計算嗎？")) return;
  
  try {
    addToast("🚀 正在請求 GitHub Actions...", "info");
    
    // 3. 呼叫 Store 的 triggerUpdate (現在會自動啟動輪詢)
    await portfolioStore.triggerUpdate();
    
    // 4. 成功提示
    addToast("✅ 已觸發！系統將在背景監控，更新完成後自動刷新。", "success");
    
  } catch (error) {
    addToast(`❌ 觸發失敗: ${error.message}`, "error");
  }
};

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
  console.log('🚀 App.vue mounted');
  
  // 1. 先嘗試恢復登入狀態
  const isLoggedIn = authStore.initAuth();
  
  // 2. 如果已登入，手動觸發資料載入
  if (isLoggedIn) {
    console.log('🔐 已登入，開始載入投資組合數據...');
    await portfolioStore.fetchAll();
  }
  
  await nextTick();
  
  // 移除載入動畫
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) {
    setTimeout(() => {
      loadingEl.style.opacity = '0';
      setTimeout(() => loadingEl.remove(), 300);
    }, 500);
  }
  
  console.log('✅ App 初始化完成');
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
  --radius-md: 12px;
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
  font-size: 18px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s ease, color 0.3s ease;
  overflow: visible;
}

.main-wrapper { 
  min-height: 100vh; 
  display: flex; 
  flex-direction: column; 
  overflow: visible;
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
  font-size: 1.45rem; 
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

/* ✅ 新增：群組切換器樣式 */
.group-selector {
  position: relative;
  margin-left: 16px;
}

.group-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-main);
}

.group-btn:hover {
  background: var(--border-color);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.group-icon {
  font-size: 1.1rem;
}

.chevron {
  font-size: 0.7rem;
  color: var(--text-sub);
  transition: transform 0.2s;
}

.group-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  min-width: 240px;
  padding: 8px;
  z-index: 1000;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-main);
}

.group-item:hover {
  background: var(--bg-secondary);
}

.group-item.active {
  background: var(--primary);
  color: white;
}

.check {
  margin-left: auto;
  font-weight: bold;
}

.group-divider {
  height: 1px;
  background: var(--border-color);
  margin: 8px 0;
}

.group-manage-btn {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  text-align: left;
  transition: background 0.2s;
  color: var(--text-main);
}

.group-manage-btn:hover {
  background: var(--bg-secondary);
}

/* Dropdown 動畫 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.nav-status { 
  display: flex; 
  align-items: center; 
  gap: 20px; 
  font-size: 1rem; 
  font-weight: 500; 
}

.status-indicator { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
}

.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
/* ✅ 新增 polling 狀態顏色 */
.status-indicator.polling { color: var(--warning); }

.dot { 
  width: 8px; 
  height: 8px; 
  border-radius: 50%; 
  background: currentColor; 
}

.loading .dot { 
  animation: pulse 1.5s infinite; 
}

/* ✅ 新增橘色脈衝動畫 */
.pulse-orange {
  animation: pulse-orange 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse-orange {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
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
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.action-trigger-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  background: linear-gradient(135deg, var(--primary-dark), var(--primary));
}

.action-trigger-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
  filter: grayscale(0.5);
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

.content-container { 
  max-width: 1600px; 
  margin: 0 auto; 
  padding: 32px; 
  display: grid; 
  grid-template-columns: minmax(0, 1fr) 380px; 
  gap: 24px;
  width: 100%; 
  align-items: stretch;
  overflow: visible;
}

.main-column { 
  display: flex; 
  flex-direction: column; 
  gap: 24px; 
  min-width: 0; 
}

/* ✅ 優化圖表區域：移除 grid 佈局，讓趋勢分析圖佔滿寬度 */
.section-charts { 
  display: block;
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
  height: fit-content; 
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

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

/* ✅ 讓圖表佔滿整個寬度並增加高度 */
.chart-wrapper.chart-full { 
  height: 500px;
  width: 100%; 
}

.card h3 { 
  font-size: 1.125rem; 
  font-weight: 700; 
  color: var(--text-main); 
  margin: 0 0 20px 0; 
  letter-spacing: -0.01em;
}

/* ✅ 新增：配息提醒卡片樣式 */
.dividend-alert {
  border-left: 4px solid var(--warning);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.alert-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.alert-icon {
  font-size: 1.3rem;
}

.alert-text {
  margin: 0 0 16px 0;
  font-size: 0.95rem;
  color: var(--text-sub);
  line-height: 1.5;
}

.alert-text strong {
  color: var(--warning);
  font-weight: 700;
}

.btn-alert {
  width: 100%;
  padding: 10px;
  background: var(--warning);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.95rem;
}

.btn-alert:hover {
  opacity: 0.9;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3);
}

table { 
  width: 100%; 
  border-collapse: separate; 
  border-spacing: 0; 
}

th { 
  text-align: left; 
  color: var(--text-sub); 
  font-size: 0.85rem; 
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
  font-size: 1rem; 
  color: var(--text-main); 
  vertical-align: middle; 
}

tr:last-child td { border-bottom: none; }

tr:hover td { 
  background-color: var(--bg-secondary); 
  transition: background 0.15s; 
}

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
  font-size: 1rem; 
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

@media (max-width: 1024px) {
  .content-container { 
    grid-template-columns: 1fr; 
    padding: 20px; 
    gap: 20px; 
  }
  
  .side-column { order: -1; }
  /* ✅ 移除小螢幕上的 grid 佈局 */
  .section-charts { display: block; }
  
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
  
  .group-selector {
    margin-left: 8px;
  }
  
  .group-btn {
    padding: 6px 12px;
    font-size: 0.85rem;
  }
  
  .status-indicator {
    font-size: 0.8rem;
  }
  
  .content-container {
    padding: 16px;
  }
  
  /* ✅ 小螢幕上調整圖表高度 */
  .chart-wrapper.chart-full { 
    height: 350px;
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
  
  /* ✅ 更小螢幕上進一步調整 */
  .chart-wrapper.chart-full { 
    height: 300px;
  }
}
</style>