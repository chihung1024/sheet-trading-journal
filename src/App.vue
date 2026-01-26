<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-left">
          <div class="nav-brand">
            <span class="logo-icon">📊</span>
            <h1>Journal <span class="badge">PRO</span></h1>
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
              <button class="btn-edit-group" @click="showGroupModal=true">✎</button>
            </div>
          </div>
        </div>

        <div class="nav-status">
          <div v-if="portfolioStore.loading" class="status-indicator loading" title="更新中...">
            <span class="dot"></span> <span class="desktop-only">更新中</span>
          </div>
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling" title="計算中...">
            <span class="dot pulse-orange"></span>
          </div>
          <div v-else class="status-indicator ready" title="連線正常">
            <span class="dot"></span>
          </div>
          
          <button 
            v-if="portfolioStore.availableGroups.length > 1"
            class="mobile-group-btn mobile-only" 
            @click="showGroupSwitchModal = true"
          >
            <span>📂</span>
          </button>

          <button 
            class="action-trigger-btn" 
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
          >
            <span>⚙️</span>
            <span class="desktop-only">更新</span>
          </button>
          
          <button class="theme-toggle" @click="toggleTheme">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>
          
          <div class="user-profile" @click="handleLogout">
            <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="avatar-img" alt="User">
            <div v-else class="avatar">{{ userInitial }}</div>
          </div>
        </div>
      </header>
      
      <div v-if="showGroupModal" class="modal-overlay" @click.self="showGroupModal=false">
        <div class="modal-card">
          <h3>管理策略群組</h3>
          <div class="group-list">
            <div v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" class="group-item">
              <input type="text" v-model="groupRenameMap[g]" :placeholder="g">
              <button @click="renameGroup(g)" class="btn-sm" :disabled="!groupRenameMap[g]">更名</button>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="showGroupModal=false">關閉</button>
          </div>
        </div>
      </div>

      <div v-if="showGroupSwitchModal" class="modal-overlay" @click.self="showGroupSwitchModal=false">
        <div class="modal-card mobile-modal">
          <h3>切換群組</h3>
          <div class="group-switch-list">
            <button 
              v-for="g in portfolioStore.availableGroups" 
              :key="g" 
              class="group-switch-item"
              :class="{ active: portfolioStore.currentGroup === g }"
              @click="handleGroupSwitch(g)"
            >
              <span>{{ g === 'all' ? '全部 (All)' : g }}</span>
              <span v-if="portfolioStore.currentGroup === g">✓</span>
            </button>
          </div>
          <div class="modal-footer">
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
        
        <aside class="side-column">
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
const { needRefresh, updateServiceWorker } = usePWA();

const showGroupModal = ref(false);
const showGroupSwitchModal = ref(false);
const groupRenameMap = reactive({});

const hasPendingDividends = computed(() => portfolioStore.pending_dividends?.length > 0);
const pendingDividendsCount = computed(() => portfolioStore.pending_dividends ? portfolioStore.pending_dividends.length : 0);

const userInitial = computed(() => authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U');

const scrollToDividends = () => {
  const el = document.querySelector('.section-dividends');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const handleGroupSwitch = (group) => {
  portfolioStore.setGroup(group);
  showGroupSwitchModal.value = false;
};

const renameGroup = async (oldName) => {
  const newName = groupRenameMap[oldName];
  if(!newName || !confirm(`確定將 "${oldName}" 更名為 "${newName}" 嗎？`)) return;
  
  try {
    const targetRecords = portfolioStore.records.filter(r => {
      const tags = (r.tag || '').split(/[,;]/).map(t=>t.trim());
      return tags.includes(oldName);
    });
    
    for(const r of targetRecords) {
      let tags = (r.tag || '').split(/[,;]/).map(t=>t.trim());
      tags = tags.map(t => t === oldName ? newName : t);
      await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...r, tag: tags.join(', ') })
      });
    }
    addToast('更新成功', 'success');
    await portfolioStore.fetchRecords();
    await portfolioStore.triggerUpdate();
    showGroupModal.value = false;
  } catch(e) {
    addToast('更新失敗', 'error');
  }
};

const handleTriggerUpdate = async () => {
  if (portfolioStore.isPolling) return;
  if (!confirm("確定要觸發後端計算嗎？")) return;
  try {
    await portfolioStore.triggerUpdate();
    addToast("已觸發更新", "success");
  } catch (error) {
    addToast(error.message, "error");
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

const handleLogout = () => {
  if (confirm("確定要登出嗎？")) authStore.logout();
};

onMounted(async () => {
  const isLoggedIn = authStore.initAuth();
  if (isLoggedIn) await portfolioStore.fetchAll();
  
  await nextTick();
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
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1);
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
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.4);
}

* { box-sizing: border-box; }
body { 
    background-color: var(--bg-app); 
    color: var(--text-main); 
    font-family: 'Inter', sans-serif; 
    margin: 0; 
    overflow-x: hidden; 
}

/* 佈局容器 */
.app-layout { 
    min-height: 100vh; 
    display: flex; 
    flex-direction: column; 
    overflow-x: hidden; 
}

.main-wrapper { 
    flex: 1; 
    display: flex; 
    flex-direction: column; 
}

/* Header */
.top-nav { 
    background: var(--bg-card); 
    border-bottom: 1px solid var(--border-color); 
    padding: 0 24px; 
    height: 64px; 
    display: flex; 
    align-items: center; 
    justify-content: space-between; 
    position: sticky; 
    top: 0; 
    z-index: 100;
}

.nav-left { display: flex; align-items: center; gap: 16px; }
.nav-brand { display: flex; align-items: center; gap: 8px; }
.nav-brand h1 { font-size: 1.3rem; font-weight: 700; margin: 0; }
.badge { background: var(--text-main); color: var(--bg-card); font-size: 0.7rem; padding: 2px 6px; border-radius: 99px; }
.logo-icon { font-size: 1.4rem; }

.nav-status { display: flex; align-items: center; gap: 12px; }

/* 狀態指示燈 */
.status-indicator { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 500; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.status-indicator.polling { color: var(--warning); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.pulse-orange { animation: pulse 1s infinite; }
@keyframes pulse { 50% { opacity: 0.5; } }

/* 按鈕樣式 */
.action-trigger-btn { 
    background: linear-gradient(135deg, var(--primary), var(--primary-dark)); 
    border: none; border-radius: 8px; color: white; 
    padding: 8px 12px; font-weight: 600; cursor: pointer; 
    display: flex; align-items: center; gap: 6px;
}
.theme-toggle { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.1rem; }
.user-profile { width: 36px; height: 36px; cursor: pointer; border-radius: 50%; overflow: hidden; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; font-weight: 600; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

/* 群組選擇器 */
.group-selector { display: flex; align-items: center; gap: 8px; background: var(--bg-secondary); padding: 4px 10px; border-radius: 8px; border: 1px solid var(--border-color); }
.select-wrapper { display: flex; align-items: center; }
.select-wrapper select { background: transparent; border: none; font-weight: 600; color: var(--text-main); outline: none; }
.btn-edit-group { background: transparent; border: none; cursor: pointer; font-size: 1rem; color: var(--text-sub); }

/* 手機版群組按鈕 */
.mobile-group-btn {
    display: none; 
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    width: 36px; height: 36px;
    border-radius: 8px;
    align-items: center; justify-content: center;
    cursor: pointer;
    font-size: 1.2rem;
}

/* 內容區塊 Grid */
.content-container { 
    max-width: 1600px; 
    margin: 0 auto; 
    padding: 24px; 
    display: grid; 
    grid-template-columns: minmax(0, 1fr) 360px; 
    gap: 24px; 
    width: 100%; 
}
.main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.side-column { min-width: 0; }

.card, .chart-wrapper { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow-card); }
.chart-wrapper { height: 450px; overflow: hidden; display: flex; flex-direction: column; padding: 0; }

/* ⚠️ 關鍵修正：固定側邊欄 (Sticky Sidebar) */
.sticky-panel { 
    position: sticky; 
    top: 88px; /* 距離 Header 的高度 */
    display: flex; 
    flex-direction: column; 
    gap: 20px; 
    /* 避免太長的內容被切掉 */
    max-height: calc(100vh - 120px); 
    overflow-y: auto;
    /* 隱藏捲軸但保留功能 */
    scrollbar-width: none; 
}
.sticky-panel::-webkit-scrollbar { display: none; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-card { background: var(--bg-card); padding: 24px; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: var(--shadow-lg); }
.group-switch-list { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; max-height: 300px; overflow-y: auto; }
.group-switch-item { display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; color: var(--text-main); font-weight: 500; }
.group-switch-item.active { border-color: var(--primary); color: var(--primary); background: rgba(59, 130, 246, 0.05); }

/* 工具類 */
.desktop-only { display: inline-block; }
.mobile-only { display: none; }

/* RWD 手機直向 */
@media (max-width: 640px) {
    .content-container { 
        grid-template-columns: 1fr; 
        padding: 16px; 
        gap: 16px; 
    }
    
    .top-nav { 
        padding: 0 16px; 
        height: 56px; 
    }
    
    .nav-brand h1 { font-size: 1.1rem; }
    
    .desktop-only { display: none !important; }
    .mobile-only { display: flex !important; }
    
    .nav-status { gap: 8px; }
    .action-trigger-btn { padding: 6px; width: 36px; height: 36px; justify-content: center; }
    .action-trigger-btn span:first-child { margin: 0; font-size: 1.1rem; }
    
    .side-column { order: 2; }
    
    /* 手機版移除 Sticky，改為正常流動 */
    .sticky-panel { 
        position: static; 
        max-height: none; 
        overflow: visible; 
    }
    
    .chart-wrapper.chart-full { height: 350px; }
}
</style>
