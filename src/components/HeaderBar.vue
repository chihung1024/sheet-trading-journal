<template>
  <div class="header-bar">
    <div class="brand-section">
      <div class="title-row">
        <h2 class="app-title">Dashboard <span class="badge">PRO</span></h2>
        
        <div class="group-switcher" ref="dropdownRef" v-if="portfolioStore.availableGroups.length > 0">
          <button class="switcher-toggle" @click="toggleDropdown" :class="{ active: isDropdownOpen }">
            <span class="group-icon" :style="{ backgroundColor: currentGroup?.color }"></span>
            <span class="group-name">{{ currentGroup?.name }}</span>
            <span class="chevron">▼</span>
          </button>
          
          <div class="switcher-dropdown" v-show="isDropdownOpen">
            <div 
              v-for="group in portfolioStore.availableGroups" 
              :key="group.id"
              class="dropdown-item"
              :class="{ selected: group.id === portfolioStore.currentGroupId }"
              @click="selectGroup(group.id)"
            >
              <span class="group-icon-sm" :style="{ backgroundColor: group.color }"></span>
              <span class="group-label">{{ group.name }}</span>
              <span class="check-mark" v-if="group.id === portfolioStore.currentGroupId">✓</span>
            </div>
          </div>
        </div>
      </div>

      <div class="status-row">
        <span class="status-indicator" :class="portfolioStore.connectionStatus">
            <span class="dot"></span> 
            {{ statusText }}
        </span>
        <span class="divider">|</span>
        <small class="update-time">最後更新: {{ formatTime(portfolioStore.lastUpdated) }}</small>
      </div>
    </div>

    <div class="user-actions">
      <div class="user-profile">
         <div class="avatar">{{ userInitial }}</div>
         <span class="username">{{ authStore.user.name }}</span>
      </div>
      
      <div class="action-buttons">
          <button @click="handleRefresh" class="btn btn-primary btn-sm" :disabled="portfolioStore.loading">
            {{ portfolioStore.loading ? '更新中...' : '⟳ 刷新數據' }}
          </button>
          <button @click="handleLogout" class="btn btn-outline btn-sm">
            登出 ➔
          </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();

// 下拉選單狀態控制
const isDropdownOpen = ref(false);
const dropdownRef = ref(null);

const userInitial = computed(() => authStore.user.name ? authStore.user.name.charAt(0).toUpperCase() : 'U');

// 取得當前選中的群組資訊 (用於顯示顏色與名稱)
const currentGroup = computed(() => {
  return portfolioStore.availableGroups.find(g => g.id === portfolioStore.currentGroupId) || { name: '載入中...', color: '#666' };
});

const statusText = computed(() => {
    if (portfolioStore.loading) return '資料傳輸中...';
    // 簡單判斷：如果有數據則視為連線正常
    if (portfolioStore.summary && Object.keys(portfolioStore.summary).length > 0) return '系統連線正常';
    return '待機';
});

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-TW', { hour12: false }) : 'N/A';

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
};

const selectGroup = (groupId) => {
  portfolioStore.setGroupId(groupId);
  isDropdownOpen.value = false;
};

const handleRefresh = () => {
  portfolioStore.refresh();
};

const handleLogout = () => {
    if(confirm("確定要登出系統嗎?")) {
        authStore.logout();
    }
};

// 點擊外部關閉下拉選單
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isDropdownOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.header-bar { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 24px; 
    padding: 16px 24px;
    background: var(--card-bg, #1e1e23);
    border: 1px solid var(--card-border, #333);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    position: relative;
    z-index: 50; /* 確保下拉選單不會被蓋住 */
}

.brand-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-title { margin: 0; font-size: 1.4rem; color: #fff; display: flex; align-items: center; gap: 8px; }
.badge { font-size: 0.7rem; background: var(--primary, #40a9ff); color: white; padding: 2px 6px; border-radius: 4px; vertical-align: middle; }

/* --- 群組切換器樣式 (新增) --- */
.group-switcher {
  position: relative;
}

.switcher-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 6px 12px;
  color: #e0e0e0;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.switcher-toggle:hover, .switcher-toggle.active {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.group-icon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 5px rgba(0,0,0,0.3);
}

.chevron {
  font-size: 0.7rem;
  opacity: 0.6;
  margin-left: 4px;
}

.switcher-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: #25252b;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  width: 180px;
  overflow: hidden;
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.2s;
  color: #ccc;
  font-size: 0.9rem;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.dropdown-item.selected {
  background: rgba(64, 169, 255, 0.1);
  color: #40a9ff;
  font-weight: 500;
}

.group-icon-sm {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.check-mark {
  margin-left: auto;
  font-size: 0.8rem;
}

/* --------------------------- */

.status-row { display: flex; align-items: center; gap: 10px; margin-top: 4px; color: #888; font-size: 0.85rem; }
.divider { opacity: 0.3; }

/* 狀態燈號 */
.status-indicator { display: flex; align-items: center; gap: 6px; font-weight: 500; transition: color 0.3s; }
.dot { width: 8px; height: 8px; border-radius: 50%; background-color: #666; transition: background-color 0.3s; }
.status-indicator.connected { color: #4caf50; }
.status-indicator.connected .dot { background-color: #4caf50; box-shadow: 0 0 8px rgba(76, 175, 80, 0.4); }
.status-indicator.error { color: #ff4d4f; }
.status-indicator.error .dot { background-color: #ff4d4f; animation: pulse 1s infinite; }

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

.user-actions { display: flex; align-items: center; gap: 20px; }
.user-profile { display: flex; align-items: center; gap: 10px; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 20px; }
.avatar { width: 36px; height: 36px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1rem; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
.username { color: #e0e0e0; font-weight: 500; font-size: 0.95rem; }

.action-buttons { display: flex; gap: 10px; }

/* RWD */
@media (max-width: 768px) {
    .header-bar { flex-direction: column; align-items: stretch; gap: 16px; padding: 16px; }
    .title-row { flex-wrap: wrap; justify-content: space-between; }
    .user-actions { flex-direction: column; align-items: stretch; gap: 12px; }
    .user-profile { border-right: none; padding-right: 0; justify-content: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
    .action-buttons { justify-content: space-between; }
    .btn { flex: 1; }
}
</style>
