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

          <div class="group-selector desktop-only" v-if="portfolioStore.availableGroups.length > 1">
            <span class="selector-label">群組:</span>
            <div class="select-wrapper">
              <select :value="portfolioStore.currentGroup" @change="e => portfolioStore.setGroup(e.target.value)">
                <option value="all">全部</option>
                <option v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" :value="g">
                  {{ g }}
                </option>
              </select>
              <button class="btn-edit-group" @click="showGroupModal=true" title="管理群組">✎</button>
            </div>
          </div>
        </div>

        <div class="nav-status">
          <div v-if="portfolioStore.loading" class="status-indicator loading" title="更新中...">
            <span class="dot"></span> <span class="desktop-only">更新中...</span>
          </div>
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling" title="計算中...">
            <span class="dot pulse-orange"></span> <span class="desktop-only">計算中...</span>
          </div>
          <div v-else class="status-indicator ready" title="連線正常">
            <span class="dot"></span> <span class="desktop-only">連線正常</span>
          </div>
          
          <button 
            v-if="isMobileView && portfolioStore.availableGroups.length > 1"
            class="mobile-group-btn" 
            @click="showGroupSwitchModal = true"
            title="切換群組"
          >
            📂
          </button>

          <button 
            class="action-trigger-btn" 
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
            :title="portfolioStore.isPolling ? '計算中...' : '更新數據'"
          >
            <span>⚙️</span>
            <span class="desktop-only">更新</span>
          </button>
          
          <button class="theme-toggle" @click="toggleTheme">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>
          
          <div class="user-profile" @click="handleLogout" title="登出">
            <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="avatar-img" alt="User">
            <div v-else class="avatar">{{ userInitial }}</div>
          </div>
        </div>
      </header>
      
      <div v-if="showGroupModal" class="modal-overlay" @click.self="showGroupModal=false">
        <div class="modal-card">
          <h3>管理策略群組</h3>
          <p class="modal-desc">修改群組名稱將會批次更新所有相關的交易紀錄。</p>
          <div class="group-list">
            <div v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" class="group-item">
              <input type="text" v-model="groupRenameMap[g]" :placeholder="g">
              <button @click="renameGroup(g)" class="btn-sm" :disabled="!groupRenameMap[g] || groupRenameMap[g]===g">更名</button>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="showGroupModal=false">關閉</button>
          </div>
        </div>
      </div>

      <div v-if="showGroupSwitchModal" class="modal-overlay" @click.self="showGroupSwitchModal=false">
        <div class="modal-card mobile-modal">
          <h3>切換策略群組</h3>
          <div class="group-switch-list">
            <button 
              v-for="g in portfolioStore.availableGroups" 
              :key="g" 
              class="group-switch-item"
              :class="{ active: portfolioStore.currentGroup === g }"
              @click="handleGroupSwitch(g)"
            >
              <span>{{ g === 'all' ? '全部 (All Portfolios)' : g }}</span>
              <span v-if="portfolioStore.currentGroup === g" class="check-icon">✓</span>
            </button>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showGroupModal=true; showGroupSwitchModal=false">管理名稱</button>
            <button @click="showGroupSwitchModal=false">取消</button>
          </div>
        </div>
      </div>

      <div class="content-container">
        <main class="main-column">
          <section class="section-stats">
            <StatsGrid v-if="!portfolioStore.loading" />
            <StatsGridSkeleton v-else />
          </section>
          
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
          
          <section class="section-dividends" v-if="!portfolioStore.loading && hasPendingDividends">
            <DividendManager />
          </section>
        </main>
        
        <aside class="side-column" :class="{ 'mobile-sheet': isMobileView, 'sheet-open': showMobileTrade }">
          <div class="mobile-sheet-header" v-if="isMobileView">
            <h3>交易管理</h3>
            <button class="btn-close-sheet" @click="showMobileTrade = false">✕</button>
          </div>

          <div class="sticky-panel">
            <TradeForm ref="tradeFormRef" @submitted="onTradeSubmitted" />
            
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

        <div 
            v-if="isMobileView && showMobileTrade" 
            class="sheet-backdrop" 
            @click="showMobileTrade = false"
        ></div>
      </div>

      <button 
        v-if="isMobileView" 
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
import { ref, onMounted, onUnmounted, computed, nextTick, reactive } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useToast } from './composables/useToast';
import { useDarkMode } from './composables/useDarkMode';
import { usePWA } from './composables/usePWA';
import { CONFIG } from './config';

import LoginOverlay from './components/LoginOverlay.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import DividendManager from './components/DividendManager.vue';

import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { toasts, removeToast, addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();
const { needRefresh, updateServiceWorker } = usePWA();

// 手機版相關狀態
const isMobileView = ref(false);
const showMobileTrade = ref(false);

// 群組管理
const showGroupModal = ref(false);
const showGroupSwitchModal = ref(false); // ✨ 新增
const groupRenameMap = reactive({});

const updateMedia = () => {
  isMobileView.value = window.innerWidth < 1024;
  if (!isMobileView.value) {
    showMobileTrade.value = false; // 桌面版重置狀態
  }
};

const hasPendingDividends = computed(() => portfolioStore.pending_dividends?.length > 0);
const pendingDividendsCount = computed(() => portfolioStore.pending_dividends ? portfolioStore.pending_dividends.length : 0);

const userInitial = computed(() => authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U');

// 方法
const scrollToDividends = () => {
  showMobileTrade.value = false;
  nextTick(() => {
    const dividendSection = document.querySelector('.section-dividends');
    if (dividendSection) {
      dividendSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
};

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

// ✨ 新增：處理群組切換
const handleGroupSwitch = (group) => {
  portfolioStore.setGroup(group);
  showGroupSwitchModal.value = false;
};

const renameGroup = async (oldName) => {
  const newName = groupRenameMap[oldName];
  if(!newName || !confirm(`確定將 "${oldName}" 更名為 "${newName}" 嗎？`)) return;
  
  addToast('正在批次更新紀錄...', 'info');
  try {
    const targetRecords = portfolioStore.records.filter(r => {
      const tags = (r.tag || '').split(/[,;]/).map(t=>t.trim());
      return tags.includes(oldName);
    });
    
    let count = 0;
    for(const r of targetRecords) {
      let tags = (r.tag || '').split(/[,;]/).map(t=>t.trim());
      tags = tags.map(t => t === oldName ? newName : t);
      await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...r, tag: tags.join(', ') })
      });
      count++;
    }
    addToast(`成功更新 ${count} 筆紀錄`, 'success');
    await portfolioStore.fetchRecords();
    await portfolioStore.triggerUpdate();
    showGroupModal.value = false;
  } catch(e) {
    addToast('更新失敗', 'error');
  }
};

const handleTriggerUpdate = async () => {
  if (portfolioStore.isPolling) {
    addToast("⌛ 背景監控更新中...", "info");
    return;
  }
  if (!confirm("確定要觸發後端計算嗎？")) return;
  try {
    addToast("🚀 正在請求 GitHub Actions...", "info");
    await portfolioStore.triggerUpdate();
    addToast("✅ 已觸發！系統將自動刷新。", "success");
  } catch (error) {
    addToast(`❌ 觸發失敗: ${error.message}`, "error");
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
        document.querySelector('.side-column')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
};

const handleLogout = () => {
  if (confirm("確定要登出系統嗎？")) authStore.logout();
};

onMounted(async () => {
  updateMedia();
  window.addEventListener('resize', updateMedia);
  
  const isLoggedIn = authStore.initAuth();
  if (isLoggedIn) {
    await portfolioStore.fetchAll();
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
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
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

/* ✨ 改善：手機版群組切換按鈕 */
.mobile-group-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  width: 36px; height: 36px;
  border-radius: 8px;
  align-items: center; justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex; /* 確保 icon 垂直置中 */
}

.nav-status { display: flex; align-items: center; gap: 12px; }
.status-indicator { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; font-weight: 500; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.status-indicator.polling { color: var(--warning); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.loading .dot { animation: pulse 1s infinite; }
.pulse-orange { animation: pulse 1s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.action-trigger-btn { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.action-trigger-btn:hover:not(:disabled) { background: var(--bg-card); border-color: var(--primary); color: var(--primary); }
.action-trigger-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.theme-toggle { background: transparent; border: none; padding: 6px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; transition: transform 0.2s; }
.theme-toggle:hover { transform: scale(1.1); background: var(--bg-secondary); }

.user-profile { width: 36px; height: 36px; cursor: pointer; flex-shrink: 0; }
.avatar, .avatar-img { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--primary); color: white; font-weight: 700; object-fit: cover; }

/* Layout Grid */
.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
.content-container { max-width: 1600px; margin: 0 auto; padding: 24px; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; width: 100%; align-items: start; }
.main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.side-column { min-width: 0; }

/* Cards & Charts */
.card, .chart-wrapper { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow-card); }
.chart-wrapper.chart-full { height: 450px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }

/* ✨ 改善：Desktop Sticky Panel (固定右側) */
.sticky-panel { 
  position: sticky; 
  top: calc(var(--header-height) + 24px); 
  display: flex; 
  flex-direction: column; 
  gap: 20px; 
  /* 關鍵修正：限制高度並允許滾動，避免視窗太小表單被切掉 */
  max-height: calc(100vh - 120px); 
  overflow-y: auto;
  scrollbar-width: thin; /* Firefox 變細 */
}

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

/* Mobile Sheet Content Adjustments */
/* 手機版 Sheet 內的 panel 不需要 sticky，改為靜態以允許自然滾動 */
.mobile-sheet .sticky-panel { 
    position: static; 
    padding: 20px; 
    max-height: none; /* 移除高度限制 */
}

/* Utilities */
.desktop-only { display: inline-block; }
.mobile-only { display: none; }
.btn-edit-group { background: transparent; border: none; color: var(--text-sub); cursor: pointer; font-size: 1rem; padding: 0 4px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; }
.modal-card { background: var(--bg-card); padding: 24px; border-radius: 16px; width: 90%; max-width: 400px; }
.modal-desc { font-size: 0.9rem; color: var(--text-sub); margin-bottom: 16px; }

/* Group Switch List (Mobile) */
.group-switch-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; max-height: 50vh; overflow-y: auto; }
.group-switch-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; background: var(--bg-secondary);
  border: 1px solid var(--border-color); border-radius: 8px;
  cursor: pointer; font-weight: 500; font-size: 1rem; color: var(--text-main);
  transition: all 0.2s;
}
.group-switch-item.active { background: rgba(59, 130, 246, 0.05); border-color: var(--primary); color: var(--primary); }
.check-icon { color: var(--primary); font-weight: bold; }

.group-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.group-item { display: flex; gap: 8px; }
.group-item input { flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-main); }
.btn-sm { padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-sm:disabled { opacity: 0.5; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; }
.btn-secondary { background: var(--bg-secondary); color: var(--text-sub); border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }

/* Dividend Alert */
.dividend-alert { border-left: 4px solid var(--warning); background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05)); }
.alert-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.alert-header h4 { margin: 0; font-size: 1rem; color: var(--text-main); }
.alert-text { margin: 0 0 12px 0; font-size: 0.9rem; color: var(--text-sub); }
.btn-alert { width: 100%; padding: 8px; background: var(--warning); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }

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
  .content-container { grid-template-columns: 1fr; padding: 16px; gap: 24px; }
  .desktop-only { display: none; }
  .mobile-only { display: inline-block; }
  
  .top-nav { padding: 0 16px; height: 56px; }
  .nav-status { gap: 8px; } /* 縮小按鈕間距 */
  .group-selector { max-width: 140px; }
  .select-wrapper select { max-width: 100%; }
  
  /* 更新按鈕在手機上縮小 */
  .action-trigger-btn { padding: 8px; border-radius: 50%; justify-content: center; width: 36px; height: 36px; }
  .action-trigger-btn span:first-child { margin: 0; font-size: 1.1rem; }
  
  .toast-container { bottom: 90px; right: 16px; left: 16px; }
  .toast { width: 100%; min-width: auto; }
}

@media (max-width: 480px) {
  .nav-brand h1 { font-size: 1.1rem; }
  .group-selector { display: none; } /* 原本的下拉選單隱藏 */
}
</style>
