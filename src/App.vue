<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
          <span class="logo-icon">📊</span>
          <h1>Trading Journal <span class="badge">PRO</span></h1>
        </div>

        <div class="benchmark-selector">
          <span class="selector-label">基準標的:</span>
          <div class="select-wrapper">
            <select 
              v-model="currentBenchmark" 
              @change="handleBenchmarkChange"
              :disabled="portfolioStore.isPolling"
            >
              <option value="SPY">S&P 500 (SPY)</option>
              <option value="QQQ">Nasdaq 100 (QQQ)</option>
              <option value="VT">Global Stock (VT)</option>
              <option value="0050.TW">元大台灣50 (0050)</option>
              <option value="CUSTOM">自定義代碼...</option>
            </select>
            <input 
              v-if="isCustomBenchmark"
              v-model="customTicker"
              @blur="applyCustomBenchmark"
              @keyup.enter="applyCustomBenchmark"
              placeholder="代碼"
              class="custom-ticker-mini"
            />
          </div>
        </div>

        <div class="group-selector" v-if="portfolioStore.availableGroups.length > 1">
          <span class="selector-label">策略群組:</span>
          <div class="select-wrapper">
            <select :value="portfolioStore.currentGroup" @change="e => portfolioStore.setGroup(e.target.value)">
              <option value="all">全部 (All)</option>
              <option v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" :value="g">
                {{ g }}
              </option>
            </select>
            <button class="btn-edit-group" @click="showGroupModal=true">✎</button>
          </div>
        </div>

        <div class="nav-status">
          <div v-if="portfolioStore.loading" class="status-indicator loading">
            <span class="dot"></span> 更新中...
          </div>
          
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling">
            <span class="dot pulse-orange"></span> 計算中...
          </div>
          
          <div v-else class="status-indicator ready">
            <span class="dot"></span> 連線正常
          </div>
          
          <button 
            class="action-trigger-btn" 
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
          >
            <span>⚙️</span>
            同步
          </button>
          
          <button class="theme-toggle" @click="toggleTheme">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>
          
          <div class="user-profile" @click="handleLogout">
            <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="avatar-img">
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
              <button @click="renameGroup(g)" class="btn-sm" :disabled="!groupRenameMap[g] || groupRenameMap[g]===g">更名</button>
            </div>
          </div>
          <div class="modal-footer"><button @click="showGroupModal=false">關閉</button></div>
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
              <div class="alert-header"><span class="alert-icon">🔔</span><h4>待確認配息</h4></div>
              <p class="alert-text">您有 <strong>{{ pendingDividendsCount }}</strong> 筆配息待確認</p>
              <button class="btn-alert" @click="scrollToDividends">前往確認</button>
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
import { ref, onMounted, computed, nextTick, reactive, watch } from 'vue';
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
import DividendManager from './components/DividendManager.vue';

import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { toasts, removeToast, addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();

// ✅ 新增：Benchmark 管理狀態
const currentBenchmark = ref(portfolioStore.selectedBenchmark || 'SPY');
const isCustomBenchmark = ref(false);
const customTicker = ref('');
const showGroupModal = ref(false);
const groupRenameMap = reactive({});

// 監聽 Store 基準變動同步 UI
watch(() => portfolioStore.selectedBenchmark, (newVal) => {
  if (['SPY', 'QQQ', 'VT', '0050.TW'].includes(newVal)) {
    currentBenchmark.value = newVal;
    isCustomBenchmark.value = false;
  } else if (newVal) {
    currentBenchmark.value = 'CUSTOM';
    isCustomBenchmark.value = true;
    customTicker.value = newVal;
  }
}, { immediate: true });

const handleBenchmarkChange = async () => {
  if (currentBenchmark.value === 'CUSTOM') {
    isCustomBenchmark.value = true;
    return;
  }
  isCustomBenchmark.value = false;
  await confirmAndTriggerBenchmark(currentBenchmark.value);
};

const applyCustomBenchmark = async () => {
  if (!customTicker.value) {
    currentBenchmark.value = portfolioStore.selectedBenchmark;
    isCustomBenchmark.value = false;
    return;
  }
  const ticker = customTicker.value.toUpperCase().trim();
  await confirmAndTriggerBenchmark(ticker);
};

const confirmAndTriggerBenchmark = async (ticker) => {
  if (confirm(`確定要將數據基準 (Benchmark) 修改為 ${ticker} 並重新計算嗎？`)) {
    try {
      addToast(`🚀 正在切換基準至 ${ticker}...`, "info");
      await portfolioStore.triggerUpdate(ticker);
      addToast(`✅ 已觸發計算，預計 1 分鐘後自動重新整理數據。`, "success");
    } catch (e) {
      addToast(`❌ 更新失敗: ${e.message}`, "error");
      currentBenchmark.value = portfolioStore.selectedBenchmark;
    }
  } else {
    currentBenchmark.value = portfolioStore.selectedBenchmark;
  }
};

const hasPendingDividends = computed(() => portfolioStore.pending_dividends?.length > 0);
const pendingDividendsCount = computed(() => portfolioStore.pending_dividends?.length || 0);

const scrollToDividends = () => {
  document.querySelector('.section-dividends')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const renameGroup = async (oldName) => {
  const newName = groupRenameMap[oldName];
  if(!newName || !confirm(`確定將 "${oldName}" 更名為 "${newName}" 嗎？`)) return;
  addToast('正在批次更新紀錄...', 'info');
  try {
    const targetRecords = portfolioStore.records.filter(r => (r.tag || '').split(/[,;]/).map(t=>t.trim()).includes(oldName));
    for(const r of targetRecords) {
      let tags = (r.tag || '').split(/[,;]/).map(t=>t.trim()).map(t => t === oldName ? newName : t);
      await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...r, tag: tags.join(', ') })
      });
    }
    addToast(`更新成功`, 'success');
    await portfolioStore.fetchRecords();
    await portfolioStore.triggerUpdate();
    showGroupModal.value = false;
  } catch(e) { addToast('更新失敗', 'error'); }
};

const handleTriggerUpdate = async () => {
  if (portfolioStore.isPolling) { addToast("⌛ 正在背景監控中...", "info"); return; }
  if (!confirm("確定要觸發數據同步嗎？")) return;
  try {
    await portfolioStore.triggerUpdate();
    addToast("✅ 已觸發手動更新！", "success");
  } catch (error) { addToast(`❌ 失敗: ${error.message}`, "error"); }
};

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    if (window.innerWidth < 1024) document.querySelector('.side-column')?.scrollIntoView({ behavior: 'smooth' });
  }
};

const userInitial = computed(() => authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U');
const handleLogout = () => { if (confirm("確定要登出系統嗎？")) authStore.logout(); };

onMounted(async () => {
  const isLoggedIn = authStore.initAuth();
  if (isLoggedIn) await portfolioStore.fetchAll();
  await nextTick();
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) setTimeout(() => { loadingEl.style.opacity = '0'; setTimeout(() => loadingEl.remove(), 300); }, 500);
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --bg-app: #f1f5f9; --bg-card: #ffffff; --bg-secondary: #f8fafc; --primary: #3b82f6; --primary-dark: #2563eb;
  --text-main: #0f172a; --text-sub: #64748b; --border-color: #e2e8f0; --success: #10b981; --danger: #ef4444;
  --warning: #f59e0b; --radius: 16px; --radius-sm: 8px; --radius-md: 12px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05); --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1); --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

html.dark {
  --bg-app: #0f172a; --bg-card: #1e293b; --bg-secondary: #334155; --primary: #60a5fa; --primary-dark: #3b82f6;
  --text-main: #f1f5f9; --text-sub: #94a3b8; --border-color: #334155;
}

* { box-sizing: border-box; }
body { background-color: var(--bg-app); color: var(--text-main); font-family: 'Inter', sans-serif; margin: 0; font-size: 18px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
.app-layout.dark-mode { background-color: var(--bg-app); color: var(--text-main); }
.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
.top-nav { background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 0 32px; height: 64px; display: flex; align-items: center; justify-content: space-between; z-index: 100; box-shadow: var(--shadow-sm); }
.nav-brand { display: flex; align-items: center; gap: 12px; }
.nav-brand h1 { font-size: 1.3rem; font-weight: 700; margin: 0; color: var(--text-main); }
.badge { background: var(--text-main); color: var(--bg-card); font-size: 0.65rem; padding: 2px 8px; border-radius: 99px; }

/* ✅ Benchmark Selector 樣式 */
.benchmark-selector, .group-selector { display: flex; align-items: center; gap: 8px; background: var(--bg-secondary); padding: 4px 12px; border-radius: 8px; border: 1px solid var(--border-color); }
.benchmark-selector { border-left: 4px solid var(--primary); }
.selector-label { font-size: 0.8rem; color: var(--text-sub); font-weight: 600; white-space: nowrap; }
.select-wrapper { display: flex; gap: 6px; align-items: center; }
.select-wrapper select { background: transparent; border: none; font-size: 0.9rem; color: var(--text-main); font-weight: 600; cursor: pointer; outline: none; }
.custom-ticker-mini { width: 80px; padding: 2px 6px; font-size: 0.8rem; border: 1px solid var(--primary); border-radius: 4px; background: var(--bg-card); color: var(--text-main); text-transform: uppercase; }

.btn-edit-group { background: transparent; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-sub); font-size: 0.75rem; padding: 2px 6px; }

.nav-status { display: flex; align-items: center; gap: 16px; }
.status-indicator { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 600; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.status-indicator.polling { color: var(--warning); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.polling .pulse-orange { animation: pulse-orange 1.2s infinite; }
@keyframes pulse-orange { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }

.action-trigger-btn { background: var(--primary); color: white; border: none; border-radius: 8px; padding: 6px 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; }
.action-trigger-btn:hover:not(:disabled) { background: var(--primary-dark); transform: translateY(-1px); }
.action-trigger-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.theme-toggle { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.user-profile { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.avatar { width: 32px; height: 32px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
.avatar-img { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border-color); }
.logout-text { font-size: 0.85rem; font-weight: 600; color: var(--text-sub); }

.content-container { max-width: 1600px; margin: 0 auto; padding: 24px; display: grid; grid-template-columns: 1fr 360px; gap: 24px; }
.main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.side-column { position: sticky; top: 24px; height: fit-content; }
.sticky-panel { display: flex; flex-direction: column; gap: 24px; }
.card, .chart-wrapper { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow-card); }
.chart-wrapper.chart-full { height: 450px; width: 100%; padding: 0; overflow: hidden; }

.toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid var(--primary); padding: 12px 16px; border-radius: 8px; box-shadow: var(--shadow-lg); display: flex; gap: 10px; cursor: pointer; min-width: 260px; }
.toast.success { border-left-color: var(--success); }
.toast.error { border-left-color: var(--danger); }
.toast-msg { font-size: 0.9rem; font-weight: 600; }

@media (max-width: 1200px) {
  .content-container { grid-template-columns: 1fr; }
  .side-column { position: static; order: -1; }
  .benchmark-selector, .group-selector { padding: 4px 8px; }
  .selector-label { display: none; }
}
@media (max-width: 768px) {
  .top-nav { padding: 0 12px; }
  .nav-brand h1 { display: none; }
  .nav-status { gap: 8px; }
  .benchmark-selector { display: none; }
}
</style>
