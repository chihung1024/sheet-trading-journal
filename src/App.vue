<template>
  <div class="app-root" :class="{ 'dark': isDark }">
    <div class="ambient-glow"></div>

    <Transition name="fade-overlay">
      <LoginOverlay v-if="!authStore.token" />
    </Transition>

    <div v-if="authStore.token" class="app-layout">
      
      <header class="app-header glass-panel">
        <div class="header-inner">
          <div class="brand-section">
            <div class="logo-box">
              <span class="logo-icon">📊</span>
            </div>
            <div class="brand-info">
              <h1 class="brand-name">Trading Journal <span class="badge-pro">PRO</span></h1>
              <span class="last-update" v-if="portfolioStore.lastUpdate">
                Updated {{ formatTime(portfolioStore.lastUpdate) }}
              </span>
            </div>
          </div>

          <div class="controls-section desktop-only">
            <div class="control-group" v-if="portfolioStore.availableGroups.length > 1">
              <span class="control-label">Portfolio</span>
              <div class="select-wrapper">
                <select 
                  :value="portfolioStore.currentGroup" 
                  @change="e => portfolioStore.setGroup(e.target.value)"
                  class="custom-select"
                >
                  <option value="all">All Portfolios</option>
                  <option v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" :value="g">
                    {{ g }}
                  </option>
                </select>
                <button class="btn-icon-tiny" @click="showGroupModal=true" title="Edit Group">✎</button>
              </div>
            </div>
          </div>

          <div class="actions-section">
            <button 
              class="btn-action"
              @click="handleTriggerUpdate"
              :disabled="portfolioStore.isPolling"
              :class="{ 'is-loading': portfolioStore.isPolling }"
              title="Sync Data"
            >
              <span class="icon-refresh">↻</span>
              <span class="label desktop-only">Sync</span>
            </button>

            <button class="btn-icon theme-toggle" @click="toggleTheme">
              {{ isDark ? '🌞' : '🌙' }}
            </button>

            <div class="user-menu" @click="handleLogout" title="Logout">
              <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="user-avatar" alt="U">
              <div v-else class="user-avatar placeholder">{{ userInitial }}</div>
            </div>
          </div>
        </div>
        
        <div class="mobile-controls glass-panel mobile-only" v-if="portfolioStore.availableGroups.length > 1">
           <select 
              :value="portfolioStore.currentGroup" 
              @change="e => portfolioStore.setGroup(e.target.value)"
              class="mobile-select"
            >
              <option value="all">All Portfolios</option>
              <option v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" :value="g">
                {{ g }}
              </option>
            </select>
        </div>
      </header>

      <main class="app-content">
        <div class="dashboard-grid">
          
          <section class="grid-area-stats">
            <Transition name="fade-slide" mode="out-in">
              <StatsGrid v-if="!portfolioStore.loading" />
              <StatsGridSkeleton v-else />
            </Transition>
          </section>

          <section class="grid-area-chart">
            <div class="panel-container">
              <Transition name="fade-slide" mode="out-in">
                <PerformanceChart v-if="!portfolioStore.loading" />
                <ChartSkeleton v-else />
              </Transition>
            </div>
          </section>

          <div class="grid-area-split">
            <div class="split-main">
              <div class="panel-container mb-6">
                <HoldingsTable v-if="!portfolioStore.loading" />
                <TableSkeleton v-else />
              </div>
              <div class="panel-container">
                <RecordList v-if="!portfolioStore.loading" @edit="handleEditRecord" />
                <TableSkeleton v-else />
              </div>
            </div>

            <aside class="split-side">
              <div class="sticky-wrapper">
                <TradeForm ref="tradeFormRef" />
                
                <Transition name="pop-in">
                  <div v-if="hasPendingDividends" class="dividend-alert-card" @click="scrollToDividends">
                    <div class="alert-content">
                      <span class="icon">🔔</span>
                      <div class="text">
                        <strong>{{ pendingDividendsCount }} Pending Dividends</strong>
                        <span>Action required</span>
                      </div>
                    </div>
                    <button class="btn-mini">Review</button>
                  </div>
                </Transition>
              </div>
            </aside>
          </div>

          <section id="dividend-section" class="grid-area-full" v-if="!portfolioStore.loading && hasPendingDividends">
            <DividendManager />
          </section>

        </div>
      </main>
    </div>

    <Transition name="modal-fade">
      <div v-if="showGroupModal" class="modal-backdrop" @click.self="showGroupModal=false">
        <div class="modal-window">
          <div class="modal-header">
            <h3>Manage Portfolios</h3>
            <button class="btn-close" @click="showGroupModal=false">✕</button>
          </div>
          <div class="modal-body custom-scrollbar">
            <div v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" class="group-row">
              <input type="text" v-model="groupRenameMap[g]" :placeholder="g" class="input-flat">
              <button @click="renameGroup(g)" class="btn-xs primary" :disabled="!groupRenameMap[g] || groupRenameMap[g]===g">Save</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <ToastContainer />
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

// Components
import LoginOverlay from './components/LoginOverlay.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import DividendManager from './components/DividendManager.vue';
import ToastContainer from './components/ToastContainer.vue';

// Skeletons
import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();
const { needRefresh, updateServiceWorker } = usePWA();

// UI States
const showGroupModal = ref(false);
const groupRenameMap = reactive({});

// Computed
const hasPendingDividends = computed(() => portfolioStore.pending_dividends && portfolioStore.pending_dividends.length > 0);
const pendingDividendsCount = computed(() => portfolioStore.pending_dividends ? portfolioStore.pending_dividends.length : 0);
const userInitial = computed(() => authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U');

// Formatters
const formatTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Actions
const scrollToDividends = () => {
  const el = document.getElementById('dividend-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const renameGroup = async (oldName) => {
  const newName = groupRenameMap[oldName];
  if(!newName || !confirm(`Rename "${oldName}" to "${newName}"?`)) return;
  
  addToast('Updating records...', 'info');
  try {
    const targetRecords = portfolioStore.records.filter(r => (r.tag || '').includes(oldName));
    for(const r of targetRecords) {
      let tags = (r.tag || '').split(/[,;]/).map(t=>t.trim());
      tags = tags.map(t => t === oldName ? newName : t);
      await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...r, tag: tags.join(', ') })
      });
    }
    addToast('Group renamed successfully', 'success');
    await portfolioStore.fetchRecords();
    await portfolioStore.triggerUpdate();
    showGroupModal.value = false;
  } catch(e) {
    addToast('Rename failed', 'error');
  }
};

const handleTriggerUpdate = async () => {
  if (portfolioStore.isPolling) return;
  if (!confirm("Trigger manual data sync?")) return;
  try {
    await portfolioStore.triggerUpdate();
    addToast("Sync started in background", "info");
  } catch (error) {
    addToast(error.message, "error");
  }
};

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    // Smooth scroll to sidebar on mobile
    if (window.innerWidth < 1024) {
      const formEl = document.querySelector('.split-side');
      if(formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};

const handleLogout = () => {
  if (confirm("Log out?")) authStore.logout();
};

onMounted(async () => {
  console.log('✨ App Initialized: Commercial Grade UI');
  if (authStore.initAuth()) {
    await portfolioStore.fetchAll();
  }
  await nextTick();
  const loader = document.getElementById('app-loading');
  if (loader) loader.remove();
});
</script>

<style>
/* ========================================
  COMMERCIAL GRADE DESIGN SYSTEM
  ========================================
*/
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  /* 1. Color Palette (Refined) */
  --c-brand: #3b82f6;       /* Blue 500 */
  --c-brand-dark: #2563eb;  /* Blue 600 */
  --c-brand-light: #dbeafe; /* Blue 100 */
  
  --c-success: #10b981;     /* Emerald 500 */
  --c-danger: #ef4444;      /* Red 500 */
  --c-warning: #f59e0b;     /* Amber 500 */
  
  /* Light Mode Base */
  --bg-app: #f8fafc;        /* Slate 50 */
  --bg-card: #ffffff;
  --bg-panel: rgba(255, 255, 255, 0.7);
  --border-base: #e2e8f0;   /* Slate 200 */
  --border-hover: #cbd5e1;  /* Slate 300 */
  
  --text-primary: #0f172a;  /* Slate 900 */
  --text-secondary: #64748b;/* Slate 500 */
  --text-muted: #94a3b8;    /* Slate 400 */

  /* Shadows (Depth) */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  
  /* Constants */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --nav-height: 64px;
}

/* Dark Mode Overrides */
.dark {
  --bg-app: #0f172a;        /* Slate 900 */
  --bg-card: #1e293b;       /* Slate 800 */
  --bg-panel: rgba(30, 41, 59, 0.7);
  --border-base: #334155;   /* Slate 700 */
  --border-hover: #475569;  /* Slate 600 */
  
  --text-primary: #f8fafc;  /* Slate 50 */
  --text-secondary: #cbd5e1;/* Slate 300 */
  --text-muted: #64748b;    /* Slate 500 */
  
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.5);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.5);
}

/* Global Reset */
* { box-sizing: border-box; outline: none; }
body {
  background-color: var(--bg-app);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  margin: 0;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* ========================================
  LAYOUT STRUCTURE
  ========================================
*/
.app-root { min-height: 100vh; position: relative; }

/* Ambient Background Glow */
.ambient-glow {
  position: fixed; top: 0; left: 0; width: 100%; height: 400px;
  background: radial-gradient(circle at 50% -20%, rgba(59, 130, 246, 0.15), transparent 70%);
  pointer-events: none; z-index: 0;
}

/* Header */
.app-header {
  position: sticky; top: 0; z-index: 50;
  height: var(--nav-height);
  border-bottom: 1px solid var(--border-base);
  backdrop-filter: blur(12px);
  background: var(--bg-panel);
}

.header-inner {
  max-width: 1440px; margin: 0 auto; height: 100%;
  padding: 0 24px;
  display: flex; align-items: center; justify-content: space-between;
}

/* Brand */
.brand-section { display: flex; align-items: center; gap: 12px; }
.logo-box {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, var(--c-brand), var(--c-brand-dark));
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.3);
}
.brand-name { font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
.badge-pro { 
  background: var(--bg-card); border: 1px solid var(--border-base);
  color: var(--c-brand); font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; vertical-align: middle;
}
.last-update { display: block; font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }

/* Controls */
.control-group { display: flex; flex-direction: column; gap: 2px; }
.control-label { font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.05em; }
.select-wrapper { display: flex; align-items: center; gap: 6px; }
.custom-select {
  background: transparent; border: none; font-size: 0.9rem; font-weight: 600; color: var(--text-primary); cursor: pointer; padding-right: 12px;
}
.btn-icon-tiny { background: transparent; border: 1px solid var(--border-base); border-radius: 4px; cursor: pointer; color: var(--text-secondary); padding: 2px 4px; font-size: 0.7rem; }

/* Actions */
.actions-section { display: flex; align-items: center; gap: 16px; }
.btn-action {
  background: var(--bg-card); border: 1px solid var(--border-base);
  color: var(--text-secondary); padding: 6px 12px; border-radius: 8px;
  font-size: 0.85rem; font-weight: 500; cursor: pointer;
  display: flex; align-items: center; gap: 6px; transition: all 0.2s;
}
.btn-action:hover { border-color: var(--c-brand); color: var(--c-brand); }
.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }
.icon-refresh { font-size: 1.1rem; }
.is-loading .icon-refresh { animation: spin 1s linear infinite; }

.user-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--c-brand-light); color: var(--c-brand-dark); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; cursor: pointer; border: 2px solid var(--bg-card); box-shadow: 0 0 0 1px var(--border-base); }

/* Main Content */
.app-content { max-width: 1440px; margin: 0 auto; padding: 24px; }
.dashboard-grid { display: flex; flex-direction: column; gap: 24px; }

/* Panel Containers (Cards) */
.panel-container {
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

/* Split Layout */
.grid-area-split { display: grid; grid-template-columns: 1fr 360px; gap: 24px; align-items: start; }
.split-main { min-width: 0; }
.sticky-wrapper { position: sticky; top: calc(var(--nav-height) + 24px); display: flex; flex-direction: column; gap: 20px; }

/* Dividend Alert Card */
.dividend-alert-card {
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 1px solid #fcd34d;
  color: #92400e;
  padding: 16px; border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  cursor: pointer; display: flex; align-items: center; justify-content: space-between;
  transition: transform 0.2s;
}
.dark .dividend-alert-card { background: linear-gradient(135deg, #451a03, #78350f); border-color: #92400e; color: #fcd34d; }
.dividend-alert-card:hover { transform: translateY(-2px); }
.alert-content { display: flex; align-items: center; gap: 12px; }
.alert-content .text { display: flex; flex-direction: column; font-size: 0.9rem; }
.alert-content .text span { font-size: 0.75rem; opacity: 0.8; }
.btn-mini { background: rgba(0,0,0,0.05); border: none; padding: 4px 10px; border-radius: 4px; font-weight: 600; cursor: pointer; color: inherit; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; }
.modal-window { background: var(--bg-card); width: 400px; max-width: 90%; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 24px; border: 1px solid var(--border-base); }
.modal-header { display: flex; justify-content: space-between; margin-bottom: 16px; }
.modal-header h3 { margin: 0; font-size: 1.2rem; }
.btn-close { background: transparent; border: none; cursor: pointer; font-size: 1.2rem; color: var(--text-secondary); }
.group-row { display: flex; gap: 8px; margin-bottom: 12px; }
.input-flat { flex: 1; padding: 8px; border: 1px solid var(--border-base); border-radius: 6px; background: var(--bg-app); color: var(--text-primary); }
.btn-xs { padding: 0 12px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; }
.btn-xs.primary { background: var(--c-brand); color: white; }
.btn-xs:disabled { opacity: 0.5; }

/* Utilities */
.mb-6 { margin-bottom: 24px; }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 3px; }

/* Animations */
@keyframes spin { 100% { transform: rotate(360deg); } }
.fade-overlay-enter-active, .fade-overlay-leave-active { transition: opacity 0.3s; }
.fade-overlay-enter-from, .fade-overlay-leave-to { opacity: 0; }
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from, .fade-slide-leave-to { opacity: 0; transform: translateY(10px); }

/* Responsive */
@media (max-width: 1024px) {
  .grid-area-split { grid-template-columns: 1fr; }
  .split-side { order: -1; margin-bottom: 24px; }
  .sticky-wrapper { position: static; }
  .desktop-only { display: none !important; }
}

@media (max-width: 768px) {
  .header-inner { padding: 0 16px; }
  .app-content { padding: 16px; }
  .mobile-controls { padding: 12px 16px; border-bottom: 1px solid var(--border-base); background: var(--bg-card); }
  .mobile-select { width: 100%; padding: 8px; border: 1px solid var(--border-base); border-radius: 6px; background: var(--bg-app); color: var(--text-primary); }
}
</style>
