<template>
  <div class="app-layout" :class="{ 'dark-mode': isDark }">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      
      <header class="top-nav">
        <div class="nav-brand">
          <span class="logo-icon">📊</span>
          <div class="brand-text">
             <h1>Trading Journal <span class="badge">PRO</span></h1>
             <span class="last-update" v-if="portfolioStore.lastUpdate">
               更新於: {{ formatTime(portfolioStore.lastUpdate) }}
             </span>
          </div>
        </div>

        <div class="group-selector">
            <span class="selector-label">策略群組:</span>
            <div class="select-wrapper">
                <select 
                    :value="portfolioStore.currentGroup" 
                    @change="e => portfolioStore.setGroup(e.target.value)"
                    :disabled="isProcessing"
                >
                    <option value="all">全部 (All Portfolios)</option>
                    <option 
                        v-for="g in portfolioStore.availableGroups.filter(x => x !== 'all')" 
                        :key="g" 
                        :value="g"
                    >
                        {{ g }}
                    </option>
                </select>
                <button 
                    class="btn-edit-group" 
                    @click="openGroupModal" 
                    title="管理群組名稱"
                    :disabled="isProcessing"
                >
                    ✎
                </button>
            </div>
        </div>

        <div class="nav-status">
           <div class="status-indicator" :class="portfolioStore.connectionStatus" title="連線狀態"></div>
           <button class="btn-icon" @click="toggleDark" title="切換深色模式">
             {{ isDark ? '☀️' : '🌙' }}
           </button>
           <button class="btn-logout" @click="handleLogout">登出</button>
        </div>
      </header>
      
      <main class="content-container">
        <section class="section-stats">
          <StatsGrid />
        </section>

        <section class="section-charts">
          <div class="chart-col">
            <PerformanceChart />
          </div>
          <div class="chart-col">
            <PieChart />
          </div>
        </section>

        <section class="section-main-data">
           <div class="data-col">
             <HoldingsTable />
             <RecordList />
           </div>
           <div class="form-col">
             <TradeForm />
             <DividendManager />
           </div>
        </section>
      </main>

      <div v-if="showGroupModal" class="modal-overlay" @click.self="showGroupModal = false">
          <div class="modal-card">
              <div class="modal-header">
                  <h3>管理策略群組</h3>
                  <button class="close-btn" @click="showGroupModal = false">×</button>
              </div>
              
              <div class="modal-body">
                  <p class="modal-desc">
                      修改群組名稱將會批次更新所有相關的交易紀錄。
                      <br><span class="warning-text">注意：此操作無法復原。</span>
                  </p>
                  
                  <div class="group-list">
                      <div v-if="availableGroupsList.length === 0" class="empty-msg">
                          目前沒有自訂群組
                      </div>
                      <div v-for="g in availableGroupsList" :key="g" class="group-item">
                          <span class="group-label">{{ g }}</span>
                          <span class="arrow">➜</span>
                          <input 
                              type="text" 
                              v-model="groupRenameMap[g]" 
                              :placeholder="g"
                              class="rename-input"
                          >
                          <button 
                              @click="renameGroup(g)" 
                              class="btn-sm btn-rename" 
                              :disabled="isProcessing || !groupRenameMap[g] || groupRenameMap[g] === g"
                          >
                              {{ isProcessing ? '...' : '更名' }}
                          </button>
                      </div>
                  </div>
              </div>
              
              <div class="modal-footer">
                  <button class="btn-secondary" @click="showGroupModal = false" :disabled="isProcessing">關閉</button>
              </div>
          </div>
      </div>

    </div>
    
    <ToastContainer />
  </div>
</template>

<script setup>
import { onMounted, ref, computed, reactive, watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useToast } from './composables/useToast';
import { useDarkMode } from './composables/useDarkMode';
import { CONFIG } from './config';

// Components
import LoginOverlay from './components/LoginOverlay.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import PieChart from './components/PieChart.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import TradeForm from './components/TradeForm.vue';
import DividendManager from './components/DividendManager.vue';
import ToastContainer from './components/ToastContainer.vue'; // 假設您有這個組件，若無可移除

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();
const { isDark, toggleDark } = useDarkMode();

// UI States
const showGroupModal = ref(false);
const isProcessing = ref(false);
const groupRenameMap = reactive({});

// Computed
const availableGroupsList = computed(() => {
    return portfolioStore.availableGroups.filter(g => g !== 'all');
});

// Methods
const handleLogout = () => {
    if (confirm('確定要登出嗎?')) {
        authStore.logout();
    }
};

const formatTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleString('zh-TW', { hour12: false });
};

const openGroupModal = () => {
    // 初始化更名對照表
    portfolioStore.availableGroups.forEach(g => {
        if (g !== 'all') groupRenameMap[g] = g;
    });
    showGroupModal.value = true;
};

// 核心功能：前端批次更名 (不需後端 API 支援)
const renameGroup = async (oldName) => {
    const newName = groupRenameMap[oldName];
    if (!newName || newName === oldName) return;
    
    if (!confirm(`確定將群組 "${oldName}" 更名為 "${newName}" 嗎？\n\n系統將會找出所有包含此標籤的紀錄並逐筆更新，這可能需要一點時間。`)) return;

    isProcessing.value = true;
    addToast(`開始批次更新群組名稱...`, 'info');

    try {
        // 1. 找出所有相關紀錄
        const recordsToUpdate = portfolioStore.records.filter(r => {
            if (!r.tag) return false;
            const tags = r.tag.split(/[,;]/).map(t => t.trim());
            return tags.includes(oldName);
        });

        if (recordsToUpdate.length === 0) {
            addToast('找不到相關紀錄', 'warning');
            isProcessing.value = false;
            return;
        }

        let successCount = 0;
        let failCount = 0;

        // 2. 逐筆更新 (Sequential Update to avoid race conditions or rate limits)
        for (const record of recordsToUpdate) {
            // 替換標籤邏輯
            let tags = record.tag.split(/[,;]/).map(t => t.trim());
            tags = tags.map(t => t === oldName ? newName : t);
            // 去除重複並重組字串
            tags = [...new Set(tags)];
            const newTagStr = tags.join(', ');

            try {
                // 直接呼叫 Fetch 以避免 Store 頻繁刷新
                const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `Bearer ${authStore.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ...record, tag: newTagStr })
                });
                
                if (!res.ok) throw new Error('API Error');
                successCount++;
            } catch (e) {
                console.error(`Failed to update record ${record.id}`, e);
                failCount++;
            }
        }

        // 3. 完成後處理
        addToast(`更新完成: 成功 ${successCount} 筆, 失敗 ${failCount} 筆`, failCount > 0 ? 'warning' : 'success');
        
        // 強制重新獲取資料並觸發後端重算
        await portfolioStore.fetchAll();
        await portfolioStore.triggerUpdate();
        
        // 關閉視窗或重置輸入
        if (failCount === 0) {
            delete groupRenameMap[oldName];
            groupRenameMap[newName] = newName;
        }
        
    } catch (e) {
        addToast('更名過程發生未預期的錯誤', 'error');
        console.error(e);
    } finally {
        isProcessing.value = false;
    }
};

onMounted(() => {
    if (authStore.token) {
        portfolioStore.startPolling();
    }
});
</script>

<style>
/* 全域變數定義 */
:root {
  --primary: #2563eb;
  --bg-main: #f3f4f6;
  --bg-card: #ffffff;
  --text-main: #1f2937;
  --text-sub: #6b7280;
  --border-color: #e5e7eb;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
}

.dark-mode {
  --bg-main: #111827;
  --bg-card: #1f2937;
  --text-main: #f9fafb;
  --text-sub: #9ca3af;
  --border-color: #374151;
  --primary: #3b82f6;
}

/* Layout */
.app-layout {
  min-height: 100vh;
  background-color: var(--bg-main);
  color: var(--text-main);
  font-family: 'Inter', system-ui, sans-serif;
  transition: background-color 0.3s, color 0.3s;
}

.main-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 16px 40px;
}

/* Header Styles */
.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 1.8rem;
}

.brand-text h1 {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
}

.badge {
  background: var(--primary);
  color: white;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  vertical-align: middle;
}

.last-update {
  display: block;
  font-size: 0.75rem;
  color: var(--text-sub);
  margin-top: 2px;
}

/* ✅ Group Selector Styles */
.group-selector {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-card);
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
}

.selector-label {
    font-size: 0.85rem;
    color: var(--text-sub);
    font-weight: 600;
}

.select-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
}

.select-wrapper select {
    background: transparent;
    border: none;
    font-size: 0.95rem;
    color: var(--text-main);
    font-weight: 700;
    cursor: pointer;
    outline: none;
    padding-right: 4px;
}

.btn-edit-group {
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-sub);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 2px 6px;
    transition: all 0.2s;
}

.btn-edit-group:hover {
    background: var(--bg-main);
    color: var(--primary);
    border-color: var(--primary);
}

/* Status Area */
.nav-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #9ca3af;
}
.status-indicator.connected { background-color: var(--success); box-shadow: 0 0 8px var(--success); }
.status-indicator.error { background-color: var(--danger); }

.btn-icon {
  background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px;
}
.btn-logout {
  background: var(--bg-card); border: 1px solid var(--border-color);
  padding: 6px 12px; border-radius: 6px; cursor: pointer; color: var(--text-main);
  font-size: 0.9rem; font-weight: 500;
}
.btn-logout:hover { border-color: var(--danger); color: var(--danger); }

/* Content Layout */
.content-container {
  display: flex; flex-direction: column; gap: 24px;
}

.section-charts {
  display: grid; grid-template-columns: 2fr 1fr; gap: 24px;
}

.section-main-data {
  display: grid; grid-template-columns: 2fr 1fr; gap: 24px;
}

.data-col { display: flex; flex-direction: column; gap: 24px; }
.form-col { display: flex; flex-direction: column; gap: 24px; }

/* Responsive */
@media (max-width: 1024px) {
  .section-charts, .section-main-data { grid-template-columns: 1fr; }
  .form-col { order: -1; } /* Mobile: Form on top */
}

/* ✅ Modal Styles */
.modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);
    z-index: 999;
    display: flex; align-items: center; justify-content: center;
}

.modal-card {
    background: var(--bg-card);
    width: 480px; max-width: 90%;
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    display: flex; flex-direction: column;
    max-height: 85vh;
}

.modal-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
    display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 { margin: 0; font-size: 1.2rem; }
.close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-sub); }

.modal-body { padding: 24px; overflow-y: auto; }
.modal-desc { font-size: 0.9rem; color: var(--text-sub); margin-bottom: 20px; line-height: 1.5; }
.warning-text { color: var(--danger); font-weight: bold; }

.group-list { display: flex; flex-direction: column; gap: 12px; }
.empty-msg { text-align: center; color: var(--text-sub); font-style: italic; }

.group-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px; border: 1px solid var(--border-color); border-radius: 8px;
    background: var(--bg-main);
}
.group-label { font-weight: 600; min-width: 80px; }
.arrow { color: var(--text-sub); font-size: 0.8rem; }
.rename-input {
    flex: 1; padding: 6px 10px; border: 1px solid var(--border-color);
    border-radius: 4px; background: var(--bg-card); color: var(--text-main);
}
.btn-rename {
    background: var(--primary); color: white; border: none;
    padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;
}
.btn-rename:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-footer {
    padding: 16px 24px; border-top: 1px solid var(--border-color);
    display: flex; justify-content: flex-end;
}
.btn-secondary {
    background: transparent; border: 1px solid var(--border-color);
    padding: 8px 16px; border-radius: 6px; cursor: pointer; color: var(--text-main);
}
</style>
