<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark, 'is-mobile': isMobile }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
          <span class="logo-icon">📊</span>
          <h1 class="desktop-only">Trading Journal <span class="badge">PRO</span></h1>
        </div>

        <div class="group-selector" v-if="portfolioStore.availableGroups.length > 1">
          <span class="selector-label desktop-only">策略群組:</span>
          <div class="select-wrapper">
            <select :value="portfolioStore.currentGroup" @change="e => portfolioStore.setGroup(e.target.value)">
              <option value="all">{{ isMobile ? '全部持倉' : '全部 (All Portfolios)' }}</option>
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
          <div v-if="portfolioStore.loading" class="status-indicator loading" title="更新中...">
            <span class="dot"></span> <span class="desktop-only">更新中...</span>
          </div>
          
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling" title="計算中...">
            <span class="dot pulse-orange"></span> <span class="desktop-only">計算中...</span>
          </div>
          
          <div v-else class="status-indicator ready desktop-only">
            <span class="dot"></span> 連線正常
          </div>
          
          <button 
            class="action-trigger-btn" 
            @click="handleTriggerUpdate"
            :disabled="portfolioStore.isPolling"
            :title="portfolioStore.isPolling ? '系統正在背景計算中...' : '手動觸發數據更新'"
          >
            <span>⚙️</span>
            <span class="desktop-only">更新數據</span>
          </button>
          
          <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '淺色模式' : '深色模式'">
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
import { usePWA } from './composables/usePWA';
import { ref, onMounted, onUnmounted, computed, nextTick, reactive } from 'vue';
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

// ✅ 手機版偵測邏輯
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);

const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

// 群組管理
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
  if(!newName || !confirm(`確定將 "${oldName}" 更名為 "${newName}" 嗎？`)) return;
  
  addToast('正在處理中...', 'info');
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
        headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
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
  if (portfolioStore.isPolling) return;
  if (!confirm("確定要觸發後端計算嗎？")) return;
  
  try {
    addToast("🚀 正在請求更新...", "info");
    await portfolioStore.triggerUpdate();
    addToast("✅ 已觸發計算，請稍候刷新。", "success");
  } catch (error) {
    addToast(`❌ 失敗: ${error.message}`, "error");
  }
};

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    // 捲動到表單位置 (手機版)
    if (isMobile.value) {
      setTimeout(() => {
        document.querySelector('.side-column')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
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
  window.addEventListener('resize', handleResize);
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

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
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
  --radius: 12px;
  --radius-sm: 8px;
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

html.dark {
  --bg-app: #0f172a;
  --bg-card: #1e293b;
  --bg-secondary: #0f172a;
  --text-main: #f1f5f9;
  --text-sub: #94a3b8;
  --border-color: #334155;
}

* { box-sizing: border-box; }

/* ✅ 全域字體大小優化：手機版縮小以增加容納空間 */
body { 
  background-color: var(--bg-app); 
  color: var(--text-main); 
  font-family: 'Inter', sans-serif; 
  margin: 0; 
  font-size: 16px; /* 桌面預設從 18px 改為 16px */
  line-height: 1.5; 
  transition: background-color 0.3s ease;
}

.main-wrapper { min-height: 100vh; display: flex; flex-direction: column; }

/* ✅ Top Nav：增加手機版適配性 */
.top-nav { 
  background: var(--bg-card); 
  border-bottom: 1px solid var(--border-color); 
  padding: 0 16px; 
  height: 60px; /* 稍微縮小高度 */
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.nav-brand { display: flex; align-items: center; gap: 8px; }
.logo-icon { font-size: 1.4rem; }

/* ✅ 群組選擇器：手機版移除標籤，縮小寬度 */
.group-selector { 
  display: flex; 
  align-items: center; 
  gap: 6px; 
  background: var(--bg-secondary); 
  padding: 4px 10px; 
  border-radius: 8px; 
  border: 1px solid var(--border-color);
  max-width: 150px;
}

.select-wrapper select { 
  background: transparent; 
  border: none; 
  font-size: 0.9rem; 
  color: var(--text-main); 
  font-weight: 600; 
  outline: none;
  width: 100%;
}

.nav-status { display: flex; align-items: center; gap: 12px; }

/* ✅ 按鈕優化：手機版僅顯示圖示 */
.action-trigger-btn { 
  background: var(--primary); 
  border: none; 
  border-radius: 8px; 
  color: white; 
  padding: 8px 10px; 
  font-weight: 600; 
  cursor: pointer;
}

.theme-toggle { 
  background: var(--bg-secondary); 
  border: 1px solid var(--border-color); 
  border-radius: 50%; 
  width: 36px; 
  height: 36px; 
  display: flex; 
  align-items: center; 
  justify-content: center;
}

/* ✅ 佈署容器：桌面雙欄，手機單欄 */
.content-container { 
  max-width: 1400px; 
  margin: 0 auto; 
  padding: 16px; 
  display: grid; 
  grid-template-columns: 1fr 340px; 
  gap: 16px; 
}

.main-column { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

.card { 
  background: var(--bg-card); 
  border: 1px solid var(--border-color); 
  border-radius: var(--radius); 
  padding: 16px;
}

/* ✅ Responsive Utilities */
.desktop-only { display: block; }

@media (max-width: 1024px) {
  .content-container { grid-template-columns: 1fr; }
  .side-column { order: -1; } /* 手機版將表單放在較上方，方便輸入 */
  .desktop-only { display: none; }
  .group-selector { max-width: none; flex: 1; margin: 0 10px; }
}

@media (max-width: 480px) {
  body { font-size: 14px; }
  .top-nav { height: 56px; padding: 0 8px; }
  .content-container { padding: 12px; }
  .group-selector { margin: 0 4px; }
}

/* ✅ 狀態點動畫 */
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.polling .pulse-orange { animation: pulse-orange 1.5s infinite; }
@keyframes pulse-orange { 
  0% { transform: scale(1); opacity: 1; } 
  50% { transform: scale(1.3); opacity: 0.5; } 
  100% { transform: scale(1); opacity: 1; } 
}
</style>
