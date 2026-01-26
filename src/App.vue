<template>
  <div class="app-container">
    <ToastContainer />

    <div v-if="needRefresh" class="pwa-reload-card" role="alert">
      <div class="pwa-content">
        <span class="pwa-title">🚀 發現新版本</span>
        <span class="pwa-desc">應用程式已更新，請點擊重整以套用。</span>
      </div>
      <div class="pwa-actions">
        <button @click="updateServiceWorker()" class="btn-reload">立即重整</button>
        <button @click="needRefresh = false" class="btn-close">稍後</button>
      </div>
    </div>

    <header class="main-header">
      <div class="header-content">
        <div class="brand">
          <div class="logo-icon">📈</div>
          <h1 class="brand-name">Trading Journal <span class="pro-badge">PRO</span></h1>
        </div>

        <div class="controls">
          <button 
            class="theme-toggle" 
            @click="toggleTheme" 
            :title="isDark ? '切換至淺色模式' : '切換至深色模式'"
          >
            <span v-if="isDark">🌞</span>
            <span v-else>gwt</span>
          </button>

          <div v-if="authStore.isAuthenticated" class="user-profile">
            <span class="user-name desktop-only">{{ authStore.user.name }}</span>
            <button @click="handleLogout" class="btn-logout">登出</button>
          </div>
        </div>
      </div>
    </header>

    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    
    <footer class="main-footer">
      <p>&copy; {{ new Date().getFullYear() }} Trading Journal PRO. All rights reserved.</p>
      <p class="version-info">v{{ appVersion }}</p>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useAuthStore } from './stores/auth';
import { useDarkMode } from './composables/useDarkMode';
import { usePWA } from './composables/usePWA';
import { useToast } from './composables/useToast';
import { CONFIG } from './config';
import ToastContainer from './components/ToastContainer.vue';

// Stores & Composables
const authStore = useAuthStore();
const { isDark, toggleTheme } = useDarkMode();
const { needRefresh, updateServiceWorker } = usePWA();
const { addToast } = useToast();

const appVersion = CONFIG.APP_VERSION;

// Lifecycle
onMounted(() => {
  // 初始化權限檢查
  authStore.initAuth();
  
  // 歡迎訊息 (僅在首次載入且已登入時)
  if (authStore.isAuthenticated) {
    console.log('App mounted with active session');
  }
});

// Actions
const handleLogout = () => {
  authStore.logout();
  addToast('您已安全登出', 'success');
};
</script>

<style scoped>
/* App 容器與基礎佈局 */
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Header */
.main-header {
  height: 64px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

:global(.dark) .main-header {
  background: rgba(30, 41, 59, 0.9);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Branding */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  user-select: none;
}

.logo-icon {
  font-size: 24px;
}

.brand-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.pro-badge {
  font-size: 0.7rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  vertical-align: middle;
  margin-left: 4px;
  font-weight: 800;
}

/* Controls */
.controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.theme-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 8px;
  border-radius: 50%;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle:hover {
  background: var(--bg-secondary);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.btn-logout {
  font-size: 0.85rem;
  padding: 6px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
}

.btn-logout:hover {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

/* Main Content */
.main-content {
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px;
}

/* Footer */
.main-footer {
  text-align: center;
  padding: 24px;
  border-top: 1px solid var(--border-color);
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.version-info {
  font-size: 0.75rem;
  opacity: 0.6;
}

/* PWA Update Card */
.pwa-reload-card {
  position: fixed;
  bottom: 24px;
  left: 24px;
  z-index: 9999;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 280px;
  animation: slide-up 0.3s ease-out;
}

.pwa-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pwa-title {
  font-weight: 700;
  font-size: 1rem;
}

.pwa-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.pwa-actions {
  display: flex;
  gap: 8px;
}

.btn-reload {
  flex: 1;
  padding: 8px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-close {
  padding: 8px 12px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* RWD */
@media (max-width: 640px) {
  .desktop-only {
    display: none;
  }
  
  .brand-name {
    font-size: 1.1rem;
  }
  
  .main-content {
    padding: 16px;
  }
  
  .pwa-reload-card {
    left: 16px;
    right: 16px;
    bottom: 16px;
    width: auto;
  }
}
</style>
