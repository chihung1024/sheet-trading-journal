<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />

    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-left">
          <div class="nav-brand">
            <span class="logo-icon">📊</span>
            <h1 class="desktop-only">Trading Journal <span class="badge">PRO</span></h1>
            <h1 class="mobile-only">Journal</h1>
          </div>

          <div class="group-selector" v-if="portfolioStore.availableGroups.length > 1">
            <span class="selector-label desktop-only">群組:</span>
            <div class="select-wrapper">
              <select :value="portfolioStore.currentGroup" @change="e => portfolioStore.setGroup(e.target.value)">
                <option value="all">全部</option>
                <option v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" :value="g">
                  {{ g }}
                </option>
              </select>
              <button type="button" class="btn-edit-group" @click="activeView = 'groups'" title="管理群組">✎</button>
            </div>
          </div>
        </div>

        <div class="nav-status">
          <!-- ✨ 盤中自動刷新指示器 -->
          <div v-if="marketRefresh.isMarketHours() && !portfolioStore.loading && !portfolioStore.isPolling"
               class="auto-refresh-indicator"
               :class="{ paused: marketRefresh.isPaused.value }"
               :title="marketRefresh.isPaused.value ? '已暫停自動更新' : `下次自動更新: ${marketRefresh.formattedTimeRemaining()}`">
            <span class="market-badge">{{ marketRefresh.currentMarket.value === 'TW' ? '🇹🇼' : '🇺🇸' }}</span>
            <button
              type="button"
              class="refresh-icon"
              @click="marketRefresh.togglePause()"
              :aria-label="marketRefresh.isPaused.value ? '繼續盤中自動更新' : '暫停盤中自動更新'"
            >
              <span v-if="marketRefresh.isPaused.value">⏸️</span>
              <span v-else>🔄</span>
            </button>
            <span class="refresh-timer desktop-only" v-if="!marketRefresh.isPaused.value">
              {{ marketRefresh.formattedTimeRemaining() }}
            </span>
          </div>

          <div
            class="status-indicator"
            :class="statusPresentation.className"
            :title="statusPresentation.title"
            :aria-label="statusPresentation.label"
            role="status"
            aria-live="polite"
          >
            <span class="dot"></span>
            <span class="desktop-only">{{ statusPresentation.label }}</span>
          </div>

          <button
            type="button"
            class="action-trigger-btn"
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
            :title="portfolioStore.isPolling ? '資料更新中' : '立即更新資料'"
            :aria-label="portfolioStore.isPolling ? '資料更新中' : '立即更新資料'"
          >
            <span>🔄</span>
            <span class="desktop-only">立即更新</span>
          </button>

          <button type="button" class="theme-toggle" @click="toggleTheme" aria-label="切換明暗主題">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>

          <button type="button" class="user-profile" @click="handleLogout" title="登出" aria-label="登出">
            <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="avatar-img" alt="User">
            <div v-else class="avatar">{{ userInitial }}</div>
          </button>
        </div>
      </header>

      <DataReliabilityBanner />

      <div class="content-container">
        <!-- Middle: 主內容（依選單切換） -->
        <main class="main-column">
          <!-- Desktop + Mobile: 功能切換（頂端 tabs） -->
          <div class="mobile-tabs" aria-label="功能切換">
            <button
              v-for="v in views"
              :key="v.key"
              class="tab-item"
              :class="{ active: activeView === v.key }"
              @click="activeView = v.key"
              type="button"
            >
              <span class="tab-label">{{ v.label }}</span>
              <span
                v-if="v.key === 'dividends' && hasPendingDividends"
                class="tab-badge"
              >
                {{ pendingDividendsCount }}
              </span>
            </button>
          </div>

          <!-- 總覽：Stats + 圖表 -->
          <section v-if="activeView === 'overview'" class="section-overview">
            <div class="section-stats">
              <StatsGrid v-if="!portfolioStore.loading" />
              <StatsGridSkeleton v-else />
            </div>

            <div class="section-charts">
              <div class="chart-wrapper chart-full">
                <PerformanceChart v-if="!portfolioStore.loading" />
                <ChartSkeleton v-else />
              </div>
            </div>
          </section>

          <!-- 圖表 -->
          <section v-else-if="activeView === 'charts'" class="section-charts">
            <div class="chart-wrapper chart-full">
              <PerformanceChart v-if="!portfolioStore.loading" />
              <ChartSkeleton v-else />
            </div>
          </section>

          <!-- 持倉明細 -->
          <section v-else-if="activeView === 'holdings'" class="section-holdings">
            <HoldingsTable v-if="!portfolioStore.loading" />
            <TableSkeleton v-else />
          </section>

          <!-- 交易紀錄 -->
          <section v-else-if="activeView === 'records'" class="section-records">
            <RecordList v-if="!portfolioStore.loading" @edit="handleEditRecord" />
            <TableSkeleton v-else />
          </section>

          <!-- 配息紀錄：永遠可看 -->
          <section v-else-if="activeView === 'dividends'" class="section-dividends">
            <DividendManager v-if="!portfolioStore.loading" />
            <TableSkeleton v-else />
          </section>

          <!-- 群組管理：抽成元件 -->
          <section v-else-if="activeView === 'groups'" class="section-groups">
            <GroupManager />
          </section>
        </main>

        <!-- Right: 桌面 sticky 交易面板；手機維持 sheet overlay -->
        <aside class="side-column" :class="{ 'mobile-sheet': isMobileView, 'sheet-open': showMobileTrade }">
          <div class="mobile-sheet-header" v-if="isMobileView">
            <h3>交易管理</h3>
            <button type="button" class="btn-close-sheet" @click="showMobileTrade = false">✕</button>
          </div>

          <div class="fixed-panel">
            <TradeForm ref="tradeFormRef" @submitted="onTradeSubmitted" />
          </div>
        </aside>

        <div
          v-if="isMobileView && showMobileTrade"
          class="sheet-backdrop"
          @click="showMobileTrade = false"
        ></div>
      </div>

      <button
        v-if="isMobileView"
        type="button"
        class="fab-btn"
        @click="openMobileTrade"
        title="新增交易"
      >
        <span>+</span>
      </button>
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
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useToast } from './composables/useToast';
import { useDarkMode } from './composables/useDarkMode';
import { usePWA } from './composables/usePWA';
import { useMarketHoursRefresh } from './composables/useMarketHoursRefresh';
import { useTokenRefresh } from './composables/useTokenRefresh';
import { buildDataSyncPresentation } from './services/dataSyncPresentation.js';
import { isSnapshotVerificationCurrent } from './services/snapshotVerification.js';

import LoginOverlay from './components/LoginOverlay.vue';
import DataReliabilityBanner from './components/DataReliabilityBanner.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import DividendManager from './components/DividendManager.vue';
import GroupManager from './components/GroupManager.vue';

import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { toasts, removeToast, addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();
const { needRefresh, updateServiceWorker } = usePWA();

// 導覽 tabs
const views = [
  { key: 'overview', label: '總覽', icon: '🏠' },
  { key: 'charts', label: '圖表', icon: '📈' },
  { key: 'holdings', label: '持倉明細', icon: '💼' },
  { key: 'records', label: '交易紀錄', icon: '🧾' },
  { key: 'dividends', label: '配息紀錄', icon: '💰' },
  { key: 'groups', label: '群組管理', icon: '🏷️' },
];

const isValidView = (v) => !!views.find(x => x.key === v);

// URL 同步 + localStorage 記憶
const ACTIVE_VIEW_STORAGE_KEY = 'sheet_trading_journal.activeView';
const activeView = ref('overview');
let didInitView = false;

const getViewFromUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('view');
  } catch {
    return null;
  }
};

const setUrlView = (v, { replace = false } = {}) => {
  try {
    const url = new URL(window.location.href);
    if (!v || v === 'overview') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', v);
    }

    const next = url.pathname + url.search + url.hash;
    if (replace) {
      window.history.replaceState(null, '', next);
    } else {
      window.history.pushState(null, '', next);
    }
  } catch {
    // ignore
  }
};

const persistView = (v) => {
  try {
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, v);
  } catch {
    // ignore
  }
};

const resolveInitialView = () => {
  const v = getViewFromUrl();
  if (isValidView(v)) return v;

  try {
    const stored = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
    if (isValidView(stored)) return stored;
  } catch {
    // ignore
  }

  return 'overview';
};

const syncFromUrl = () => {
  const v = getViewFromUrl();
  if (isValidView(v) && v !== activeView.value) {
    activeView.value = v;
  }
};

watch(activeView, (v) => {
  if (!isValidView(v)) return;
  persistView(v);
  if (didInitView) setUrlView(v);
});

// 手機版相關狀態
const isMobileView = ref(false);
const showMobileTrade = ref(false);

const updateMedia = () => {
  isMobileView.value = window.innerWidth < 1024;
  if (!isMobileView.value) {
    showMobileTrade.value = false;
  }
};

const hasPendingDividends = computed(() => portfolioStore.pending_dividends?.length > 0);
const pendingDividendsCount = computed(() => portfolioStore.pending_dividends ? portfolioStore.pending_dividends.length : 0);

const userInitial = computed(() => authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U');
const snapshotVerified = computed(() => isSnapshotVerificationCurrent(
  portfolioStore.rawData,
  portfolioStore.records,
));

const statusPresentation = computed(() => buildDataSyncPresentation({
  loading: portfolioStore.loading,
  isPolling: portfolioStore.isPolling,
  connectionStatus: portfolioStore.connectionStatus,
  portfolioReadStatus: portfolioStore.portfolioReadStatus,
  snapshotFreshness: portfolioStore.snapshotFreshness,
  verified: snapshotVerified.value,
}));

// 📈 盤中自動刷新 - 台股/美股盤中每 3 分鐘觸發 triggerUpdate
const marketRefresh = useMarketHoursRefresh();

// 🔐 Token 自動刷新
useTokenRefresh();

const openMobileTrade = () => {
  showMobileTrade.value = true;
  if (tradeFormRef.value && tradeFormRef.value.resetForm) {
    tradeFormRef.value.resetForm();
  }
};

const onTradeSubmitted = () => {
  if (isMobileView.value) {
    showMobileTrade.value = false;
  }
};

const handleTriggerUpdate = async () => {
  if (portfolioStore.isPolling) {
    addToast('⌛ 資料正在更新，請稍候...', 'info');
    return;
  }
  try {
    await portfolioStore.triggerUpdate();
  } catch (error) {
    addToast(`❌ 資料更新失敗: ${error.message}`, 'error');
  }
};

const handleEditRecord = (record) => {
  if (isMobileView.value) {
    showMobileTrade.value = true;
  }

  nextTick(() => {
    if (tradeFormRef.value) {
      tradeFormRef.value.setupForm(record);

      if (!isMobileView.value) {
        const tradeFormEl = document.querySelector('.fixed-panel');
        if (tradeFormEl) {
          tradeFormEl.scrollTop = 0;
        }
      }
    }
  });
};

const handleLogout = () => {
  if (confirm("確定要登出系統嗎？")) authStore.logout();
};

onMounted(async () => {
  // 初始化 view（URL 優先，其次 localStorage）
  activeView.value = resolveInitialView();
  setUrlView(activeView.value, { replace: true });
  didInitView = true;

  updateMedia();
  window.addEventListener('resize', updateMedia);
  window.addEventListener('popstate', syncFromUrl);
  authStore.startStorageSync();

  const isLoggedIn = authStore.initAuth();
  if (isLoggedIn) {
    try {
      await portfolioStore.fetchAll();
    } catch (error) {
      console.error('已登入，但初始資料載入失敗:', error);
      addToast('已登入，但初始資料暫時載入失敗，系統將自動重試', 'error');
    }
  }

  await nextTick();
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) {
    setTimeout(() => {
      loadingEl.style.opacity = '0';
      setTimeout(() => loadingEl.remove(), 300);
    }, 500);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateMedia);
  window.removeEventListener('popstate', syncFromUrl);
  authStore.stopStorageSync();
});
</script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --layout-max: 1920px;
  --bg-app: #f8fafc;
  --bg-card: #ffffff;
  --bg-secondary: #f1f5f9;
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --text-main: #0f172a;
  --text-sub: #64748b;
  --border-color: #e2e8f0;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --radius: 16px;
  --radius-sm: 8px;
  --header-height: 64px;
  --space-desktop: 20px;
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
}

* { box-sizing: border-box; }
html, body { overflow-x: hidden; }
body { background-color: var(--bg-app); color: var(--text-main); font-family: 'Inter', sans-serif; margin: 0; font-size: 16px; line-height: 1.5; -webkit-tap-highlight-color: transparent; }

/* Header Optimization */
.top-nav { background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 0 24px; height: var(--header-height); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; transition: background 0.3s; }
.nav-left { display: flex; align-items: center; gap: 16px; }
.nav-brand { display: flex; align-items: center; gap: 8px; }
.nav-brand h1 { font-size: 1.25rem; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
.badge { background: var(--text-main); color: var(--bg-card); font-size: 0.7rem; padding: 2px 6px; border-radius: 99px; margin-left: 4px; vertical-align: middle; }
.logo-icon { font-size: 1.4rem; }

.group-selector { display: flex; align-items: center; gap: 8px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 8px; border: 1px solid var(--border-color); }
.selector-label { font-size: 0.8rem; font-weight: 600; color: var(--text-sub); }
.select-wrapper { display: flex; align-items: center; gap: 4px; }
.select-wrapper select { background: transparent; border: none; font-size: 0.9rem; color: var(--text-main); font-weight: 600; outline: none; max-width: 120px; }

.nav-status { display: flex; align-items: center; gap: 12px; }

/* ✨ 自動刷新指示器 */
.auto-refresh-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--primary);
  transition: all 0.2s;
}

.auto-refresh-indicator.paused {
  color: var(--text-sub);
  opacity: 0.7;
}

.refresh-icon {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}

.refresh-icon:hover {
  transform: scale(1.1);
}

.refresh-icon:focus-visible,
.user-profile:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.refresh-timer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  min-width: 40px;
  text-align: right;
}

.status-indicator { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; font-weight: 500; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.status-indicator.polling,
.status-indicator.stale { color: var(--warning); }
.status-indicator.error { color: var(--danger); }
.status-indicator.unknown { color: var(--text-sub); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.loading .dot, .polling .dot { animation: pulse 1s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.action-trigger-btn { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.action-trigger-btn:hover:not(:disabled) { background: var(--bg-card); border-color: var(--primary); color: var(--primary); }
.action-trigger-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.theme-toggle { background: transparent; border: none; padding: 6px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; transition: transform 0.2s; }
.theme-toggle:hover { transform: scale(1.1); background: var(--bg-secondary); }

.user-profile { appearance: none; width: 36px; height: 36px; padding: 0; border: 0; background: transparent; cursor: pointer; flex-shrink: 0; }
.avatar, .avatar-img { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--primary); color: white; font-weight: 700; object-fit: cover; }

/* Layout Grid */
.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; overflow-x: clip; }
.content-container { max-width: var(--layout-max); margin: 0 auto; padding: var(--space-desktop) 24px 24px; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; width: 100%; align-items: start; overflow-x: clip; }
.main-column { display: flex; flex-direction: column; gap: var(--space-desktop); min-width: 0; overflow-x: hidden; }
.section-overview { display: flex; flex-direction: column; gap: var(--space-desktop); }
.side-column { min-width: 0; }

/* Tabs (Desktop + Mobile) */
.mobile-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
  scrollbar-width: none;
}
.mobile-tabs::-webkit-scrollbar { display: none; }

.tab-item {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.tab-item.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--warning);
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  line-height: 1;
}

/* Main sections: allow horizontal content without showing bars */
.section-holdings,
.section-records,
.section-dividends {
  overflow-x: auto;
  scrollbar-width: none;
}
.section-holdings::-webkit-scrollbar,
.section-records::-webkit-scrollbar,
.section-dividends::-webkit-scrollbar {
  display: none;
}

/* Cards & Charts */
.card, .chart-wrapper { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow-card); overflow-x: hidden; }
.chart-wrapper.chart-full { height: 450px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }

/* Desktop sticky transaction rail */
.fixed-panel {
  position: sticky;
  top: calc(var(--header-height) + var(--space-desktop));
  width: 100%;
  max-height: calc(100vh - var(--header-height) - 48px);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 20px;
  z-index: 10;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.fixed-panel::-webkit-scrollbar { width: 6px; }
.fixed-panel::-webkit-scrollbar-track { background: transparent; }
.fixed-panel::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
.fixed-panel::-webkit-scrollbar-thumb:hover { background: var(--text-sub); }

/* FAB Button */
.fab-btn {
  position: fixed; bottom: 24px; right: 24px;
  width: 56px; height: 56px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white; border-radius: 50%;
  border: none; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; font-weight: 300; cursor: pointer;
  z-index: 100; transition: transform 0.2s, box-shadow 0.2s;
}
.fab-btn:active { transform: scale(0.95); }
.fab-btn span { margin-top: -4px; }

/* Mobile Sheet (Sidebar) */
.mobile-sheet {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: 100%; max-width: 400px;
  background: var(--bg-app);
  z-index: 150;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  overflow-y: auto;
  box-shadow: -4px 0 20px rgba(0,0,0,0.1);
}
.mobile-sheet.sheet-open { transform: translateX(0); }
.sheet-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 140; backdrop-filter: blur(2px); }

.mobile-sheet-header {
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  display: flex; justify-content: space-between; align-items: center;
  position: sticky; top: 0; z-index: 10;
}
.mobile-sheet-header h3 { margin: 0; font-size: 1.1rem; }
.btn-close-sheet { background: none; border: none; font-size: 1.5rem; color: var(--text-sub); cursor: pointer; padding: 4px; }

.mobile-sheet .fixed-panel { position: static; padding: 20px; max-height: none; width: 100%; right: auto; }

/* Utilities */
.desktop-only { display: inline-block; }
.mobile-only { display: none; }
.btn-edit-group { background: transparent; border: none; color: var(--text-sub); cursor: pointer; font-size: 1rem; padding: 0 4px; }
.modal-desc { font-size: 0.9rem; color: var(--text-sub); margin-bottom: 16px; }
.group-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.group-item { display: flex; gap: 8px; }
.group-item input { flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-main); }
.btn-sm { padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-sm:disabled { opacity: 0.5; }
.modal-footer { display: flex; justify-content: flex-end; }

/* Toast */
.toast-container { position: fixed; bottom: 32px; right: 32px; z-index: 9999; display: flex; flex-direction: column; gap: 12px; pointer-events: none; }
.toast { pointer-events: auto; background: var(--bg-card); border: 1px solid var(--border-color); padding: 12px 16px; border-radius: 12px; box-shadow: var(--shadow-lg); display: flex; gap: 12px; min-width: 280px; align-items: center; }
.toast-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
.toast.success .toast-icon { background: #dcfce7; color: #166534; }
.toast.error .toast-icon { background: #fee2e2; color: #991b1b; }
.toast-msg { font-size: 0.95rem; font-weight: 500; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s ease; }
.toast-slide-enter-from, .toast-slide-leave-to { transform: translateX(100%); opacity: 0; }

/* RWD Queries */
@media (max-width: 1024px) {
  .content-container { grid-template-columns: 1fr; padding: 16px; gap: 16px; }
  .desktop-only { display: none; }
  .mobile-only { display: inline-block; }

  .top-nav { padding: 0 16px; height: 56px; }
  .nav-status { gap: 8px; }
  .group-selector { max-width: 140px; }
  .select-wrapper select { max-width: 100%; }

  .auto-refresh-indicator { padding: 6px 8px; }
  .refresh-timer { display: none; }

  .action-trigger-btn { padding: 8px; border-radius: 50%; justify-content: center; width: 36px; height: 36px; }
  .action-trigger-btn span:first-child { margin: 0; font-size: 1.1rem; }

  .toast-container { bottom: 90px; right: 16px; left: 16px; }
  .toast { width: 100%; min-width: auto; }
}

@media (max-width: 480px) {
  .nav-brand h1 { font-size: 1.1rem; }
  .group-selector { display: none; }
}
</style>