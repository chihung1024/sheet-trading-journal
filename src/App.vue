<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
          <span class="logo-icon">📊</span>
          <div class="brand-text">
             <h1>Trading Journal <span class="badge">PRO</span></h1>
          </div>
        </div>

        <div class="group-selector">
            <span class="selector-label">群組:</span>
            <div class="select-wrapper">
                <select :value="portfolioStore.currentGroup" @change="e => portfolioStore.setGroup(e.target.value)">
                    <option value="all">全部 (All)</option>
                    <option v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" :value="g">
                        {{ g }}
                    </option>
                </select>
                <button class="btn-edit-group" @click="openGroupModal">✎</button>
            </div>
        </div>

        <div class="nav-status">
          <div v-if="portfolioStore.loading" class="status-indicator loading"><span class="dot"></span> 更新中...</div>
          <div v-else-if="portfolioStore.isPolling" class="status-indicator polling"><span class="dot pulse-orange"></span> 計算中...</div>
          <div v-else class="status-indicator ready"><span class="dot"></span> 連線正常</div>
          
          <button class="action-trigger-btn" @click="handleTriggerUpdate" :disabled="portfolioStore.isPolling">
            <span>⚙️</span> 更新數據
          </button>
          
          <button class="theme-toggle" @click="toggleTheme">{{ isDark ? '☀️' : '🌙' }}</button>
          <div class="user-profile" @click="handleLogout">登出</div>
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
          
          <section class="section-dividends" v-if="!portfolioStore.loading && hasPendingDividends">
            <DividendManager />
          </section>
        </main>
        
        <aside class="side-column">
          <div class="sticky-panel">
            <TradeForm ref="tradeFormRef" />
            
            <div v-if="hasPendingDividends" class="dividend-alert card">
              <div class="alert-header"><h4>🔔 待確認配息</h4></div>
              <p class="alert-text">有 <strong>{{ pendingDividendsCount }}</strong> 筆配息待確認</p>
              <button class="btn-alert" @click="scrollToDividends">前往確認</button>
            </div>
          </div>
        </aside>
      </div>

      <div v-if="showGroupModal" class="modal-overlay" @click.self="showGroupModal=false">
          <div class="modal-card">
              <h3>管理群組</h3>
              <div class="group-list">
                  <div v-for="g in portfolioStore.availableGroups.filter(x=>x!=='all')" :key="g" class="group-item">
                      <input type="text" v-model="groupRenameMap[g]" :placeholder="g">
                      <button @click="renameGroup(g)" :disabled="!groupRenameMap[g]">更名</button>
                  </div>
              </div>
              <button @click="showGroupModal=false">關閉</button>
          </div>
      </div>
    </div>
    
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useToast } from './composables/useToast';
import { useDarkMode } from './composables/useDarkMode';
import { CONFIG } from './config';

// Import Components... (保持原樣)
import LoginOverlay from './components/LoginOverlay.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import DividendManager from './components/DividendManager.vue';
import ToastContainer from './components/ToastContainer.vue';
import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';
import TableSkeleton from './components/skeletons/TableSkeleton.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { addToast } = useToast();
const { isDark, toggleTheme } = useDarkMode();

// Group Modal State
const showGroupModal = ref(false);
const groupRenameMap = reactive({});

// Computed for Dividends
const hasPendingDividends = computed(() => portfolioStore.pending_dividends.length > 0);
const pendingDividendsCount = computed(() => portfolioStore.pending_dividends.length);

const scrollToDividends = () => {
    document.querySelector('.section-dividends')?.scrollIntoView({ behavior: 'smooth' });
};

const handleTriggerUpdate = async () => {
    if(portfolioStore.isPolling) return;
    if(!confirm("確定要觸發更新嗎？")) return;
    try {
        await portfolioStore.triggerUpdate();
        addToast("已觸發更新", "success");
    } catch(e) { addToast("更新失敗", "error"); }
};

const handleEditRecord = (r) => {
    tradeFormRef.value?.setupForm(r);
};

const handleLogout = () => {
    if(confirm("登出?")) authStore.logout();
};

const openGroupModal = () => {
    portfolioStore.availableGroups.forEach(g => { if(g!=='all') groupRenameMap[g] = g; });
    showGroupModal.value = true;
};

const renameGroup = async (oldName) => {
    const newName = groupRenameMap[oldName];
    if(!newName || newName === oldName) return;
    if(!confirm(`確認更名 ${oldName} -> ${newName}?`)) return;
    
    // 批次更新邏輯 (與先前 Step 4 相同)
    const records = portfolioStore.records.filter(r => (r.tag||'').includes(oldName));
    for(const r of records) {
        let tags = r.tag.split(',').map(t=>t.trim());
        tags = tags.map(t => t===oldName ? newName : t);
        await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method: 'PUT',
            headers: {'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({...r, tag: tags.join(', ')})
        });
    }
    await portfolioStore.fetchAll();
    await portfolioStore.triggerUpdate();
    addToast("更名完成", "success");
};

onMounted(async () => {
    if(authStore.initAuth()) await portfolioStore.fetchAll();
});
</script>

<style>
/* 補上 .group-selector 的 CSS (參考 Step 4 提供的樣式) */
.group-selector { display: flex; align-items: center; gap: 8px; background: var(--bg-card); padding: 4px 12px; border-radius: 8px; border: 1px solid var(--border-color); margin-right: 16px; }
.btn-edit-group { background: none; border: 1px solid var(--border-color); cursor: pointer; padding: 2px 6px; border-radius: 4px; }
/* ... 其他原有 CSS 保持不變 ... */
</style>
