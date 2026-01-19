<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-left">
          <div class="nav-brand">
            <span class="logo-icon">📊</span>
            <h1>Trading Journal <span class="badge desktop-only">PRO</span></h1>
          </div>

          <div class="group-selector" v-if="portfolioStore.availableGroups.length > 1">
            <span class="selector-label desktop-only">策略群組:</span>
            <div class="select-wrapper">
              <select :value="portfolioStore.currentGroup" @change="e => portfolioStore.setGroup(e.target.value)">
                <option value="all">全部 (All)</option>
                <option v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" :value="g">
                  {{ g }}
                </option>
              </select>
              <button class="btn-edit-group" @click="showGroupModal=true" title="管理群組名稱">
                ✎
              </button>
            </div>
          </div>
        </div>

        <div class="nav-status">
          <div v-if="portfolioStore.loading" class="status-indicator loading">
            <span class="dot"></span> <span class="desktop-only">更新中...</span>
          </div>
          
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling">
            <span class="dot pulse-orange"></span> <span class="desktop-only">計算中...</span>
          </div>
          
          <div v-else class="status-indicator ready">
            <span class="dot"></span> <span class="desktop-only">連線正常</span>
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
          <div class="modal-header">
            <h3>管理策略群組</h3>
            <button class="close-modal" @click="showGroupModal=false">×</button>
          </div>
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
            <button class="btn-close" @click="showGroupModal=false">關閉</button>
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

          <div class="mobile-trade-form tablet-only">
             <TradeForm ref="tradeFormRefMobile" />
          </div>
          
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
        
        <aside class="side-column desktop-only">
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
      </div>

      <footer class="app-footer">
        <p>© 2024 Trading Journal PRO. All rights reserved.</p>
      </footer>
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
import { ref, onMounted, computed, nextTick, reactive, watch } from 'vue'; // MODIFIED: 增加 watch
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
const tradeFormRefMobile = ref(null); // MODIFIED: 新增行動端 ref
const { toasts, removeToast, addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();

const { needRefresh, updateServiceWorker } = usePWA();

const showGroupModal = ref(false);
const groupRenameMap = reactive({});

// MODIFIED: Modal 開啟時鎖定滾動
watch(showGroupModal, (val) => {
  document.body.style.overflow = val ? 'hidden' : 'visible';
});

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
  // MODIFIED: 支援雙向 ref
  const activeRef = tradeFormRef.value || tradeFormRefMobile.value;
  if (activeRef) {
    activeRef.setupForm(record);
    // MODIFIED: 捲動至表單位置，優化行動端體驗
    const target = tradeFormRefMobile.value ? '.mobile-trade-form' : '.side-column';
    document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } /* MODIFIED: 移除行動端點擊高亮 */
body { 
  background-color: var(--bg-app); 
  color: var(--text-main); 
  font-family: 'Inter', system-ui, -apple-system, sans-serif; 
  margin: 0; 
  font-size: 16px; /* MODIFIED: 基礎字體回歸 16px */
  line-height: 1.5; 
  -webkit-font-smoothing: antialiased; 
  transition: background-color 0.3s ease, color 0.3s ease;
  overflow-x: hidden; /* MODIFIED: 防止左右晃動 */
}

.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; }

/* MODIFIED: 導航欄樣式強化 */
.top-nav { 
  background: var(--bg-card); 
  border-bottom: 1px solid var(--border-color); 
  padding: 0 16px; /* MODIFIED: 行動端縮小 padding */
  height: 64px; 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  position: sticky; /* MODIFIED: 固定置頂 */
  top: 0;
  z-index: 1000; 
  box-shadow: var(--shadow-sm); 
}

.nav-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }

.nav-brand { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.nav-brand h1 { font-size: 1.1rem; font-weight: 800; margin: 0; color: var(--text-main); white-space: nowrap; }

.group-selector { 
  display: flex; 
  align-items: center; 
  gap: 6px; 
  background: var(--bg-secondary); 
  padding: 4px 10px; 
  border-radius: 99px; /* MODIFIED: 膠囊形狀 */
  border: 1px solid var(--border-color);
  min-width: 0;
}
.select-wrapper select { 
  max-width: 100px; /* MODIFIED: 避免擠壓 */
  font-size: 0.85rem; 
  font-weight: 700; 
  color: var(--primary);
}

.nav-status { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.action-trigger-btn { 
  width: 40px; height: 40px; /* MODIFIED: 圓形按鈕 */
  border-radius: 50%; 
  padding: 0; 
  justify-content: center;
  background: var(--primary);
}

.theme-toggle { border-radius: 50%; width: 40px; height: 40px; }

/* MODIFIED: 內容佈局重構 */
.content-container { 
  max-width: 1400px; 
  margin: 0 auto; 
  padding: 16px; /* MODIFIED: 行動端縮小 padding */
  display: grid; 
  grid-template-columns: 1fr; /* MODIFIED: 預設單欄 (Mobile First) */
  gap: 16px; 
  width: 100%; 
}

.main-column { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

/* MODIFIED: 增加行動端專屬表單間距 */
.mobile-trade-form { margin: 8px 0; }

.chart-wrapper.chart-full { 
  height: 320px; /* MODIFIED: 行動端降低圖表高度 */
  padding: 12px;
}

.card { padding: 16px; }

/* MODIFIED: 頁尾優化 */
.app-footer { 
  padding: 24px 16px; 
  text-align: center; 
  color: var(--text-sub); 
  font-size: 0.8rem;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}

/* MODIFIED: Modal 行動端強化 */
.modal-card { 
  width: 100%; 
  max-width: 450px; 
  margin: 16px;
  border-radius: 20px;
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.close-modal { background: none; border: none; font-size: 1.5rem; color: var(--text-sub); cursor: pointer; }

/* MODIFIED: 響應式中斷點細修 */
@media (min-width: 1024px) {
  .desktop-only { display: flex !important; }
  .tablet-only { display: none !important; }
  
  .top-nav { padding: 0 32px; }
  .nav-brand h1 { font-size: 1.4rem; }
  .content-container { 
    grid-template-columns: minmax(0, 1fr) 380px; 
    padding: 32px; 
    gap: 24px; 
  }
  .main-column { gap: 24px; }
  .chart-wrapper.chart-full { height: 500px; padding: 24px; }
  .action-trigger-btn { width: auto; border-radius: 8px; padding: 8px 16px; }
  .select-wrapper select { max-width: none; font-size: 0.95rem; }
}

@media (max-width: 1023px) {
  .desktop-only { display: none !important; }
}

/* MODIFIED: Toast 行動端位置優化 */
@media (max-width: 768px) {
  .toast-container { 
    left: 16px; 
    right: 16px; 
    bottom: calc(16px + env(safe-area-inset-bottom)); 
  }
  .toast { min-width: 0; }
}
</style>
