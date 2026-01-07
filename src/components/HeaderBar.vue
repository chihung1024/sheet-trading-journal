<template>
  <header class="header-bar">
    <div class="header-container">
      <!-- Left section: Logo and Menu Toggle -->
      <div class="header-start">
        <button
          class="menu-toggle"
          @click="toggleMenu"
          aria-label="Toggle navigation menu"
          :aria-expanded="menuOpen"
          :class="{ active: menuOpen }"
        >
          <span />
          <span />
          <span />
        </button>
        <h1 class="brand-title">📊 Trading Journal</h1>
      </div>

      <!-- Center section: Navigation -->
      <nav
        class="header-nav"
        :class="{ open: menuOpen }"
        role="navigation"
        aria-label="Main navigation"
      >
        <ul class="nav-list">
          <li class="nav-item">
            <a
              href="#dashboard"
              class="nav-link"
              @click="closeMenu"
            >
              📈 Dashboard
            </a>
          </li>
          <li class="nav-item">
            <a
              href="#trades"
              class="nav-link"
              @click="closeMenu"
            >
              💹 Trades
            </a>
          </li>
          <li class="nav-item">
            <a
              href="#analysis"
              class="nav-link"
              @click="closeMenu"
            >
              📊 Analysis
            </a>
          </li>
          <li class="nav-item">
            <a
              href="#settings"
              class="nav-link"
              @click="closeMenu"
            >
              ⚙️ Settings
            </a>
          </li>
        </ul>
      </nav>

      <!-- Right section: Actions and User Menu -->
      <div class="header-end">
        <div class="search-box">
          <input
            type="text"
            placeholder="Search..."
            class="search-input"
            aria-label="Search trades"
          />
        </div>
        <div class="header-actions">
          <button
            class="icon-button"
            aria-label="Notifications"
            title="Notifications"
          >
            🔔
          </button>
          <button
            class="icon-button"
            aria-label="Theme toggle"
            @click="$emit('toggle-theme')"
            title="Toggle dark mode"
          >
            🌓
          </button>
          <button
            class="icon-button user-avatar"
            aria-label="User menu"
            @click="toggleUserMenu"
            title="User options"
          >
            👤
          </button>
        </div>
        <!-- User dropdown menu -->
        <div v-if="userMenuOpen" class="user-dropdown">
          <a href="#profile" class="dropdown-item">Profile</a>
          <a href="#settings" class="dropdown-item">Settings</a>
          <hr class="dropdown-divider" />
          <button class="dropdown-item logout-btn" @click="handleLogout">
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useAuthStore } from '@/stores/auth';

export default {
  name: 'HeaderBar',
  emits: ['toggle-theme'],
  setup(props, { emit }) {
    const authStore = useAuthStore();
    const menuOpen = ref(false);
    const userMenuOpen = ref(false);

    const toggleMenu = () => {
      menuOpen.value = !menuOpen.value;
    };

    const closeMenu = () => {
      menuOpen.value = false;
    };

    const toggleUserMenu = () => {
      userMenuOpen.value = !userMenuOpen.value;
    };

    const handleLogout = async () => {
      await authStore.logout();
      userMenuOpen.value = false;
    };

    const handleClickOutside = (event) => {
      const nav = document.querySelector('.header-nav');
      const userDropdown = document.querySelector('.user-dropdown');
      const menuToggle = document.querySelector('.menu-toggle');
      const userBtn = document.querySelector('.user-avatar');

      if (nav && !nav.contains(event.target) && !menuToggle.contains(event.target)) {
        closeMenu();
      }

      if (userDropdown && !userDropdown.contains(event.target) && !userBtn.contains(event.target)) {
        userMenuOpen.value = false;
      }
    };

    onMounted(() => {
      document.addEventListener('click', handleClickOutside);
    });

    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside);
    });

    return {
      authStore,
      menuOpen,
      userMenuOpen,
      toggleMenu,
      closeMenu,
      toggleUserMenu,
      handleLogout,
    };
  },
};
</script>

<style scoped>
:root {
  --header-height: 64px;
  --header-bg: #ffffff;
  --header-text: #1a1a1a;
  --header-border: #e0e0e0;
  --header-hover: #f5f5f5;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --radius-md: 8px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.15);
}

[data-theme='dark'] {
  --header-bg: #1a1a1a;
  --header-text: #ffffff;
  --header-border: #2d2d2d;
  --header-hover: #2d2d2d;
}

.header-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--header-height);
  background-color: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  box-shadow: var(--shadow-sm);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.header-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
  padding: 0 var(--spacing-md);
  gap: var(--spacing-lg);
}

.header-start {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.menu-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  padding: var(--spacing-sm);
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease;
}

.menu-toggle:hover,
.menu-toggle.active {
  background-color: var(--header-hover);
}

.menu-toggle span {
  width: 20px;
  height: 2px;
  background-color: var(--header-text);
  margin: 3px 0;
  border-radius: 1px;
  transition: all 0.3s ease;
}

.menu-toggle.active span:nth-child(1) {
  transform: rotate(45deg) translate(8px, 8px);
}

.menu-toggle.active span:nth-child(2) {
  opacity: 0;
}

.menu-toggle.active span:nth-child(3) {
  transform: rotate(-45deg) translate(8px, -8px);
}

.brand-title {
  margin: 0;
  padding: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--header-text);
  white-space: nowrap;
  letter-spacing: -0.5px;
}

.header-nav {
  flex: 1;
  display: flex;
  justify-content: center;
}

.nav-list {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: var(--spacing-lg);
}

.nav-item {
  position: relative;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-sm) 0;
  color: var(--header-text);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  transition: color 0.2s ease;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  gap: 4px;
}

.nav-link:hover {
  color: #2196f3;
  border-bottom-color: #2196f3;
}

.header-end {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.search-box {
  position: relative;
  display: none;
  width: 220px;
}

.search-input {
  width: 100%;
  padding: 6px 12px 6px 36px;
  background-color: var(--header-hover);
  border: 1px solid var(--header-border);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  color: var(--header-text);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.search-input::placeholder {
  color: #999;
}

.search-input:focus {
  outline: none;
  border-color: #2196f3;
  background-color: var(--header-bg);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.icon-button {
  width: 40px;
  height: 40px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-md);
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.icon-button:hover {
  background-color: var(--header-hover);
}

.user-avatar {
  position: relative;
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 160px;
  background-color: var(--header-bg);
  border: 1px solid var(--header-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 1000;
  overflow: hidden;
  animation: slideDown 0.2s ease;
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
  padding: var(--spacing-md);
  color: var(--header-text);
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 0.95rem;
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.dropdown-item:hover {
  background-color: var(--header-hover);
}

.logout-btn {
  color: #f44336;
  font-weight: 500;
}

.logout-btn:hover {
  background-color: rgba(244, 67, 54, 0.1);
}

.dropdown-divider {
  margin: 0;
  border: none;
  border-top: 1px solid var(--header-border);
}

@media (max-width: 1024px) {
  .header-container {
    gap: var(--spacing-md);
  }

  .nav-list {
    gap: var(--spacing-md);
  }

  .header-end {
    gap: var(--spacing-sm);
  }
}

@media (max-width: 768px) {
  .header-bar {
    --header-height: 56px;
  }

  .header-container {
    padding: 0 var(--spacing-sm);
  }

  .menu-toggle {
    display: flex;
  }

  .brand-title {
    font-size: 1.1rem;
  }

  .header-nav {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    background-color: var(--header-bg);
    border-bottom: 1px solid var(--header-border);
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
  }

  .header-nav.open {
    max-height: 300px;
    box-shadow: var(--shadow-md);
  }

  .nav-list {
    flex-direction: column;
    gap: 0;
    padding: var(--spacing-md);
  }

  .nav-link {
    padding: var(--spacing-md);
    border-bottom: none;
    border-left: 2px solid transparent;
  }

  .nav-link:hover {
    border-bottom: none;
    border-left-color: #2196f3;
  }

  .search-box {
    display: none;
  }
}

@media (max-width: 480px) {
  .header-container {
    padding: 0 8px;
  }

  .brand-title {
    font-size: 1rem;
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-end {
    gap: 4px;
  }

  .icon-button {
    width: 36px;
    height: 36px;
    font-size: 1rem;
  }
}
</style>
