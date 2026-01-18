<template>
  <div class="header-bar">
    <div class="brand-section">
      <h2 class="app-title">Dashboard <span class="badge">PRO</span></h2>
      <div class="status-row">
        <span class="status-indicator" :class="portfolioStore.connectionStatus">
            <span class="dot"></span> 
            {{ statusText }}
        </span>
        <span class="divider">|</span>
        <small class="update-time">最後更新: {{ formatTime(portfolioStore.lastUpdate) }}</small>
      </div>
    </div>

    <div class="user-actions">
      <div class="user-profile">
         <div class="avatar">{{ userInitial }}</div>
         <span class="username">{{ authStore.user.name }}</span>
      </div>
      
      <div class="action-buttons">
          <button @click="portfolioStore.triggerUpdate" class="btn btn-primary btn-sm" :disabled="portfolioStore.loading">
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
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();

const userInitial = computed(() => authStore.user.name ? authStore.user.name.charAt(0).toUpperCase() : 'U');

const statusText = computed(() => {
    if (portfolioStore.loading) return '資料傳輸中...';
    switch (portfolioStore.connectionStatus) {
        case 'connected': return '系統連線正常';
        case 'error': return '連線異常 / 斷線';
        default: return '待機';
    }
});

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-TW', { hour12: false }) : 'N/A';

const handleLogout = () => {
    if(confirm("確定要登出系統嗎?")) {
        authStore.logout();
    }
};
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
}

.app-title { margin: 0; font-size: 1.4rem; color: #fff; display: flex; align-items: center; gap: 8px; }
.badge { font-size: 0.7rem; background: var(--primary, #40a9ff); color: white; padding: 2px 6px; border-radius: 4px; vertical-align: middle; }

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
    .user-actions { flex-direction: column; align-items: stretch; gap: 12px; }
    .user-profile { border-right: none; padding-right: 0; justify-content: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
    .action-buttons { justify-content: space-between; }
    .btn { flex: 1; }
}
</style>
