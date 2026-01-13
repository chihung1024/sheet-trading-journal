<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
          <span class="logo-icon">📊</span>
          <h1>Trading Journal <span class="badge">PRO</span></h1>
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
          <button class="action-trigger-btn" @click="handleTriggerUpdate" :disabled="portfolioStore.isPolling" :title="portfolioStore.isPolling ? '系統正在背景計算中...' : '手動觸發投資組合數據更新'">
            <span class="btn-icon">⚙️</span><span class="btn-text">更新數據</span>
          </button>
          <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切換為淺色模式' : '切換為深色模式'">
            <span v-if="isDark">☀️</span><span v-else>🌙</span>
          </button>
          <div class="user-profile" @click="handleLogout" title="點擊登出">
            <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="avatar-img" alt="User">
            <div v-else class="avatar">{{ userInitial }}</div>
            <span class="logout-text desktop-only">登出</span>
          </div>
        </div>
      </header>
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
        </main>
        <aside class="side-column" :class="{ 'mobile-collapsed': !isTradeFormExpanded }">
          <button class="mobile-toggle-btn" @click="toggleTradeForm">
            <span v-if="isTradeFormExpanded">✖</span><span v-else>📝</span>
            {{ isTradeFormExpanded ? '關閉' : '快速下單' }}
          </button>
          <div class="sticky-panel" v-show="isTradeFormExpanded || !isMobile">
            <TradeForm ref="tradeFormRef" />
          </div>
        </aside>
      </div>
      <button v-if="isMobile && !isTradeFormExpanded" class="floating-trade-btn" @click="toggleTradeForm" title="快速下單">
        <span>📝</span>
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
import { usePWA } from './composables/usePWA';
const { isInstallable, isInstalled, isOnline, install } = usePWA();
import { ref, onMounted, computed, nextTick } from 'vue';
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
import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { toasts, removeToast, addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();

const isTradeFormExpanded = ref(false);
const isMobile = ref(window.innerWidth <= 1024);

const toggleTradeForm = () => {
  isTradeFormExpanded.value = !isTradeFormExpanded.value;
  if (isTradeFormExpanded.value) {
    nextTick(() => {
      document.querySelector('.side-column')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
};

const handleTriggerUpdate = async () => {
  if (portfolioStore.isPolling) { addToast("⌛ 系統已在背景監控更新中，請稍候...", "info"); return; }
  if (!confirm("確定要觸發後端計算嗎？")) return;
  try {
    addToast("🚀 正在請求 GitHub Actions...", "info");
    await portfolioStore.triggerUpdate();
    addToast("✅ 已觸發！系統將在背景監控，更新完成後自動刷新。", "success");
  } catch (error) { addToast(`❌ 觸發失敗: ${error.message}`, "error"); }
};

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    if (isMobile.value) {
      isTradeFormExpanded.value = true;
      nextTick(() => { document.querySelector('.side-column')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }
  }
};

const userInitial = computed(() => authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U');
const handleLogout = () => { if (confirm("確定要登出系統嗎？")) authStore.logout(); };
const handleResize = () => { isMobile.value = window.innerWidth <= 1024; if (!isMobile.value) isTradeFormExpanded.value = false; };

onMounted(async () => {
  console.log('🚀 App.vue mounted');
  const isLoggedIn = authStore.initAuth();
  if (isLoggedIn) { console.log('🔐 已登入，開始載入投資組合數據...'); await portfolioStore.fetchAll(); }
  await nextTick();
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) { setTimeout(() => { loadingEl.style.opacity = '0'; setTimeout(() => loadingEl.remove(), 300); }, 500); }
  window.addEventListener('resize', handleResize);
  console.log('✅ App 初始化完成');
});
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
:root{--bg-app:#f1f5f9;--bg-card:#fff;--bg-secondary:#f8fafc;--primary:#3b82f6;--primary-dark:#2563eb;--text-main:#0f172a;--text-sub:#64748b;--border-color:#e2e8f0;--success:#10b981;--danger:#ef4444;--warning:#f59e0b;--shadow-sm:0 1px 2px 0 rgb(0 0 0/.05);--shadow-card:0 4px 6px -1px rgb(0 0 0/.1),0 2px 4px -2px rgb(0 0 0/.1);--shadow-lg:0 10px 15px -3px rgb(0 0 0/.1),0 4px 6px -4px rgb(0 0 0/.1);--radius:16px;--radius-sm:8px}
html.dark{--bg-app:#0f172a;--bg-card:#1e293b;--bg-secondary:#334155;--primary:#60a5fa;--primary-dark:#3b82f6;--text-main:#f1f5f9;--text-sub:#94a3b8;--border-color:#334155;--success:#34d399;--danger:#f87171;--warning:#fbbf24;--shadow-sm:0 1px 2px 0 rgb(0 0 0/.3);--shadow-card:0 4px 6px -1px rgb(0 0 0/.4),0 2px 4px -2px rgb(0 0 0/.3);--shadow-lg:0 10px 15px -3px rgb(0 0 0/.5),0 4px 6px -4px rgb(0 0 0/.4)}
*{box-sizing:border-box}body{background-color:var(--bg-app);color:var(--text-main);font-family:Inter,system-ui,-apple-system,sans-serif;margin:0;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;transition:background-color .3s,color .3s;overflow:visible}.main-wrapper{min-height:100vh;display:flex;flex-direction:column;overflow:visible;position:relative}
.top-nav{background:var(--bg-card);border-bottom:1px solid var(--border-color);padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between;z-index:100;box-shadow:var(--shadow-sm);transition:all .3s}
.nav-brand{display:flex;align-items:center;gap:12px;min-width:0;flex-shrink:1}.nav-brand h1{font-size:1.25rem;font-weight:700;margin:0;color:var(--text-main);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.badge{background:var(--text-main);color:var(--bg-card);font-size:.7rem;padding:2px 8px;border-radius:99px;font-weight:600}.logo-icon{font-size:1.5rem;flex-shrink:0}.nav-status{display:flex;align-items:center;gap:16px;font-size:.85rem;font-weight:500;flex-shrink:0}.status-indicator{display:flex;align-items:center;gap:8px}.status-indicator.ready{color:var(--success)}.status-indicator.loading{color:var(--primary)}.status-indicator.polling{color:var(--warning)}.dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}.loading .dot{animation:pulse 1.5s infinite}.pulse-orange{animation:pulse-orange 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes pulse-orange{0%{transform:scale(1);opacity:1}50%{transform:scale(1.2);opacity:.7}100%{transform:scale(1);opacity:1}}
.theme-toggle{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;font-size:1.2rem;flex-shrink:0}.theme-toggle:hover{background:var(--primary);border-color:var(--primary);transform:scale(1.05)}
.action-trigger-btn{background:linear-gradient(135deg,var(--primary),var(--primary-dark));border:none;border-radius:8px;color:#fff;padding:10px 16px;font-weight:600;font-size:.875rem;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;box-shadow:0 2px 4px rgba(59,130,246,.2);white-space:nowrap;min-height:44px}.action-trigger-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 4px 8px rgba(59,130,246,.3);background:linear-gradient(135deg,var(--primary-dark),var(--primary))}.action-trigger-btn:disabled{opacity:.7;cursor:not-allowed;transform:none;filter:grayscale(.5)}
.user-profile{display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 12px;border-radius:99px;transition:background .2s;min-height:44px}.user-profile:hover{background:var(--bg-secondary)}.avatar{width:36px;height:36px;background:var(--bg-secondary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--text-sub);flex-shrink:0}.avatar-img{width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--border-color);flex-shrink:0}
.content-container{max-width:1600px;margin:0 auto;padding:32px;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:24px;width:100%;align-items:stretch;overflow:visible}.main-column{display:flex;flex-direction:column;gap:24px;min-width:0}.section-charts{display:block;width:100%}.side-column{min-width:0;position:relative}.sticky-panel{position:sticky;top:24px;display:flex;flex-direction:column;gap:24px;z-index:10;height:fit-content;max-height:calc(100vh - 48px);overflow-y:auto}
.mobile-toggle-btn{display:none}.floating-trade-btn{display:none}
.card,.chart-wrapper{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow-card);transition:transform .2s,box-shadow .2s}.chart-wrapper{height:400px;padding:0;overflow:hidden;display:flex;flex-direction:column}.chart-wrapper.chart-full{height:500px;width:100%}.card h3{font-size:1.125rem;font-weight:700;color:var(--text-main);margin:0 0 20px 0;letter-spacing:-.01em}
table{width:100%;border-collapse:separate;border-spacing:0}th{text-align:left;color:var(--text-sub);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;font-weight:600;padding:10px 12px;border-bottom:1px solid var(--border-color);background:var(--bg-secondary)}th:first-child{border-top-left-radius:var(--radius-sm)}th:last-child{border-top-right-radius:var(--radius-sm)}td{padding:12px;border-bottom:1px solid var(--border-color);font-size:.9rem;color:var(--text-main);vertical-align:middle}tr:last-child td{border-bottom:none}tr:hover td{background-color:var(--bg-secondary);transition:background .15s}
.toast-container{position:fixed;bottom:32px;right:32px;z-index:9999;display:flex;flex-direction:column;gap:12px;max-width:420px}.toast{background:var(--bg-card);border:1px solid var(--border-color);border-left:4px solid transparent;padding:16px 20px;border-radius:12px;box-shadow:var(--shadow-lg);display:flex;gap:12px;cursor:pointer;min-width:280px;animation:slideIn .3s}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}.toast.success{border-left-color:var(--success)}.toast.error{border-left-color:var(--danger)}.toast-icon{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}.toast.success .toast-icon{background:#dcfce7;color:#166534}.toast.error .toast-icon{background:#fee2e2;color:#991b1b}.toast-msg{font-size:.9rem;color:var(--text-main);font-weight:500;word-break:break-word}.toast-slide-enter-active,.toast-slide-leave-active{transition:all .3s}.toast-slide-enter-from,.toast-slide-leave-to{transform:translateX(100%);opacity:0}
@media (max-width:1024px){.content-container{grid-template-columns:1fr;padding:20px;gap:20px}.side-column{order:-1;margin-bottom:0}.mobile-toggle-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border:none;border-radius:12px;font-weight:600;font-size:1rem;cursor:pointer;box-shadow:var(--shadow-card);transition:all .2s;margin-bottom:16px}.mobile-toggle-btn:active{transform:scale(.98)}.side-column.mobile-collapsed .sticky-panel{display:none}.floating-trade-btn{display:flex;position:fixed;bottom:80px;right:20px;width:60px;height:60px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border:none;border-radius:50%;font-size:1.8rem;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(59,130,246,.4);cursor:pointer;z-index:999;transition:all .3s}.floating-trade-btn:active{transform:scale(.9)}.section-charts{display:block}.sticky-panel{position:static;max-height:none}.desktop-only{display:none}.chart-wrapper.chart-full{height:550px}th,td{padding:10px 12px;font-size:.85rem}th{font-size:.7rem}}
@media (max-width:768px){.top-nav{padding:0 16px;height:60px}.nav-brand h1{font-size:1.1rem}.badge{font-size:.65rem;padding:2px 6px}.logo-icon{font-size:1.3rem}.nav-status{gap:10px;font-size:.8rem}.status-text{display:none}.action-trigger-btn{padding:8px 12px;font-size:.8rem}.btn-text{display:none}.btn-icon{font-size:1.2rem}.theme-toggle{width:40px;height:40px;font-size:1.1rem}.avatar,.avatar-img{width:32px;height:32px}.content-container{padding:16px;gap:16px}.main-column{gap:16px}.card,.chart-wrapper{padding:16px;border-radius:12px}.chart-wrapper.chart-full{height:600px}.toast-container{bottom:16px;right:16px;left:16px;max-width:none}.toast{min-width:auto}th,td{padding:8px 10px;font-size:.8rem}th{font-size:.68rem}}
@media (max-width:480px){.top-nav{padding:0 12px;height:56px}.nav-brand h1{font-size:1rem}.nav-brand .badge{display:none}.logo-icon{font-size:1.2rem}.nav-status{gap:8px}.status-indicator{font-size:0}.status-indicator .dot{margin:0}.action-trigger-btn{padding:6px 10px;min-width:40px;min-height:40px}.theme-toggle{width:36px;height:36px;font-size:1rem}.user-profile{padding:4px}.content-container{padding:12px;gap:12px}.main-column{gap:12px}.card,.chart-wrapper{padding:12px}.card h3{font-size:1rem;margin-bottom:12px}.chart-wrapper.chart-full{height:450px}.toast{padding:12px 16px}.toast-msg{font-size:.85rem}th,td{padding:6px 8px;font-size:.75rem}.floating-trade-btn{width:56px;height:56px;font-size:1.6rem;bottom:70px;right:16px}}
@media (hover:none) and (pointer:coarse){button,.user-profile,.theme-toggle,.action-trigger-btn{min-width:44px;min-height:44px}button:active,.user-profile:active,.theme-toggle:active{transform:scale(.95);opacity:.8}}
</style>