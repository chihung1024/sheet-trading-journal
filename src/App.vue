<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <Transition name="fade">
      <LoginOverlay v-if="!authStore.token" />
    </Transition>
    
    <div v-else class="main-wrapper">
      <header class="top-nav glass-effect">
        <div class="nav-brand">
          <span class="logo-icon animate-bounce-slow">📊</span>
          <h1>Trading Journal <span class="badge">PRO</span></h1>
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
            <button class="btn-icon btn-edit-group" @click="showGroupModal=true" title="管理群組名稱">
              ✎
            </button>
          </div>
        </div>

        <div class="nav-status">
          <div v-if="portfolioStore.loading" class="status-indicator loading">
            <span class="dot"></span> <span class="status-text desktop-only">更新中...</span>
          </div>
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling">
            <span class="dot pulse-orange"></span> <span class="status-text desktop-only">計算中...</span>
          </div>
          <div v-else class="status-indicator ready">
            <span class="dot"></span> <span class="status-text desktop-only">連線正常</span>
          </div>
          
          <button 
            class="action-trigger-btn hover-scale active-press" 
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
            :title="portfolioStore.isPolling ? '系統正在背景計算中...' : '手動觸發投資組合數據更新'"
          >
            <span class="btn-icon" :class="{ 'animate-spin': portfolioStore.isPolling }">⚙️</span>
            <span class="btn-text desktop-only">更新數據</span>
          </button>
          
          <button class="theme-toggle hover-rotate" @click="toggleTheme" :title="isDark ? '切換為淺色模式' : '切換為深色模式'">
            <Transition name="scale" mode="out-in">
              <span v-if="isDark" key="dark">☀️</span>
              <span v-else key="light">🌙</span>
            </Transition>
          </button>
          
          <div class="user-profile hover-lift" @click="handleLogout" title="點擊登出">
            <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="avatar-img" alt="User">
            <div v-else class="avatar">{{ userInitial }}</div>
            <span class="logout-text desktop-only">登出</span>
          </div>
        </div>
      </header>
      
      <Transition name="fade">
        <div v-if="showGroupModal" class="modal-overlay" @click.self="showGroupModal=false">
          <div class="modal-card slide-up-enter-active">
            <div class="modal-header">
              <h3>管理策略群組</h3>
              <button class="btn-close" @click="showGroupModal=false">✕</button>
            </div>
            <p class="modal-desc">修改群組名稱將會批次更新所有相關的交易紀錄。</p>
            
            <div class="group-list custom-scrollbar">
              <div v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" class="group-item">
                <input type="text" v-model="groupRenameMap[g]" :placeholder="g">
                <button @click="renameGroup(g)" class="btn-sm btn-primary" :disabled="!groupRenameMap[g] || groupRenameMap[g]===g">
                  更名
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" @click="showGroupModal=false">關閉</button>
            </div>
          </div>
        </div>
      </Transition>

      <div class="content-container">
        <main class="main-column">
          <section class="section-stats">
            <Transition name="fade" mode="out-in">
              <StatsGrid v-if="!portfolioStore.loading" />
              <StatsGridSkeleton v-else />
            </Transition>
          </section>
          
          <section class="section-charts">
            <div class="chart-wrapper chart-full hover-lift-sm">
              <Transition name="fade" mode="out-in">
                <PerformanceChart v-if="!portfolioStore.loading" />
                <ChartSkeleton v-else />
              </Transition>
            </div>
          </section>
          
          <section class="section-holdings">
            <Transition name="fade" mode="out-in">
              <HoldingsTable v-if="!portfolioStore.loading" />
              <TableSkeleton v-else />
            </Transition>
          </section>
          
          <section class="section-records">
            <Transition name="fade" mode="out-in">
              <RecordList v-if="!portfolioStore.loading" @edit="handleEditRecord" />
              <TableSkeleton v-else />
            </Transition>
          </section>
          
          <section class="section-dividends" v-if="!portfolioStore.loading && hasPendingDividends">
            <DividendManager />
          </section>
        </main>
        
        <aside class="side-column">
          <div class="sticky-panel">
            <div class="card hover-lift-sm">
              <TradeForm ref="tradeFormRef" />
            </div>
            
            <Transition name="slide-up">
              <div v-if="hasPendingDividends" class="dividend-alert card animate-pulse-border">
                <div class="alert-header">
                  <span class="alert-icon animate-bounce">🔔</span>
                  <h4>待確認配息</h4>
                </div>
                <p class="alert-text">
                  您有 <strong>{{ pendingDividendsCount }}</strong> 筆配息待確認
                </p>
                <button class="btn-alert hover-scale" @click="scrollToDividends">
                  前往確認
                </button>
              </div>
            </Transition>
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

// Components
import LoginOverlay from './components/LoginOverlay.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import DividendManager from './components/DividendManager.vue';

// Skeletons
import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { toasts, removeToast, addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();
const { needRefresh, updateServiceWorker } = usePWA();

// UI States
const showGroupModal = ref(false);
const groupRenameMap = reactive({});

// Computed
const hasPendingDividends = computed(() => {
  return portfolioStore.pending_dividends && portfolioStore.pending_dividends.length > 0;
});

const pendingDividendsCount = computed(() => {
  return portfolioStore.pending_dividends ? portfolioStore.pending_dividends.length : 0;
});

const userInitial = computed(() => {
  return authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U';
});

// Methods
const scrollToDividends = () => {
  const dividendSection = document.querySelector('.section-dividends');
  if (dividendSection) {
    dividendSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    // 優化移動端滾動體驗
    if (window.innerWidth < 1024) {
      const formEl = document.querySelector('.side-column');
      if(formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};

const handleLogout = () => {
  if (confirm("確定要登出系統嗎？")) {
    authStore.logout();
  }
};

onMounted(async () => {
  console.log('🚀 App.vue mounted with Enhanced UI');
  const isLoggedIn = authStore.initAuth();
  if (isLoggedIn) {
    await portfolioStore.fetchAll();
  }
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

/* 全局變量：金融科技風格配色 */
:root {
  /* 背景與基底 */
  --bg-app: #f8fafc;
  --bg-card: #ffffff;
  --bg-secondary: #f1f5f9;
  --bg-modal-overlay: rgba(15, 23, 42, 0.4);
  
  /* 主色調 */
  --primary: #2563eb;        /* Royal Blue */
  --primary-dark: #1d4ed8;
  --primary-light: #eff6ff;
  
  /* 文字 */
  --text-main: #0f172a;
  --text-sub: #64748b;
  --text-muted: #94a3b8;
  
  /* 功能色 */
  --success: #10b981;
  --success-bg: #ecfdf5;
  --danger: #ef4444;
  --danger-bg: #fef2f2;
  --warning: #f59e0b;
  --warning-bg: #fffbeb;
  
  /* 邊框與裝飾 */
  --border-color: #e2e8f0;
  --border-highlight: #cbd5e1;
  
  /* 陰影系統 */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-float: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04);
  --shadow-glow: 0 0 15px rgba(37, 99, 235, 0.1);
  
  /* 圓角 */
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 8px;
}

/* 深色模式：高對比與護眼 */
html.dark {
  --bg-app: #0f172a;        /* Slate 900 */
  --bg-card: #1e293b;       /* Slate 800 */
  --bg-secondary: #334155;  /* Slate 700 */
  --bg-modal-overlay: rgba(0, 0, 0, 0.7);
  
  --primary: #60a5fa;       /* Blue 400 */
  --primary-dark: #3b82f6;
  --primary-light: rgba(96, 165, 250, 0.1);
  
  --text-main: #f8fafc;
  --text-sub: #cbd5e1;
  --text-muted: #64748b;
  
  --border-color: #334155;
  --border-highlight: #475569;
  
  --success: #34d399;
  --success-bg: rgba(16, 185, 129, 0.1);
  --danger: #f87171;
  --danger-bg: rgba(239, 68, 68, 0.1);
  --warning: #fbbf24;
  --warning-bg: rgba(245, 158, 11, 0.1);
  
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2);
  --shadow-float: 0 20px 25px -5px rgb(0 0 0 / 0.4), 0 10px 10px -5px rgb(0 0 0 / 0.3);
  --shadow-glow: 0 0 15px rgba(96, 165, 250, 0.15);
}

/* 基礎重置 */
* { box-sizing: border-box; }
body { 
  background-color: var(--bg-app); 
  color: var(--text-main); 
  font-family: 'Inter', system-ui, -apple-system, sans-serif; 
  margin: 0; 
  font-size: 16px; 
  line-height: 1.5; 
  -webkit-font-smoothing: antialiased; 
  transition: background-color 0.3s ease, color 0.3s ease; 
  overflow-x: hidden; 
}

/* 布局結構 */
.main-wrapper { 
  min-height: 100vh; 
  display: flex; 
  flex-direction: column; 
}

/* 導航欄 - 玻璃擬態 */
.top-nav { 
  position: sticky;
  top: 0;
  height: 64px; 
  padding: 0 24px; 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  z-index: 100; 
  transition: all 0.3s ease;
  border-bottom: 1px solid var(--border-color);
}
.glass-effect {
  background: rgba(var(--bg-card-rgb), 0.85); /* Fallback */
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
/* Dark mode glass transparency fix */
html.dark .glass-effect {
  background: rgba(30, 41, 59, 0.85);
}
html:not(.dark) .glass-effect {
  background: rgba(255, 255, 255, 0.85);
}

/* 品牌標識 */
.nav-brand { display: flex; align-items: center; gap: 10px; min-width: max-content; }
.nav-brand h1 { font-size: 1.25rem; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
.badge { 
  background: var(--primary); 
  color: white; 
  font-size: 0.65rem; 
  padding: 2px 6px; 
  border-radius: 4px; 
  font-weight: 700; 
  margin-left: 4px; 
  vertical-align: middle; 
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
}

/* 群組選擇器 */
.group-selector { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  background: var(--bg-secondary); 
  padding: 4px 8px; 
  border-radius: var(--radius-sm); 
  border: 1px solid var(--border-color); 
  margin: 0 16px;
  flex: 0 1 auto;
}
.selector-label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; white-space: nowrap; }
.select-wrapper { display: flex; gap: 4px; align-items: center; }
.select-wrapper select { 
  background: transparent; 
  border: none; 
  font-size: 0.9rem; 
  color: var(--text-main); 
  font-weight: 500; 
  cursor: pointer; 
  outline: none; 
  max-width: 150px;
  text-overflow: ellipsis;
}

/* 狀態區 */
.nav-status { display: flex; align-items: center; gap: 16px; }
.status-indicator { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; font-weight: 500; white-space: nowrap; }
.status-indicator.ready { color: var(--success); }
.status-indicator.loading { color: var(--primary); }
.status-indicator.polling { color: var(--warning); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.pulse-orange { animation: pulse 1.5s infinite; }

/* 按鈕群組 */
.action-trigger-btn { 
  background: linear-gradient(135deg, var(--primary), var(--primary-dark)); 
  border: none; 
  border-radius: var(--radius-sm); 
  color: white; 
  padding: 8px 16px; 
  font-weight: 600; 
  font-size: 0.9rem; 
  cursor: pointer; 
  display: flex; 
  align-items: center; 
  gap: 6px; 
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}
.action-trigger-btn:disabled { opacity: 0.7; cursor: not-allowed; filter: grayscale(0.5); }

.theme-toggle { 
  background: transparent; 
  border: none; 
  color: var(--text-sub);
  width: 36px; height: 36px; 
  display: flex; align-items: center; justify-content: center; 
  cursor: pointer; 
  border-radius: 50%;
  font-size: 1.2rem;
}
.theme-toggle:hover { background: var(--bg-secondary); color: var(--warning); }

/* 用戶頭像 */
.user-profile { 
  display: flex; align-items: center; gap: 8px; 
  cursor: pointer; padding: 4px 8px; 
  border-radius: 99px; 
  transition: background 0.2s; 
  border: 1px solid transparent;
}
.user-profile:hover { background: var(--bg-secondary); border-color: var(--border-color); }
.avatar { width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 0.9rem; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.avatar-img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.logout-text { font-size: 0.85rem; color: var(--text-sub); font-weight: 500; }

/* 內容容器 */
.content-container { 
  max-width: 1600px; 
  margin: 0 auto; 
  padding: 24px 32px; 
  display: grid; 
  grid-template-columns: minmax(0, 1fr) 380px; 
  gap: 24px; 
  width: 100%; 
  align-items: start;
}
.main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.side-column { min-width: 380px; }
.sticky-panel { 
  position: sticky; 
  top: 88px; /* header height + gap */
  display: flex; 
  flex-direction: column; 
  gap: 24px; 
  max-height: calc(100vh - 110px); 
  overflow-y: auto; 
  padding-bottom: 20px;
  /* Hide scrollbar */
  scrollbar-width: none; 
}
.sticky-panel::-webkit-scrollbar { display: none; }

/* 通用卡片樣式 */
.card, .chart-wrapper { 
  background: var(--bg-card); 
  border: 1px solid var(--border-color); 
  border-radius: var(--radius-lg); 
  padding: 24px; 
  box-shadow: var(--shadow-card); 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.chart-wrapper { padding: 0; overflow: hidden; height: 450px; }
.chart-wrapper.chart-full { height: 500px; }

/* 警示卡片 */
.dividend-alert { 
  border-left: 4px solid var(--warning); 
  background: var(--warning-bg); 
  border-color: rgba(245, 158, 11, 0.2);
}
.dividend-alert h4 { margin: 0; color: #b45309; }
.alert-text { color: #92400e; margin: 8px 0 16px 0; }
.btn-alert { width: 100%; padding: 10px; background: var(--warning); color: white; border: none; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; }

/* Modal */
.modal-overlay { 
  position: fixed; inset: 0; 
  background: var(--bg-modal-overlay); 
  backdrop-filter: blur(4px);
  z-index: 999; 
  display: flex; align-items: center; justify-content: center; 
}
.modal-card { 
  background: var(--bg-card); 
  width: 400px; max-width: 90%; 
  border-radius: var(--radius-lg); 
  box-shadow: var(--shadow-float);
  padding: 24px;
  border: 1px solid var(--border-highlight);
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.modal-header h3 { margin: 0; font-size: 1.2rem; }
.btn-close { background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-sub); }
.group-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.group-item { display: flex; gap: 8px; }
.group-item input { flex: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-secondary); color: var(--text-main); }
.btn-primary { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; }

/* Toast */
.toast-container { position: fixed; bottom: 32px; right: 32px; z-index: 9999; display: flex; flex-direction: column; gap: 12px; }
.toast { background: var(--bg-card); border-left: 4px solid transparent; padding: 14px 18px; border-radius: var(--radius-md); box-shadow: var(--shadow-float); display: flex; gap: 12px; cursor: pointer; min-width: 300px; border: 1px solid var(--border-color); }
.toast.success { border-left-color: var(--success); }
.toast.error { border-left-color: var(--danger); }
.toast.info { border-left-color: var(--primary); }
.toast-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
.toast.success .toast-icon { background: var(--success-bg); color: var(--success); }
.toast.error .toast-icon { background: var(--danger-bg); color: var(--danger); }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s ease; }
.toast-slide-enter-from, .toast-slide-leave-to { transform: translateX(100%); opacity: 0; }

/* 動畫輔助類 (從 animations.css 延伸) */
.hover-lift-sm { transition: transform 0.2s; }
.hover-lift-sm:hover { transform: translateY(-3px); }
.animate-bounce-slow { animation: bounce 3s infinite; }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

/* RWD 響應式設計 */
@media (max-width: 1280px) {
  .content-container { padding: 20px; gap: 20px; }
  .side-column { min-width: 340px; }
}

@media (max-width: 1024px) {
  .content-container { grid-template-columns: 1fr; }
  .side-column { 
    order: -1; 
    min-width: 100%;
    margin-bottom: 20px;
  }
  .sticky-panel { 
    position: static; 
    max-height: none; 
    overflow: visible;
  }
  .desktop-only { display: none; }
  .chart-wrapper.chart-full { height: 400px; }
}

@media (max-width: 768px) {
  .top-nav { padding: 0 16px; height: 56px; }
  .nav-brand h1 { font-size: 1.1rem; }
  .group-selector { margin: 0 8px; }
  .action-trigger-btn { padding: 6px 10px; }
  .content-container { padding: 16px; }
  .chart-wrapper.chart-full { height: 350px; }
  .toast-container { bottom: 16px; right: 16px; left: 16px; }
  .toast { min-width: auto; }
}

@media (max-width: 480px) {
  .nav-brand h1 span.badge { display: none; } /* 極小螢幕隱藏 badge */
  .select-wrapper select { max-width: 100px; }
  .group-selector { padding: 4px; }
  .btn-edit-group { display: none; } /* 手機版暫隱藏更名按鈕以節省空間 */
  .status-indicator:not(.loading):not(.ready):not(.polling) { display: none; }
  .chart-wrapper.chart-full { height: 300px; }
}
</style>
