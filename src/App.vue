<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />

    <div
      v-else
      class="main-wrapper"
      :class="{
        'cash-view': activeView === 'cash',
        'trade-rail-collapsed': isDesktopTradeRailCollapsed,
        'trade-mode-dock': tradeSurfaceMode === 'dock',
        'trade-mode-drawer': tradeSurfaceMode === 'drawer',
        'trade-mode-sheet': tradeSurfaceMode === 'sheet',
        'trade-overlay-open': isTransientTradeSurfaceOpen,
      }"
    >
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

          <button
            v-if="!isCompactView && activeView !== 'cash'"
            type="button"
            class="trade-rail-toggle"
            @click="toggleDesktopTradeSurface"
            :aria-expanded="isTradeSurfaceVisible"
            aria-controls="desktop-trade-rail"
            :title="tradeSurfaceToggleTitle"
          >
            <span aria-hidden="true">{{ tradeSurfaceMode === 'dock' ? (desktopTradeRailCollapsed ? '▤' : '◫') : (tradeOverlayOpen ? '▤' : '▥') }}</span>
            <span class="desktop-only">{{ tradeSurfaceToggleLabel }}</span>
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

      <div ref="contentContainerRef" class="content-container">
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

          <!-- 總覽 -->
          <OverviewPage
            v-if="activeView === 'overview'"
            @navigate="activeView = $event"
          />

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

          <!-- 現金管理：只管理 explicit cash events，不改變目前 NAV / 績效 -->
          <section v-else-if="activeView === 'cash'" class="section-cash">
            <CashManager />
          </section>

          <!-- 群組管理：抽成元件 -->
          <section v-else-if="activeView === 'groups'" class="section-groups">
            <GroupManager />
          </section>
        </main>

        <!-- Single TradeForm authority; presentation switches between dock/drawer/sheet. -->
        <aside
          v-if="activeView !== 'cash'"
          ref="tradeSurfaceRef"
          id="desktop-trade-rail"
          class="side-column"
          :class="[
            `trade-surface-${tradeSurfaceMode}`,
            { 'trade-surface-open': isTradeSurfaceVisible },
          ]"
          :aria-hidden="isTradeSurfaceVisible ? 'false' : 'true'"
          :inert="!isTradeSurfaceVisible"
          @keydown="handleTradeSurfaceKeydown"
        >
          <div class="trade-surface-header" v-if="tradeSurfaceMode !== 'dock'">
            <h3>交易管理</h3>
            <button
              type="button"
              class="btn-close-sheet"
              @click="closeTransientTradeSurface()"
              aria-label="關閉交易區"
            >✕</button>
          </div>

          <div class="fixed-panel">
            <TradeForm ref="tradeFormRef" @submitted="onTradeSubmitted" />
          </div>
        </aside>

        <div
          v-if="isTransientTradeSurfaceOpen"
          class="sheet-backdrop"
          @click="closeTransientTradeSurface()"
          aria-hidden="true"
        ></div>
      </div>

      <button
        v-if="isCompactView && activeView !== 'cash'"
        type="button"
        class="fab-btn"
        @click="openNewTrade"
        title="新增交易"
        aria-controls="desktop-trade-rail"
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
import { buildDividendAttention } from './services/dividendAttention.js';
import { isSnapshotVerificationCurrent } from './services/snapshotVerification.js';

import LoginOverlay from './components/LoginOverlay.vue';
import DataReliabilityBanner from './components/DataReliabilityBanner.vue';
import OverviewPage from './components/OverviewPage.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import DividendManager from './components/DividendManager.vue';
import CashManager from './components/CashManager.vue';
import GroupManager from './components/GroupManager.vue';

import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const contentContainerRef = ref(null);
const tradeSurfaceRef = ref(null);
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
  { key: 'cash', label: '現金', icon: '💵' },
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

// App-shell and transaction presentation authority.
// `isMobileView` remains the existing <=1024 single-column shell boundary.
// A separate compact boundary decides mobile sheet vs tablet/desktop drawer.
const DEFAULT_TRADE_DOCK_WORKSPACE_MIN = 1500;
const isMobileView = ref(false);
const isCompactView = ref(false);
const workspaceInlineSize = ref(0);
const tradeDockWorkspaceMin = ref(DEFAULT_TRADE_DOCK_WORKSPACE_MIN);
const tradeOverlayOpen = ref(false);
const desktopTradeRailCollapsed = ref(false);
let workspaceResizeObserver = null;
let tradeSurfaceReturnFocus = null;

const tradeSurfaceMode = computed(() => {
  if (isCompactView.value) return 'sheet';
  if (workspaceInlineSize.value >= tradeDockWorkspaceMin.value) return 'dock';
  return 'drawer';
});

const isTransientTradeSurfaceOpen = computed(() => (
  activeView.value !== 'cash'
  && tradeSurfaceMode.value !== 'dock'
  && tradeOverlayOpen.value
));

const isDesktopTradeRailCollapsed = computed(() => (
  tradeSurfaceMode.value === 'dock'
  && activeView.value !== 'cash'
  && desktopTradeRailCollapsed.value
));

const isTradeSurfaceVisible = computed(() => {
  if (activeView.value === 'cash') return false;
  if (tradeSurfaceMode.value === 'dock') return !desktopTradeRailCollapsed.value;
  return tradeOverlayOpen.value;
});

const tradeSurfaceToggleLabel = computed(() => {
  if (tradeSurfaceMode.value === 'dock') {
    return desktopTradeRailCollapsed.value ? '顯示交易區' : '專注檢視';
  }
  return tradeOverlayOpen.value ? '關閉交易區' : '開啟交易區';
});

const tradeSurfaceToggleTitle = computed(() => {
  if (tradeSurfaceMode.value === 'dock') {
    return desktopTradeRailCollapsed.value
      ? '顯示交易區'
      : '收起交易區並放大主內容';
  }
  return tradeOverlayOpen.value
    ? '關閉交易區並返回主內容'
    : '以抽屜開啟交易區';
});

const readCssPixelToken = (name, fallback) => {
  try {
    const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const measureWorkspace = () => {
  const el = contentContainerRef.value;
  if (!el) return;
  const width = el.getBoundingClientRect().width;
  if (Number.isFinite(width) && width > 0) workspaceInlineSize.value = width;
};

const observeWorkspace = (el) => {
  if (workspaceResizeObserver) {
    workspaceResizeObserver.disconnect();
    workspaceResizeObserver = null;
  }
  if (!el) return;

  measureWorkspace();
  if (window.ResizeObserver) {
    workspaceResizeObserver = new window.ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (Number.isFinite(width) && width > 0) workspaceInlineSize.value = width;
    });
    workspaceResizeObserver.observe(el);
  }
};

watch(contentContainerRef, observeWorkspace, { flush: 'post' });

const updateMedia = () => {
  isMobileView.value = window.innerWidth <= 1024;
  isCompactView.value = window.innerWidth < 600;
  measureWorkspace();
};

watch(tradeSurfaceMode, (mode, previousMode) => {
  // Presentation changes never reset TradeForm. Transient overlays remain open
  // across drawer↔sheet transitions, while dock transitions settle to a stable
  // visible/closed default without carrying stale overlay state.
  if (mode === 'dock') {
    tradeOverlayOpen.value = false;
    desktopTradeRailCollapsed.value = false;
    tradeSurfaceReturnFocus = null;
    return;
  }

  desktopTradeRailCollapsed.value = false;
  if (previousMode === 'dock') {
    tradeOverlayOpen.value = false;
    tradeSurfaceReturnFocus = null;
  }
});

watch(activeView, (view, previousView) => {
  if (view !== previousView && tradeOverlayOpen.value) {
    closeTransientTradeSurface({ restoreFocus: false });
  }
});

const dividendAttention = computed(() => buildDividendAttention({
  pendingDividends: portfolioStore.pending_dividends,
  records: portfolioStore.records,
}));
const hasPendingDividends = computed(() => dividendAttention.value.count > 0);
const pendingDividendsCount = computed(() => dividendAttention.value.count);

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

const rememberTradeSurfaceTrigger = () => {
  const active = document.activeElement;
  tradeSurfaceReturnFocus = active instanceof HTMLElement ? active : null;
};

const getTradeSurfaceFocusable = () => {
  const surface = tradeSurfaceRef.value;
  if (!surface) return [];
  return Array.from(surface.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true');
};

const focusTradeSurface = () => {
  const surface = tradeSurfaceRef.value;
  if (!surface || !isTradeSurfaceVisible.value) return;
  const preferred = surface.querySelector(
    'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not(.btn-close-sheet):not([disabled])',
  );
  const target = preferred || getTradeSurfaceFocusable()[0];
  if (target && typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }
};

const openTransientTradeSurface = ({ rememberFocus = true } = {}) => {
  if (tradeSurfaceMode.value === 'dock' || activeView.value === 'cash') return;
  if (rememberFocus && !tradeOverlayOpen.value) rememberTradeSurfaceTrigger();
  tradeOverlayOpen.value = true;
  nextTick(focusTradeSurface);
};

const closeTransientTradeSurface = ({ restoreFocus = true } = {}) => {
  if (!tradeOverlayOpen.value) return;
  const returnTarget = tradeSurfaceReturnFocus;
  tradeOverlayOpen.value = false;
  tradeSurfaceReturnFocus = null;

  if (restoreFocus && returnTarget && typeof returnTarget.focus === 'function') {
    nextTick(() => {
      if (returnTarget.isConnected) returnTarget.focus({ preventScroll: true });
    });
  }
};

const toggleDesktopTradeSurface = () => {
  if (tradeSurfaceMode.value === 'dock') {
    desktopTradeRailCollapsed.value = !desktopTradeRailCollapsed.value;
    return;
  }

  if (tradeOverlayOpen.value) {
    closeTransientTradeSurface();
  } else {
    openTransientTradeSurface();
  }
};

const openNewTrade = () => {
  rememberTradeSurfaceTrigger();
  if (tradeFormRef.value?.resetForm) tradeFormRef.value.resetForm();
  openTransientTradeSurface({ rememberFocus: false });
};

const onTradeSubmitted = () => {
  if (tradeSurfaceMode.value !== 'dock') {
    closeTransientTradeSurface();
  }
};

const handleTradeSurfaceKeydown = (event) => {
  if (event.key !== 'Tab' || !isTransientTradeSurfaceOpen.value) return;

  const focusable = getTradeSurfaceFocusable();
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

const handleGlobalKeydown = (event) => {
  if (event.key !== 'Escape' || !isTransientTradeSurfaceOpen.value) return;
  event.preventDefault();
  closeTransientTradeSurface();
};

watch(isTransientTradeSurfaceOpen, (open) => {
  document.body.classList.toggle('trade-surface-scroll-lock', open);
});

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
  if (tradeSurfaceMode.value === 'dock') {
    desktopTradeRailCollapsed.value = false;
  } else {
    if (!tradeOverlayOpen.value) rememberTradeSurfaceTrigger();
    tradeOverlayOpen.value = true;
  }

  nextTick(() => {
    if (tradeFormRef.value) {
      tradeFormRef.value.setupForm(record);

      const tradeFormEl = tradeSurfaceRef.value?.querySelector('.fixed-panel');
      if (tradeFormEl) tradeFormEl.scrollTop = 0;
      focusTradeSurface();
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

  tradeDockWorkspaceMin.value = readCssPixelToken(
    '--ui-trade-dock-workspace-min',
    DEFAULT_TRADE_DOCK_WORKSPACE_MIN,
  );
  updateMedia();
  window.addEventListener('resize', updateMedia);
  window.addEventListener('popstate', syncFromUrl);
  window.addEventListener('keydown', handleGlobalKeydown);
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
  measureWorkspace();
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
  window.removeEventListener('keydown', handleGlobalKeydown);
  if (workspaceResizeObserver) {
    workspaceResizeObserver.disconnect();
    workspaceResizeObserver = null;
  }
  document.body.classList.remove('trade-surface-scroll-lock');
  authStore.stopStorageSync();
});
</script>
<style>
:root {
  --layout-max: 1920px;
  --header-height: 64px;
  --space-desktop: 20px;
}

/* Header Optimization */
.top-nav { background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 0 24px; height: var(--header-height); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; transition: background 0.3s; }
.nav-left { display: flex; align-items: center; gap: 16px; }
.nav-brand { display: flex; align-items: center; gap: 8px; }
.nav-brand h1 { font-size: var(--type-page); font-weight: 700; margin: 0; letter-spacing: -0.02em; }
.badge { background: var(--text-main); color: var(--bg-card); font-size: var(--type-caption); padding: 2px 6px; border-radius: 99px; margin-left: 4px; vertical-align: middle; }
.logo-icon { font-size: var(--icon-xl); }

.group-selector { display: flex; align-items: center; gap: 8px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 8px; border: 1px solid var(--border-color); }
.selector-label { font-size: var(--type-control); font-weight: 600; color: var(--text-sub); }
.select-wrapper { display: flex; align-items: center; gap: 4px; }
.select-wrapper select { background: transparent; border: none; font-size: var(--type-control); color: var(--text-main); font-weight: 600; outline: none; max-width: 120px; }

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
  font-size: var(--type-body);
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
  font-size: var(--icon-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}

.refresh-icon:hover {
  transform: scale(1.1);
}

.refresh-icon:focus-visible,
.user-profile:focus-visible,
.trade-rail-toggle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.refresh-timer {
  font-family: 'JetBrains Mono', monospace;
  font-size: var(--type-body);
  min-width: 40px;
  text-align: right;
}

.status-indicator { display: flex; align-items: center; gap: 6px; font-size: var(--type-label); font-weight: 500; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.status-indicator.polling,
.status-indicator.stale { color: var(--warning); }
.status-indicator.error { color: var(--danger); }
.status-indicator.unknown { color: var(--text-sub); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.loading .dot, .polling .dot { animation: pulse 1s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.action-trigger-btn,
.trade-rail-toggle { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 8px; font-weight: 600; font-size: var(--type-body); cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.action-trigger-btn:hover:not(:disabled),
.trade-rail-toggle:hover { background: var(--bg-card); border-color: var(--primary); color: var(--primary); }
.action-trigger-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.theme-toggle { background: transparent; border: none; padding: 6px; border-radius: 50%; cursor: pointer; font-size: var(--icon-lg); transition: transform 0.2s; }
.theme-toggle:hover { transform: scale(1.1); background: var(--bg-secondary); }

.user-profile { appearance: none; width: 36px; height: 36px; padding: 0; border: 0; background: transparent; cursor: pointer; flex-shrink: 0; }
.avatar, .avatar-img { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--primary); color: white; font-weight: 700; object-fit: cover; }

/* Layout Grid */
.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; overflow-x: clip; }
.content-container { max-width: var(--layout-max); margin: 0 auto; padding: var(--space-desktop) 24px 24px; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; width: 100%; align-items: start; overflow-x: clip; }
.main-wrapper.cash-view .content-container { grid-template-columns: minmax(0, 1fr); }
.main-column { display: flex; flex-direction: column; gap: var(--space-desktop); min-width: 0; overflow-x: hidden; }
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
  font-size: var(--type-body);
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
  font-size: var(--type-caption);
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

/* Docked TradeForm remains sticky; drawer/sheet overrides live in adaptive-workspace.css. */
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
  font-size: var(--icon-empty); font-weight: 300; cursor: pointer;
  z-index: 100; transition: transform 0.2s, box-shadow 0.2s;
}
.fab-btn:active { transform: scale(0.95); }
.fab-btn span { margin-top: -4px; }

/* Utilities */
.desktop-only { display: inline-block; }
.mobile-only { display: none; }
.btn-edit-group { background: transparent; border: none; color: var(--text-sub); cursor: pointer; font-size: var(--type-control); padding: 0 4px; }
.modal-desc { font-size: var(--type-body); color: var(--text-sub); margin-bottom: 16px; }
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
.toast-msg { font-size: var(--type-emphasis); font-weight: 500; }
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
  .action-trigger-btn span:first-child { margin: 0; font-size: var(--icon-md); }

  .toast-container { bottom: 90px; right: 16px; left: 16px; }
  .toast { width: 100%; min-width: auto; }
}

@media (max-width: 480px) {
  .nav-brand h1 { font-size: var(--type-section); }
  .group-selector { display: none; }
}
</style>
