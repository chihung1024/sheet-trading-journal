<template>
  <div class="header-bar">
    <div class="brand-section">
      <div class="title-row">
        <h2 class="app-title">Dashboard <span class="badge">PRO</span></h2>
        <div class="market-tag" v-if="portfolioStore.stats?.market_stage_desc">
          {{ portfolioStore.stats.market_stage_desc }}
        </div>
      </div>
      
      <div class="status-row">
        <span class="status-indicator" :class="portfolioStore.connectionStatus">
            <span class="dot"></span> 
            {{ statusText }}
        </span>
        <span class="divider">|</span>
        
        <div class="nav-meta" v-if="portfolioStore.stats">
          <span class="date-pair">
            <span class="date-label">基準:</span> {{ portfolioStore.stats.daily_pnl_prev_date }} 
            <span class="arrow">➔</span> 
            <span class="date-label">即時:</span> {{ portfolioStore.stats.daily_pnl_asof_date }}
          </span>
          <span class="divider">|</span>
          <span class="fx-indicator" :class="{ 'fx-pulse': portfolioStore.loading }">
            <span class="fx-label">USD/TWD:</span> 
            <strong>{{ portfolioStore.stats.daily_pnl_curr_fx?.toFixed(2) || '--' }}</strong>
          </span>
        </div>

        <span class="divider" v-if="portfolioStore.lastUpdate">|</span>
        <small class="update-time" v-if="portfolioStore.lastUpdate">
          最後更新: {{ formatTime(portfolioStore.lastUpdate) }}
        </small>
      </div>
    </div>

    <div class="user-actions">
      <div class="user-profile" v-if="authStore.user">
         <div class="avatar">{{ userInitial }}</div>
         <div class="user-info">
           <span class="username">{{ authStore.user.name }}</span>
           <span class="user-email">{{ authStore.user.email }}</span>
         </div>
      </div>
      
      <div class="action-buttons">
          <button 
            @click="handleManualTrigger" 
            class="btn btn-primary btn-sm" 
            :disabled="portfolioStore.loading"
          >
            <span v-if="portfolioStore.loading" class="spinner"></span>
            {{ portfolioStore.loading ? '重算中...' : '⟳ 刷新數據' }}
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
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const router = useRouter();

// 計算用戶名稱首字母縮寫
const userInitial = computed(() => {
  if (!authStore.user || !authStore.user.name) return '?';
  return authStore.user.name.charAt(0).toUpperCase();
});

// 連線狀態文字
const statusText = computed(() => {
  switch (portfolioStore.connectionStatus) {
    case 'connected': return '雲端已連線';
    case 'error': return '連線異常';
    case 'loading': return '同步中...';
    default: return '未連線';
  }
});

/**
 * 格式化更新時間
 */
const formatTime = (timeStr) => {
  if (!timeStr) return '--:--';
  // 假設 timeStr 格式為 "YYYY-MM-DD HH:mm"
  return timeStr.split(' ')[1] || timeStr;
};

/**
 * 手動觸發 GitHub Action 更新
 */
const handleManualTrigger = async () => {
  try {
    await portfolioStore.triggerUpdate();
  } catch (e) {
    console.error('Trigger failed:', e);
  }
};

/**
 * 處理登出
 */
const handleLogout = () => {
  authStore.logout();
  portfolioStore.resetData();
  router.push('/login');
};
</script>

<style scoped>
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: #1a1a1a;
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.brand-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  background-color: #6366f1;
  border-radius: 4px;
  vertical-align: middle;
}

.market-tag {
  font-size: 0.75rem;
  padding: 2px 8px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #a5b4fc;
  border: 1px solid rgba(165, 180, 252, 0.3);
}

.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  color: #999;
}

.nav-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #ccc;
}

.date-label, .fx-label {
  color: #666;
  margin-right: 4px;
}

.date-pair {
  font-family: 'Roboto Mono', monospace;
}

.arrow {
  margin: 0 4px;
  color: #444;
}

.fx-indicator strong {
  color: #fbbf24; /* 琥珀色強調匯率 */
}

/* 🚀 匯率變動脈衝效果 */
.fx-pulse {
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0% { opacity: 1; }
  50% { opacity: 0.6; color: #6366f1; }
  100% { opacity: 1; }
}

.divider {
  color: rgba(255, 255, 255, 0.1);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.status-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #666;
}

.status-indicator.connected { color: #4caf50; }
.status-indicator.connected .dot { 
  background-color: #4caf50; 
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.4); 
}

.status-indicator.error { color: #ff4d4f; }
.status-indicator.error .dot { 
  background-color: #ff4d4f; 
  animation: pulse-blink 1s infinite; 
}

@keyframes pulse-blink { 
  0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } 
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding-right: 20px;
}

.avatar {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.user-info {
  display: flex;
  flex-direction: column;
}

.username {
  font-weight: 600;
  font-size: 0.95rem;
}

.user-email {
  font-size: 0.75rem;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background-color: #6366f1;
  color: white;
}

.btn-primary:hover { background-color: #4f46e5; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline {
  background-color: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ccc;
}

.btn-outline:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: white;
  border-color: white;
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
  margin-right: 6px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
