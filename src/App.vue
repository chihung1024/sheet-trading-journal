<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
          <span class="logo-icon">📊</span>
          <h1>Trading Journal <span class="badge">PRO</span></h1>
        </div>

        <div class="group-selector" v-if="portfolioStore.availableGroups.length > 1">
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
          <div v-if="portfolioStore.loading" class="status-indicator loading">
            <span class="dot"></span> <span class="status-text">更新中...</span>
          </div>
          
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling">
            <span class="dot pulse-orange"></span> <span class="status-text">計算中...</span>
          </div>
          
          <div v-else class="status-indicator ready">
            <span class="dot"></span> <span class="status-text">連線正常</span>
          </div>
          
          <button 
            class="action-trigger-btn" 
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
            :title="portfolioStore.isPolling ? '系統正在背景計算中...' : '手動觸發投資組合數據更新'"
          >
            <span class="btn-icon">⚙️</span>
            <span class="btn-text">更新數據</span>
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
    addToast("✅ 已觸發！系統將在背景監控,更新完成後自動刷新。", "success");
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --bg-app: #f8fafc;
  --bg-card: #ffffff;
  --bg-secondary: #f1f5f9;
  --bg-tertiary: #e2e8f0;
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --primary-light: #60a5fa;
  --text-main: #0f172a;
  --text-sub: #64748b;
  --text-muted: #94a3b8;
  --border-color: #e2e8f0;
  --border-light: #f1f5f9;
  --success: #10b981;
  --success-light: #34d399;
  --danger: #ef4444;
  --danger-light: #f87171;
  --warning: #f59e0b;
  --warning-light: #fbbf24;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08);
  --radius: 16px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
}

html.dark {
  --bg-app: #0a0e1a;
  --bg-card: #1a1f2e;
  --bg-secondary: #252b3d;
  --bg-tertiary: #2d3548;
  --primary: #60a5fa;
  --primary-dark: #3b82f6;
  --primary-light: #93c5fd;
  --text-main: #f1f5f9;
  --text-sub: #94a3b8;
  --text-muted: #64748b;
  --border-color: #2d3548;
  --border-light: #252b3d;
  --success: #34d399;
  --success-light: #6ee7b7;
  --danger: #f87171;
  --danger-light: #fca5a5;
  --warning: #fbbf24;
  --warning-light: #fcd34d;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.5);
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.5), 0 1px 2px -1px rgb(0 0 0 / 0.5);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5);
}

* { 
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

body { 
  background-color: var(--bg-app);
  color: var(--text-main);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.3s ease, color 0.3s ease;
  overflow-x: hidden;
}

.main-wrapper { 
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ===== 導航欄 ===== */
.top-nav { 
  background: var(--bg-card);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  padding: 0 32px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
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
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-main);
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.badge { 
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  font-size: 0.65rem;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 700;
  letter-spacing: 0.05em;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.logo-icon { 
  font-size: 1.6rem;
  filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3));
}

/* ===== 群組選擇器 ===== */
.group-selector { 
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 20px;
  background: var(--bg-secondary);
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.group-selector:hover {
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.selector-label { 
  font-size: 0.85rem;
  color: var(--text-sub);
  font-weight: 600;
  white-space: nowrap;
}

.select-wrapper { 
  display: flex;
  gap: 8px;
  align-items: center;
}

.select-wrapper select { 
  background: transparent;
  border: none;
  font-size: 0.95rem;
  color: var(--text-main);
  font-weight: 600;
  cursor: pointer;
  outline: none;
  padding: 0;
}

.btn-edit-group { 
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-sub);
  font-size: 0.85rem;
  padding: 4px 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-edit-group:hover { 
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  transform: translateY(-1px);
}

/* ===== Modal ===== */
.modal-overlay { 
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-card { 
  background: var(--bg-card);
  padding: 28px;
  border-radius: var(--radius);
  width: 440px;
  max-width: 90%;
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-card h3 {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}

.modal-desc { 
  font-size: 0.9rem;
  color: var(--text-sub);
  margin-bottom: 20px;
  line-height: 1.5;
}

.group-list { 
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.group-item { 
  display: flex;
  gap: 10px;
}

.group-item input { 
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-main);
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.group-item input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-sm { 
  padding: 10px 18px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-sm:hover:not(:disabled) { 
  background: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.btn-sm:disabled { 
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-footer { 
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.modal-footer button { 
  padding: 10px 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-main);
  font-weight: 600;
  transition: all 0.2s ease;
}

.modal-footer button:hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
}

/* ===== 狀態指示器 ===== */
.nav-status { 
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.95rem;
  font-weight: 500;
}

.status-indicator { 
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  transition: all 0.2s ease;
}

.status-indicator.ready { 
  color: var(--success);
  background: rgba(16, 185, 129, 0.1);
}

.status-indicator.loading { 
  color: var(--primary);
  background: rgba(59, 130, 246, 0.1);
}

.status-indicator.polling { 
  color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
}

.dot { 
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.loading .dot { 
  animation: pulse 1.5s infinite;
}

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

/* ===== 按鈕 ===== */
.theme-toggle { 
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 42px;
  height: 42px;
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
  transform: translateY(-2px) rotate(15deg);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.action-trigger-btn { 
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  border: none;
  border-radius: 10px;
  color: white;
  padding: 10px 16px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.action-trigger-btn:hover:not(:disabled) { 
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.action-trigger-btn:disabled { 
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  filter: grayscale(0.3);
}

.btn-icon { font-size: 1.1rem; }
.btn-text { white-space: nowrap; }

/* ===== 用戶頭像 ===== */
.user-profile { 
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.user-profile:hover { 
  background: var(--bg-secondary);
}

.avatar { 
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: white;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.avatar-img { 
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logout-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-sub);
}

/* ===== 內容區域 ===== */
.content-container { 
  max-width: 1600px;
  margin: 0 auto;
  padding: 32px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 28px;
  width: 100%;
  align-items: start;
}

.main-column { 
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
}

.side-column { 
  min-width: 0;
}

.sticky-panel { 
  position: sticky;
  top: 96px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: calc(100vh - 128px);
  overflow-y: auto;
  overflow-x: hidden;
}

/* ===== 卡片 ===== */
.card, .chart-wrapper { 
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow-card);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.card:hover::before {
  opacity: 1;
}

.card:hover { 
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.chart-wrapper { 
  height: 420px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.chart-wrapper.chart-full { 
  height: 520px;
  width: 100%;
}

.card h3 { 
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 20px 0;
  letter-spacing: -0.01em;
}

/* ===== 配息提醒 ===== */
.dividend-alert { 
  border-left: 4px solid var(--warning);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.03));
  backdrop-filter: blur(10px);
}

.alert-header { 
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.alert-header h4 { 
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-main);
}

.alert-icon { 
  font-size: 1.4rem;
  animation: ring 2s infinite;
}

@keyframes ring {
  0%, 100% { transform: rotate(0deg); }
  10%, 30% { transform: rotate(-10deg); }
  20%, 40% { transform: rotate(10deg); }
}

.alert-text { 
  margin: 0 0 16px 0;
  font-size: 0.95rem;
  color: var(--text-sub);
  line-height: 1.6;
}

.alert-text strong { 
  color: var(--warning);
  font-weight: 700;
}

.btn-alert { 
  width: 100%;
  padding: 12px;
  background: var(--warning);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.95rem;
}

.btn-alert:hover { 
  background: var(--warning-light);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
}

/* ===== 表格 ===== */
table { 
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

th { 
  text-align: left;
  color: var(--text-sub);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  padding: 14px 16px;
  border-bottom: 2px solid var(--border-color);
  background: var(--bg-secondary);
  white-space: nowrap;
}

th:first-child { border-top-left-radius: var(--radius-sm); }
th:last-child { border-top-right-radius: var(--radius-sm); }

td { 
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.95rem;
  color: var(--text-main);
  vertical-align: middle;
}

tr:last-child td { border-bottom: none; }

tr:hover td { 
  background-color: var(--bg-secondary);
  transition: background 0.15s ease;
}

/* ===== Toast 通知 ===== */
.toast-container { 
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 380px;
}

.toast { 
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-left: 4px solid transparent;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  display: flex;
  gap: 12px;
  cursor: pointer;
  min-width: 320px;
  backdrop-filter: blur(10px);
  animation: slideInRight 0.3s ease;
}

@keyframes slideInRight { 
  from { 
    transform: translateX(100%);
    opacity: 0;
  } 
  to { 
    transform: translateX(0);
    opacity: 1;
  } 
}

.toast.success { 
  border-left-color: var(--success);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), var(--bg-card));
}

.toast.error { 
  border-left-color: var(--danger);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.05), var(--bg-card));
}

.toast-icon { 
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.toast.success .toast-icon { 
  background: linear-gradient(135deg, var(--success), var(--success-light));
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.toast.error .toast-icon { 
  background: linear-gradient(135deg, var(--danger), var(--danger-light));
  color: white;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.toast-msg { 
  font-size: 0.95rem;
  color: var(--text-main);
  font-weight: 500;
  line-height: 1.5;
  flex: 1;
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
  transform: translateX(100%) scale(0.8);
  opacity: 0;
}

/* ========================================
   📱 手機端優化 (不影響桌面端)
   ======================================== */

@media (max-width: 1024px) {
  .content-container { 
    grid-template-columns: 1fr;
    padding: 20px;
    gap: 20px;
  }
  
  .side-column { order: -1; }
  
  .sticky-panel { 
    position: static;
    max-height: none;
    overflow-y: visible;
  }
  
  .main-column { gap: 20px; }
  .desktop-only { display: none; }
}

@media (max-width: 768px) {
  /* 📱 導航欄 */
  .top-nav { 
    padding: 0 16px;
    height: 64px;
  }
  
  .nav-brand h1 { 
    font-size: 1.2rem;
  }
  
  .logo-icon { 
    font-size: 1.4rem;
  }
  
  .badge { 
    font-size: 0.6rem;
    padding: 2px 6px;
  }
  
  /* 📱 群組選擇器 */
  .group-selector { 
    margin: 0 8px;
    padding: 8px 12px;
    border-radius: 8px;
  }
  
  .selector-label { 
    display: none;
  }
  
  .select-wrapper select { 
    font-size: 0.9rem;
  }
  
  /* 📱 狀態指示器 */
  .nav-status { 
    gap: 10px;
  }
  
  .status-indicator { 
    padding: 6px 10px;
    font-size: 0.85rem;
  }
  
  .status-text {
    display: none;
  }
  
  /* 📱 按鈕 */
  .action-trigger-btn { 
    padding: 10px 14px;
    font-size: 0.9rem;
    border-radius: 8px;
  }
  
  .theme-toggle { 
    width: 40px;
    height: 40px;
  }
  
  .avatar,
  .avatar-img { 
    width: 36px;
    height: 36px;
  }
  
  /* 📱 內容區域 */
  .content-container { 
    padding: 16px;
    gap: 16px;
  }
  
  .main-column { 
    gap: 16px;
  }
  
  /* 📱 卡片 */
  .card { 
    padding: 18px;
    border-radius: var(--radius-md);
  }
  
  .card h3 { 
    font-size: 1.05rem;
    margin-bottom: 16px;
  }
  
  .chart-wrapper.chart-full { 
    height: 360px;
  }
  
  /* 📱 表格 */
  th { 
    font-size: 0.7rem;
    padding: 12px 14px;
  }
  
  td { 
    padding: 14px;
    font-size: 0.9rem;
  }
  
  /* 📱 Toast */
  .toast-container { 
    bottom: 20px;
    right: 16px;
    left: 16px;
    max-width: none;
  }
  
  .toast { 
    min-width: auto;
    width: 100%;
    padding: 14px 16px;
  }
  
  /* 📱 Modal */
  .modal-card { 
    width: calc(100% - 32px);
    padding: 24px;
  }
}

@media (max-width: 480px) {
  /* 📱 導航欄極簡模式 */
  .top-nav { 
    padding: 0 12px;
    height: 60px;
  }
  
  .nav-brand h1 { 
    font-size: 1.05rem;
  }
  
  .badge { 
    display: none;
  }
  
  .logo-icon { 
    font-size: 1.3rem;
  }
  
  /* 📱 隱藏次要狀態 */
  .status-indicator:not(.loading):not(.polling) { 
    display: none;
  }
  
  /* 📱 按鈕簡化 */
  .action-trigger-btn { 
    padding: 10px;
    min-width: 40px;
    border-radius: 8px;
  }
  
  .btn-text { 
    display: none;
  }
  
  .btn-icon { 
    font-size: 1.2rem;
  }
  
  .theme-toggle { 
    width: 38px;
    height: 38px;
    font-size: 1.1rem;
  }
  
  /* 📱 群組選擇器固定底部 */
  .group-selector { 
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 0;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
    padding: 14px 16px;
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
    z-index: 50;
    justify-content: center;
  }
  
  .select-wrapper { 
    gap: 12px;
  }
  
  .select-wrapper select { 
    font-size: 0.95rem;
    font-weight: 600;
  }
  
  /* 📱 預留空間 */
  .main-wrapper { 
    padding-bottom: 72px;
  }
  
  /* 📱 內容調整 */
  .content-container { 
    padding: 12px;
    gap: 12px;
  }
  
  .main-column { 
    gap: 12px;
  }
  
  .card { 
    padding: 16px;
    border-radius: 12px;
  }
  
  .chart-wrapper.chart-full { 
    height: 300px;
  }
  
  /* 📱 Toast 緊湊 */
  .toast { 
    padding: 12px 14px;
    border-radius: 10px;
  }
  
  .toast-icon { 
    width: 24px;
    height: 24px;
    font-size: 0.85rem;
  }
  
  .toast-msg { 
    font-size: 0.9rem;
  }
}

/* ===== 觸控優化 ===== */
@media (hover: none) and (pointer: coarse) {
  button,
  a,
  .clickable { 
    min-height: 44px;
    min-width: 44px;
  }
  
  tr { 
    cursor: pointer;
  }
  
  td { 
    padding: 16px 12px;
  }
  
  .card:hover,
  .btn:hover,
  .theme-toggle:hover,
  .user-profile:hover,
  .action-trigger-btn:hover {
    transform: none;
  }
  
  button:active:not(:disabled),
  .btn:active,
  .card:active {
    transform: scale(0.98);
    opacity: 0.9;
  }
  
  .theme-toggle:active {
    transform: scale(0.95);
  }
}

/* ===== Scrollbar 美化 ===== */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
  transition: background 0.2s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) var(--bg-secondary);
}
</style>