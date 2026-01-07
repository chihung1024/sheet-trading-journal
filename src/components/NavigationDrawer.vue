<template>
  <aside 
    class="navigation-drawer"
    :class="{ open: isOpen }"
    role="navigation"
    aria-label="側邊導航"
  >
    <!-- 背景遮蔽層 -->
    <div 
      v-if="isOpen"
      class="drawer-overlay"
      @click="closeDrawer"
      aria-hidden="true"
    ></div>

    <!-- 抽屜內容 -->
    <nav class="drawer-content">
      <div class="drawer-header">
        <h2 class="drawer-title">菜單</h2>
        <button 
          class="drawer-close"
          @click="closeDrawer"
          aria-label="關閉菜單"
        >
          ✕
        </button>
      </div>

      <!-- 導航菜單 -->
      <ul class="drawer-menu" role="menu">
        <li class="menu-section-title">主要功能</li>

        <li class="menu-item" role="none">
          <a 
            href="#dashboard"
            class="menu-link"
            :class="{ active: activeMenu === 'dashboard' }"
            @click="selectMenu('dashboard')"
            role="menuitem"
          >
            <span class="menu-icon">📈</span>
            <span class="menu-label">儀表板</span>
          </a>
        </li>

        <li class="menu-item" role="none">
          <a 
            href="#trades"
            class="menu-link"
            :class="{ active: activeMenu === 'trades' }"
            @click="selectMenu('trades')"
            role="menuitem"
          >
            <span class="menu-icon">💹</span>
            <span class="menu-label">交易記錄</span>
          </a>
        </li>

        <li class="menu-item" role="none">
          <a 
            href="#portfolio"
            class="menu-link"
            :class="{ active: activeMenu === 'portfolio' }"
            @click="selectMenu('portfolio')"
            role="menuitem"
          >
            <span class="menu-icon">🎯</span>
            <span class="menu-label">投資組合</span>
          </a>
        </li>

        <li class="menu-item" role="none">
          <a 
            href="#analytics"
            class="menu-link"
            :class="{ active: activeMenu === 'analytics' }"
            @click="selectMenu('analytics')"
            role="menuitem"
          >
            <span class="menu-icon">📊</span>
            <span class="menu-label">分析報告</span>
          </a>
        </li>

        <!-- 分隔線 -->
        <li class="menu-divider"></li>
        <li class="menu-section-title">工具</li>

        <li class="menu-item" role="none">
          <a 
            href="#import"
            class="menu-link"
            role="menuitem"
          >
            <span class="menu-icon">📥</span>
            <span class="menu-label">導入數據</span>
          </a>
        </li>

        <li class="menu-item" role="none">
          <a 
            href="#export"
            class="menu-link"
            role="menuitem"
          >
            <span class="menu-icon">📤</span>
            <span class="menu-label">匯出數據</span>
          </a>
        </li>

        <li class="menu-item" role="none">
          <a 
            href="#settings"
            class="menu-link"
            role="menuitem"
          >
            <span class="menu-icon">⚙️</span>
            <span class="menu-label">設置</span>
          </a>
        </li>

        <li class="menu-item" role="none">
          <a 
            href="#help"
            class="menu-link"
            role="menuitem"
          >
            <span class="menu-icon">❓</span>
            <span class="menu-label">幫助</span>
          </a>
        </li>
      </ul>

      <!-- 用戶信息卡 -->
      <div class="drawer-footer">
        <div class="user-info-card">
          <div class="user-avatar">{{ userInitial }}</div>
          <div class="user-details">
            <p class="user-name">{{ userName }}</p>
            <p class="user-email">{{ userEmail }}</p>
          </div>
        </div>
        <button 
          class="logout-btn"
          @click="handleLogout"
          role="menuitem"
        >
          🚪 登出
        </button>
      </div>
    </nav>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const isOpen = ref(false);
const activeMenu = ref('dashboard');

const userName = computed(() => authStore.user?.name || '用戶');
const userEmail = computed(() => authStore.user?.email || 'user@example.com');
const userInitial = computed(() => userName.value?.charAt(0).toUpperCase() || 'U');

const selectMenu = (menu) => {
  activeMenu.value = menu;
  // 在移動設備上關閉抽屜
  if (window.innerWidth <= 768) {
    closeDrawer();
  }
};

const openDrawer = () => {
  isOpen.value = true;
  document.body.style.overflow = 'hidden';
};

const closeDrawer = () => {
  isOpen.value = false;
  document.body.style.overflow = '';
};

const handleLogout = async () => {
  closeDrawer();
  await authStore.logout();
};

// 重要：修改 resize 事件監聽器處理方式
const handleResize = () => {
  if (window.innerWidth > 768 && isOpen.value) {
    closeDrawer();
  }
};

onMounted(() => {
  // 添加 resize 事件監聽器
  window.addEventListener('resize', handleResize);
});

// 重要：卸載時移除事件監聽器
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  // 確保在卸載時還原 body overflow
  document.body.style.overflow = '';
});

defineExpose({ openDrawer, closeDrawer });
</script>

<style scoped>
.navigation-drawer {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 280px;
  background: var(--card-bg);
  border-right: 1px solid var(--border);
  z-index: 99;
  overflow-y: auto;
  transition: transform 300ms ease;
}

.drawer-overlay {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 98;
  animation: fadeIn 300ms ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.drawer-content {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: var(--space-lg);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
}

.drawer-title {
  margin: 0;
  color: var(--text);
  font-size: 1.2rem;
  font-weight: 700;
}

.drawer-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px;
  transition: color 200ms ease;
}

.drawer-close:hover {
  color: var(--text);
}

.drawer-menu {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  overflow-y: auto;
}

.menu-section-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 1px;
  padding: var(--space-md) var(--space-sm);
  margin-top: var(--space-md);
  margin-bottom: var(--space-sm);
}

.menu-item {
  margin-bottom: 4px;
}

.menu-link {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 10px 12px;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.menu-link:hover {
  background: var(--bg-secondary);
  color: var(--primary);
}

.menu-link.active {
  background: rgba(31, 110, 251, 0.1);
  color: var(--primary);
  font-weight: 600;
  border-left: 3px solid var(--primary);
  padding-left: 9px;
}

.menu-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.menu-label {
  font-size: 0.95rem;
  font-weight: 500;
}

.menu-divider {
  height: 1px;
  background: var(--border);
  margin: var(--space-md) 0;
  border: none;
}

.drawer-footer {
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.user-info-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  margin: 0;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  width: 100%;
  padding: 10px;
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid rgba(248, 81, 73, 0.3);
  color: var(--error-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 200ms ease;
}

.logout-btn:hover {
  background: rgba(248, 81, 73, 0.2);
}

@media (max-width: 768px) {
  .navigation-drawer {
    width: 100%;
    max-width: 280px;
    transform: translateX(-100%);
  }

  .navigation-drawer.open {
    transform: translateX(0);
  }
}

/* 滾動條樣式 */
.drawer-menu::-webkit-scrollbar {
  width: 6px;
}

.drawer-menu::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-menu::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.drawer-menu::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
