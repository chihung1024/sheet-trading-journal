<template>
  <header class="header-bar">
    <div class="header-container">
      <!-- Logo 和品牌 -->
      <div class="header-brand">
        <button 
          class="menu-toggle"
          @click="toggleMenu"
          aria-label="切換菜單"
          :aria-expanded="menuOpen"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <h1 class="brand-title">📊 交易日誌</h1>
      </div>

      <!-- 導航菜單 -->
      <nav 
        class="header-nav"
        :class="{ open: menuOpen }"
        role="navigation"
        aria-label="主導航"
      >
        <ul class="nav-list">
          <li class="nav-item">
            <a href="#dashboard" class="nav-link" @click="closeMenu">
              📈 儀表板
            </a>
          </li>
          <li class="nav-item">
            <a href="#trades" class="nav-link" @click="closeMenu">
              💹 交易
            </a>
          </li>
          <li class="nav-item">
            <a href="#portfolio" class="nav-link" @click="closeMenu">
              🎯 投資組合
            </a>
          </li>
          <li class="nav-item">
            <a href="#analytics" class="nav-link" @click="closeMenu">
              📊 分析
            </a>
          </li>
        </ul>
      </nav>

      <!-- 用戶菜單 -->
      <div class="header-actions">
        <div class="search-box">
          <input 
            type="text"
            placeholder="搜索..."
            class="search-input"
            aria-label="搜索交易"
            @keydown.enter="handleSearch"
          >
          <button 
            class="search-btn"
            aria-label="執行搜索"
            @click="handleSearch"
          >
            🔍
          </button>
        </div>

        <div class="user-menu">
          <button 
            class="user-btn"
            @click="toggleUserMenu"
            :aria-expanded="userMenuOpen"
            aria-label="用戶菜單"
          >
            👤 {{ userName }}
          </button>

          <div 
            v-if="userMenuOpen"
            class="dropdown-menu user-dropdown"
            role="menu"
          >
            <button class="dropdown-item" role="menuitem" @click="handleSettings">
              ⚙️ 設置
            </button>
            <button class="dropdown-item" role="menuitem" @click="handleExport">
              📥 匯出數據
            </button>
            <hr class="dropdown-divider">
            <button class="dropdown-item danger" role="menuitem" @click="handleLogout">
              🚪 登出
            </button>
          </div>
        </div>

        <!-- 主題切換 -->
        <button 
          class="theme-toggle"
          @click="toggleTheme"
          :aria-label="`切換至${isDarkMode ? '亮色' : '暗色'}主題`"
          :title="`當前: ${isDarkMode ? '暗色' : '亮色'}模式`"
        >
          {{ isDarkMode ? '☀️' : '🌙' }}
        </button>
      </div>
    </div>

    <!-- 通知欄 -->
    <div v-if="notifications.length > 0" class="notification-bar">
      <div 
        v-for="(notification, index) in notifications"
        :key="index"
        class="notification-item"
        :class="`notification-${notification.type}`"
        role="status"
      >
        <span>{{ notification.message }}</span>
        <button 
          class="notification-close"
          @click="removeNotification(index)"
          aria-label="關閉通知"
        >
          ✕
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const menuOpen = ref(false);
const userMenuOpen = ref(false);
const isDarkMode = ref(true);
const notifications = ref([]);
const searchQuery = ref('');

const userName = computed(() => authStore.user?.name || '用戶');

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value;
};

const closeMenu = () => {
  menuOpen.value = false;
};

const toggleUserMenu = () => {
  userMenuOpen.value = !userMenuOpen.value;
};

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.setAttribute(
    'data-theme',
    isDarkMode.value ? 'dark' : 'light'
  );
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light');
};

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    // 發出搜索事件
    console.log('搜索:', searchQuery.value);
    searchQuery.value = '';
  }
};

const handleSettings = () => {
  userMenuOpen.value = false;
  console.log('打開設置');
};

const handleExport = () => {
  userMenuOpen.value = false;
  console.log('匯出數據');
};

const handleLogout = async () => {
  userMenuOpen.value = false;
  await authStore.logout();
};

const removeNotification = (index) => {
  notifications.value.splice(index, 1);
};

const addNotification = (message, type = 'info') => {
  notifications.value.push({ message, type });
  setTimeout(() => removeNotification(0), 5000);
};

// 監聽外部點擊
const handleClickOutside = (event) => {
  if (!event.target.closest('.user-menu')) {
    userMenuOpen.value = false;
  }
};

onMounted(() => {
  // 恢復主題設置
  const savedTheme = localStorage.getItem('theme') || 'dark';
  isDarkMode.value = savedTheme === 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  document.addEventListener('click', handleClickOutside);
});

defineExpose({ addNotification });
</script>

<style scoped>
.header-bar {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-md) var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-shrink: 0;
}

.menu-toggle {
  display: none;
  flex-direction: column;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.menu-toggle span {
  width: 24px;
  height: 2px;
  background: var(--text);
  transition: all 200ms ease;
  border-radius: 1px;
}

.brand-title {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text);
  font-weight: 700;
  white-space: nowrap;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  flex: 1;
}

.nav-list {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: var(--space-lg);
}

.nav-item {
  position: relative;
}

.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 500;
  transition: color 200ms ease;
  padding: 8px 0;
  border-bottom: 2px solid transparent;
}

.nav-link:hover {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px 12px;
}

.search-input {
  background: none;
  border: none;
  color: var(--text);
  font-size: 0.9rem;
  outline: none;
  width: 200px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  transition: color 200ms ease;
}

.search-btn:hover {
  color: var(--primary);
}

.user-menu {
  position: relative;
}

.user-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 200ms ease;
}

.user-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  min-width: 180px;
  margin-top: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  animation: slideDown 200ms ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 200ms ease;
}

.dropdown-item:hover {
  background: var(--bg-secondary);
  color: var(--primary);
}

.dropdown-item.danger:hover {
  background: rgba(248, 81, 73, 0.1);
  color: var(--error-light);
}

.dropdown-divider {
  margin: 8px 0;
  border: none;
  border-top: 1px solid var(--border);
}

.theme-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 8px;
  border-radius: var(--radius-md);
  transition: all 200ms ease;
}

.theme-toggle:hover {
  background: var(--bg-secondary);
}

.notification-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--border);
}

.notification-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  animation: slideDown 300ms ease-out;
}

.notification-info {
  background: rgba(31, 110, 251, 0.1);
  border: 1px solid rgba(31, 110, 251, 0.3);
  color: rgba(31, 110, 251, 0.9);
}

.notification-success {
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.3);
  color: rgba(76, 175, 80, 0.9);
}

.notification-error {
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid rgba(248, 81, 73, 0.3);
  color: rgba(248, 81, 73, 0.9);
}

.notification-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px;
  opacity: 0.7;
  transition: opacity 200ms ease;
}

.notification-close:hover {
  opacity: 1;
}

@media (max-width: 768px) {
  .menu-toggle {
    display: flex;
  }

  .header-container {
    padding: var(--space-md);
    gap: var(--space-md);
  }

  .header-nav {
    position: fixed;
    left: 0;
    top: 60px;
    right: 0;
    bottom: 0;
    flex-direction: column;
    background: var(--card-bg);
    border-top: 1px solid var(--border);
    padding: var(--space-lg);
    gap: var(--space-md);
    transform: translateX(-100%);
    transition: transform 300ms ease;
    z-index: 99;
  }

  .header-nav.open {
    transform: translateX(0);
  }

  .nav-list {
    flex-direction: column;
    gap: var(--space-md);
  }

  .header-actions {
    display: none;
  }

  .search-box {
    display: none;
  }

  .brand-title {
    font-size: 1.1rem;
  }
}
</style>
