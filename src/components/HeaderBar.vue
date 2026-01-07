<template>
  <header class="header-bar">
    <div class="header-content">
      <div class="header-left">
        <button
          v-if="isMobile"
          class="menu-toggle"
          @click="toggleMenu"
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
        <h1 class="app-title">📊 交易日誌</h1>
      </div>

      <nav v-if="!isMobile" class="header-nav">
        <a href="#dashboard" class="nav-link">儀表板</a>
        <a href="#portfolio" class="nav-link">投資組合</a>
        <a href="#settings" class="nav-link">設定</a>
      </nav>

      <div class="header-right">
        <div class="user-info">
          <span v-if="!isMobile" class="last-update">
            最後更新: {{ lastUpdateTime }}
          </span>
          <div class="avatar">{{ userInitial }}</div>
        </div>
        <button
          class="theme-toggle"
          @click="toggleTheme"
          :title="themeStore.isDark ? '切換亮色模式' : '切換深色模式'"
          aria-label="Toggle theme"
        >
          {{ themeStore.isDark ? '☀️' : '🌙' }}
        </button>
        <button
          class="logout-btn btn btn-secondary btn-sm"
          @click="handleLogout"
        >
          登出
        </button>
      </div>
    </div>

    <!-- 進度條 -->
    <div v-if="portfolioStore.loading" class="progress-bar">
      <div class="progress-fill"></div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { useThemeStore } from '../stores/theme';
import { useToastStore } from '../stores/toast';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const themeStore = useThemeStore();
const toastStore = useToastStore();

const isMobile = ref(false);
const lastUpdateTime = ref('--:--');

const userInitial = computed(() => {
  return authStore.user?.name?.charAt(0).toUpperCase() || 'U';
});

const updateTime = () => {
  const now = new Date();
  lastUpdateTime.value = now.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toggleTheme = () => {
  themeStore.toggleTheme();
};

const toggleMenu = () => {
  // 通過 ref 呼叫父組件的 drawerRef
  const drawer = document.querySelector('[data-drawer]');
  if (drawer) {
    drawer.click();
  }
};

const handleLogout = () => {
  authStore.logout();
  toastStore.success('已登出');
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
  updateTime();
  setInterval(updateTime, 60000); // 每分鐘更新一次
});
</script>

<style scoped>
.header-bar {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: all var(--duration-normal) var(--easing-ease-in-out);
}

.header-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

@media (max-width: 768px) {
  .header-content {
    padding: 12px;
    gap: var(--space-md);
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex: 0 0 auto;
}

.menu-toggle {
  display: none;
  background: none;
  border: none;
  color: var(--text);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 200ms ease;
}

@media (max-width: 768px) {
  .menu-toggle {
    display: block;
  }
}

.menu-toggle:hover {
  color: var(--primary);
}

.app-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
  white-space: nowrap;
}

@media (max-width: 480px) {
  .app-title {
    font-size: 1.1rem;
  }
}

.header-nav {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
  flex: 1;
}

@media (max-width: 768px) {
  .header-nav {
    display: none;
  }
}

.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  transition: all 200ms ease;
  position: relative;
}

.nav-link:hover {
  color: var(--primary);
  background: rgba(31, 110, 251, 0.1);
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 12px;
  right: 12px;
  height: 2px;
  background: var(--primary);
  border-radius: 1px;
  opacity: 0;
  transition: opacity 200ms ease;
}

.nav-link:hover::after {
  opacity: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex: 0 0 auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

@media (max-width: 768px) {
  .user-info {
    gap: var(--space-xs);
  }
}

.last-update {
  font-size: 0.85rem;
  color: var(--text-muted);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .last-update {
    display: none;
  }
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.theme-toggle {
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  padding: 4px 8px;
  transition: transform 300ms ease;
  color: var(--text);
}

.theme-toggle:hover {
  transform: rotate(20deg);
}

.logout-btn {
  white-space: nowrap;
}

/* 進度條動畫 */
.progress-bar {
  height: 3px;
  background: var(--border);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gradient-primary);
  animation: progress 2s ease-in-out infinite;
}

@keyframes progress {
  0% {
    width: 0;
    transform: translateX(0);
  }
  50% {
    width: 100%;
  }
  100% {
    width: 100%;
    transform: translateX(100%);
  }
}
</style>
