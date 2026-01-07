<template>
  <teleport to="body">
    <transition name="drawer">
      <div v-if="isOpen" class="drawer-overlay" @click="close">
        <div class="drawer-content" @click.stop>
          <div class="drawer-header">
            <h2>菜單</h2>
            <button class="drawer-close" @click="close" aria-label="Close menu">✕</button>
          </div>
          <nav class="drawer-nav">
            <ul>
              <li v-for="item in navItems" :key="item.id">
                <a :href="item.href" @click.prevent="handleNavClick(item)">
                  {{ item.label }}
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref } from 'vue';

const isOpen = ref(false);

const navItems = ref([
  { id: 'dashboard', label: '儀表板', href: '#dashboard' },
  { id: 'portfolio', label: '投資組合', href: '#portfolio' },
  { id: 'trades', label: '交易紀錄', href: '#trades' },
  { id: 'settings', label: '設定', href: '#settings' },
]);

const toggle = () => {
  isOpen.value = !isOpen.value;
};

const close = () => {
  isOpen.value = false;
};

const handleNavClick = (item) => {
  console.log('Navigation to:', item.id);
  close();
};

defineExpose({ toggle, close });
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9000;
  animation: fadeIn 300ms var(--easing-ease-out);
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
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 280px;
  max-width: 90vw;
  background: var(--card-bg);
  box-shadow: var(--shadow-xl);
  overflow-y: auto;
  animation: slideInLeft 300ms var(--easing-ease-out);
  z-index: 9001;
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--border);
}

.drawer-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.drawer-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.5rem;
  padding: 4px 8px;
  transition: color 200ms ease;
}

.drawer-close:hover {
  color: var(--text);
}

.drawer-nav {
  padding: var(--space-md) 0;
}

.drawer-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.drawer-nav li {
  padding: 0;
}

.drawer-nav a {
  display: block;
  padding: 12px var(--space-lg);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 200ms ease;
  border-left: 3px solid transparent;
}

.drawer-nav a:hover {
  background: var(--bg-secondary);
  color: var(--primary);
  border-left-color: var(--primary);
}

/* 轉場動畫 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 300ms var(--easing-ease-in-out);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-active .drawer-content,
.drawer-leave-active .drawer-content {
  transition: transform 300ms var(--easing-ease-in-out);
}

.drawer-enter-from .drawer-content,
.drawer-leave-to .drawer-content {
  transform: translateX(-100%);
}
</style>
