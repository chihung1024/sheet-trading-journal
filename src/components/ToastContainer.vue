<template>
  <div class="toast-container">
    <transition-group name="toast" tag="div">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
        role="alert"
      >
        <div class="toast-content">
          <span class="toast-icon">
            mponent :is="getIcon(toast.type)" />
          </span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
        <button
          class="toast-close"
          @click="toastStore.removeToast(toast.id)"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useToastStore } from '../stores/toast';

const toastStore = useToastStore();

const getIcon = (type) => {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };
  return icons[type] || 'ℹ';
};
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  pointer-events: none;
}

@media (max-width: 768px) {
  .toast-container {
    top: 16px;
    right: 16px;
    left: 16px;
  }
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
  border-radius: var(--radius-lg);
  font-size: 0.95rem;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  animation: slideInRight 300ms var(--easing-ease-out);
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-exit-active {
  animation: slideOutRight 300ms var(--easing-ease-in) forwards;
}

@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.toast-success {
  background: var(--success-light);
  color: white;
  border-left: 4px solid var(--success);
}

.toast-error {
  background: var(--error-light);
  color: white;
  border-left: 4px solid var(--error);
}

.toast-warning {
  background: var(--warning-light);
  color: white;
  border-left: 4px solid var(--warning);
}

.toast-info {
  background: var(--info-light);
  color: white;
  border-left: 4px solid var(--info);
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.toast-icon {
  font-weight: bold;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.toast-message {
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 1.2rem;
  transition: opacity 200ms ease;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
}

/* 轉場動畫 */
.toast-enter-active,
.toast-leave-active {
  transition: all 300ms var(--easing-ease-in-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
