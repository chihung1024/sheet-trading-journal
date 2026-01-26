<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark, 'sidebar-open': showMobileSidebar }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
          <span class="logo-icon">📊</span>
          <h1>Trading Journal <span class="badge">PRO</span></h1>
        </div>

        <div class="group-selector desktop-only" v-if="portfolioStore.availableGroups.length > 1">
          <span class="selector-label">策略群組:</span>
          <div class="select-wrapper">
            <select :value="portfolioStore.currentGroup" @change="e => portfolioStore.setGroup(e.target.value)">
              <option value="all">全部 (All Portfolios)</option>
              <option v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" :value="g">
                {{ g }}
              </option>
            </select>
            <button class="btn-edit-group" @click="showGroupModal=true" title="管理群組名稱">
              ✎
            </button>
          </div>
        </div>

        <div class="nav-status">
          <button class="icon-btn mobile-only" v-if="portfolioStore.availableGroups.length > 1" @click="showGroupSelectorMobile=true">
            📂
          </button>

          <div v-if="portfolioStore.loading" class="status-indicator loading">
            <span class="dot"></span> <span class="desktop-only">更新中...</span>
          </div>
          
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling">
            <span class="dot pulse-orange"></span> <span class="desktop-only">計算中...</span>
          </div>
          
          <div v-else class="status-indicator ready desktop-only">
            <span class="dot"></span> 連線正常
          </div>
          
          <button 
            class="action-trigger-btn" 
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
            :title="portfolioStore.isPolling ? '系統正在背景計算中...' : '手動觸發投資組合數據更新'"
          >
            <span>⚙️</span>
            <span class="desktop-only">更新數據</span>
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
      
      <div v-if="showGroupModal" class="modal-overlay" @click.self="showGroupModal=false">
        <div class="modal-card">
          <h3>管理策略群組</h3>
          <p class="modal-desc">修改群組名稱將會批次更新所有相關的交易紀錄。</p>
          
          <div class="group-list">
            <div v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" class="group-item">
              <input type="text" v-model="groupRenameMap[g]" :placeholder="g">
              <button @click="renameGroup(g)" class="btn-sm" :disabled="!groupRenameMap[g] || groupRenameMap[g]===g">
                更名
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="showGroupModal=false">關閉</button>
          </div>
        </div>
      </div>

      <div v-if="showGroupSelectorMobile" class="modal-overlay" @click.self="showGroupSelectorMobile=false">
        <div class="modal-card mobile-selector-card">
           <h3>選擇策略群組</h3>
           <div class="mobile-options">
              <button 
                class="mobile-option-btn" 
                :class="{ active: portfolioStore.currentGroup === 'all' }"
                @click="portfolioStore.setGroup('all'); showGroupSelectorMobile=false"
              >
                全部 (All)
              </button>
              <button 
                v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" 
                :key="g" 
                class="mobile-option-btn"
                :class="{ active: portfolioStore.currentGroup === g }"
                @click="portfolioStore.setGroup(g); showGroupSelectorMobile=false"
              >
                {{ g }}
              </button>
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
        
        <div class="sidebar-backdrop" v-if="showMobileSidebar" @click="showMobileSidebar=false"></div>

        <aside class="side-column" :class="{ 'mobile-visible': showMobileSidebar }">
          <div class="mobile-sidebar-header mobile-only">
             <h3>交易操作</h3>
             <button class="close-btn" @click="showMobileSidebar=false">✕</button>
          </div>

          <div class="sticky-panel">
            <TradeForm ref="tradeFormRef" />
            
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

        <button class="btn-mobile-trade mobile-only" @click="showMobileSidebar=true">
           <span>+</span>
        </button>
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
import { ref, onMounted, computed, nextTick, reactive } from 'vue';
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

// PWA 監控
const { needRefresh, updateServiceWorker } = usePWA();

// UI 狀態
const showGroupModal = ref(false);
const showGroupSelectorMobile = ref(false);
const showMobileSidebar = ref(false);
const groupRenameMap = reactive({});

const hasPendingDividends = computed(() => {
  return portfolioStore.pending_dividends && portfolioStore.pending_dividends.length > 0;
});

const pendingDividendsCount = computed(() => {
  return portfolioStore.pending_dividends ? portfolioStore.pending_dividends.length : 0;
});

const scrollToDividends = () => {
  const dividendSection = document.querySelector('.section-dividends');
  if (dividendSection) {
    dividendSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showMobileSidebar.value = false; // 手機版點擊後關閉側邊欄
  }
};

const renameGroup = async (oldName) => {
  const newName = groupRenameMap[oldName];
  if(!newName || !confirm(`確定將 "${oldName}" 更名為 "${newName}" 嗎？這將更新所有相關紀錄。`)) return;
  
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
      const newTagStr = tags.join(', ');
      
      await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        method: 'PUT',
        headers: { 
            'Authorization': `Bearer ${authStore.token}`, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ ...r, tag: newTagStr })
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
    addToast("⌛ 系統已在背景監控更新中，請稍候...", "info");
    return;
  }

  if (!confirm("確定要觸發後端計算嗎？")) return;
  
  try {
    addToast("🚀 正在請求 GitHub Actions...", "info");
    await portfolioStore.triggerUpdate();
    addToast("✅ 已觸發！系統將在背景監控，更新完成後自動刷新。", "success");
  } catch (error) {
    addToast(`❌ 觸發失敗: ${error.message}`, "error");
  }
};

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    // 手機版自動開啟側邊欄
    if (window.innerWidth < 1024) {
      showMobileSidebar.value = true;
    } else {
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
  const isLoggedIn = authStore.initAuth();
  
  if (isLoggedIn) {
    console.log('🔐 已登入，執行初始化 fetchAll...');
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
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4);
}

* { box-sizing: border-box; }
body { background-color: var(--bg-app); color: var(--text-main); font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased; transition: background-color 0.3s ease, color 0.3s ease; }

.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; position: relative; }
.top-nav { background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 0 32px; height: var(--header-height); display: flex; align-items: center; justify-content: space-between; z-index: 50; box-shadow: var(--shadow-sm); position: sticky; top: 0; }
.nav-brand { display: flex; align-items: center; gap: 12px; }
.nav-brand h1 { font-size: 1.45rem; font-weight: 700; margin: 0; color: var(--text-main); letter-spacing: -0.01em; }
.badge { background: var(--text-main); color: var(--bg-card); font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
.logo-icon { font-size: 1.5rem; }

/* Group Selector */
.group-selector { display: flex; align-items: center; gap: 8px; margin: 0 20px; background: var(--bg-secondary); padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); }
.selector-label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; }
.select-wrapper { display: flex; gap: 8px; }
.select-wrapper select { background: transparent; border: none; font-size: 0.95rem; color: var(--text-main); font-weight: 600; cursor: pointer; outline: none; }
.btn-edit-group { background: transparent; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-sub); font-size: 0.8rem; padding: 2px 6px; }

/* Modal */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.modal-card { background: var(--bg-card); padding: 24px; border-radius: 12px; width: 400px; max-width: 90%; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); }
.modal-desc { font-size: 0.9rem; color: var(--text-sub); margin-bottom: 16px; }
.group-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.group-item { display: flex; gap: 8px; }
.group-item input { flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-main); }
.btn-sm { padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.modal-footer { display: flex; justify-content: flex-end; }
.modal-footer button { padding: 8px 20px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; color: var(--text-main); font-weight: 600; }

/* Status & Actions */
.nav-status { display: flex; align-items: center; gap: 16px; font-size: 0.95rem; font-weight: 500; }
.status-indicator { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.status-indicator.polling { color: var(--warning); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.loading .dot { animation: pulse 1.5s infinite; }
.pulse-orange { animation: pulse-orange 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes pulse-orange { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }

.theme-toggle { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; font-size: 1.2rem; }
.theme-toggle:hover { background: var(--primary); border-color: var(--primary); color: white; transform: scale(1.05); }

.action-trigger-btn { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border: none; border-radius: 8px; color: white; padding: 8px 14px; font-weight: 600; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2); }
.action-trigger-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3); }
.action-trigger-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; filter: grayscale(0.5); }
.icon-btn { background: var(--bg-secondary); border: 1px solid var(--border-color); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.2rem; }

.user-profile { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 8px; border-radius: 99px; transition: background 0.2s; }
.user-profile:hover { background: var(--bg-secondary); }
.avatar { width: 36px; height: 36px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--text-sub); border: 1px solid var(--border-color); }
.avatar-img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color); }

/* Layout Grid */
.content-container { max-width: 1600px; margin: 0 auto; padding: 32px; display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; width: 100%; align-items: start; }
.main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.section-charts { display: block; width: 100%; }
.side-column { min-width: 0; }
.sticky-panel { position: sticky; top: calc(var(--header-height) + 24px); display: flex; flex-direction: column; gap: 24px; z-index: 10; height: fit-content; max-height: calc(100vh - 100px); overflow-y: auto; }

/* Cards */
.card, .chart-wrapper { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow-card); transition: box-shadow 0.2s ease; }
.chart-wrapper { height: 400px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.chart-wrapper.chart-full { height: 500px; width: 100%; }
.card h3 { font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin: 0 0 20px 0; letter-spacing: -0.01em; }

/* Alerts */
.dividend-alert { border-left: 4px solid var(--warning); background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05)); }
.alert-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.alert-header h4 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main); }
.alert-icon { font-size: 1.3rem; }
.alert-text { margin: 0 0 16px 0; font-size: 0.95rem; color: var(--text-sub); line-height: 1.5; }
.alert-text strong { color: var(--warning); font-weight: 700; }
.btn-alert { width: 100%; padding: 10px; background: var(--warning); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.95rem; }
.btn-alert:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3); }

/* Tables */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { text-align: left; color: var(--text-sub); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary); }
th:first-child { border-top-left-radius: var(--radius-sm); }
th:last-child { border-top-right-radius: var(--radius-sm); }
td { padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 1rem; color: var(--text-main); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background-color: var(--bg-secondary); }

/* Toast */
.toast-container { position: fixed; bottom: 32px; right: 32px; z-index: 9999; display: flex; flex-direction: column; gap: 12px; pointer-events: none; }
.toast { pointer-events: auto; background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid transparent; padding: 16px 20px; border-radius: 12px; box-shadow: var(--shadow-lg); display: flex; gap: 12px; cursor: pointer; min-width: 280px; }
.toast.success { border-left-color: var(--success); }
.toast.error { border-left-color: var(--danger); }
.toast.info { border-left-color: var(--primary); }
.toast-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
.toast.success .toast-icon { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.toast.error .toast-icon { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
.toast.info .toast-icon { background: rgba(59, 130, 246, 0.1); color: var(--primary); }
.toast-msg { font-size: 0.95rem; color: var(--text-main); font-weight: 500; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.toast-slide-enter-from, .toast-slide-leave-to { transform: translateX(100%); opacity: 0; }

/* Mobile Utilities & Components */
.mobile-only { display: none; }
.btn-mobile-trade { display: none; }
.sidebar-backdrop { display: none; }

/* Responsive Adjustments */
@media (max-width: 1024px) {
  .content-container { grid-template-columns: 1fr; padding: 20px; gap: 20px; }
  
  /* 手機版側邊欄抽屜化 */
  .side-column { 
    position: fixed; top: 0; right: 0; bottom: 0; width: 85%; max-width: 400px; 
    background: var(--bg-app); z-index: 200; transform: translateX(100%); 
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: -4px 0 15px rgba(0,0,0,0.3); padding: 20px; overflow-y: auto;
  }
  .side-column.mobile-visible { transform: translateX(0); }
  .sticky-panel { position: static; max-height: none; }
  
  .sidebar-backdrop { 
    display: block; position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
    background: rgba(0,0,0,0.5); z-index: 199; backdrop-filter: blur(2px);
  }

  /* 浮動按鈕 */
  .btn-mobile-trade {
    display: flex; align-items: center; justify-content: center;
    position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;
    border-radius: 50%; background: var(--primary); color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); border: none; z-index: 100;
    font-size: 2rem; cursor: pointer; transition: transform 0.2s;
  }
  .btn-mobile-trade:active { transform: scale(0.9); }
  
  .desktop-only { display: none; }
  .mobile-only { display: flex; }
  
  .mobile-sidebar-header { 
    justify-content: space-between; align-items: center; margin-bottom: 20px; 
    border-bottom: 1px solid var(--border-color); padding-bottom: 12px;
  }
  .mobile-sidebar-header h3 { margin: 0; font-size: 1.2rem; }
  .close-btn { background: transparent; border: none; font-size: 1.5rem; color: var(--text-sub); cursor: pointer; }
}

@media (max-width: 768px) {
  .top-nav { padding: 0 16px; height: 56px; }
  .nav-brand h1 { font-size: 1.1rem; }
  .content-container { padding: 16px; }
  .chart-wrapper.chart-full { height: 320px; }
  .toast-container { bottom: 80px; right: 16px; left: 16px; } /* 避開 FAB */
  .toast { min-width: auto; }
  
  /* Mobile Modal Style */
  .mobile-selector-card { position: fixed; bottom: 0; left: 0; right: 0; width: 100%; max-width: 100%; border-radius: 16px 16px 0 0; padding: 24px; animation: slideUp 0.3s ease; }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .mobile-options { display: flex; flex-direction: column; gap: 8px; }
  .mobile-option-btn { padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; font-size: 1rem; color: var(--text-main); text-align: left; }
  .mobile-option-btn.active { border-color: var(--primary); color: var(--primary); background: rgba(59, 130, 246, 0.05); font-weight: 700; }
}
</style>
