<template>
  <div class="toast-container" role="region" aria-live="polite" aria-atomic="true">
    <transition-group name="toast" tag="div">
      <div 
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="[`toast-${toast.type}`, { 'toast-closable': toast.closable }]"
        role="status"
        :aria-label="`${toast.type}消息: ${toast.message}`"
      >
        <div class="toast-icon">{{ getIcon(toast.type) }}</div>
        <div class="toast-content">
          <p v-if="toast.title" class="toast-title">{{ toast.title }}</p>
          <p class="toast-message">{{ toast.message }}</p>
        </div>

        <!-- 進度條 -->
        <div 
          v-if="toast.duration"
          class="toast-progress"
          :style="{ animationDuration: `${toast.duration}ms` }"
        ></div>

        <!-- 關閉按鈕 -->
        <button 
          v-if="toast.closable"
          class="toast-close"
          @click="removeToast(toast.id)"
          aria-label="關閉消息"
        >
          ✕
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const toasts = ref([]);
let toastId = 0;

const getIcon = (type) => {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[type] || 'ℹ️';
};

const addToast = (message, options = {}) => {
  const {
    type = 'info',
    title = '',
    duration = 3000,
    closable = true
  } = options;

  const id = ++toastId;
  const toast = {
    id,
    message,
    type,
    title,
    duration,
    closable
  };

  toasts.value.push(toast);

  // 自動移除
  if (duration) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
};

const removeToast = (id) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

const success = (message, options = {}) => {
  return addToast(message, { ...options, type: 'success' });
};

const error = (message, options = {}) => {
  return addToast(message, { ...options, type: 'error', duration: 5000 });
};

const warning = (message, options = {}) => {
  return addToast(message, { ...options, type: 'warning' });
};

const info = (message, options = {}) => {
  return addToast(message, { ...options, type: 'info' });
};

const clear = () => {
  toasts.value = [];
};

defineExpose({
  addToast,
  removeToast,
  success,
  error,
  warning,
  info,
  clear
});
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-lg);
  right: var(--space-lg);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px solid;
  background: var(--card-bg);
  min-width: 300px;
  max-width: 400px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  animation: slideIn 300ms ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(400px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideOut {
  to {
    opacity: 0;
    transform: translateX(400px);
  }
}

.toast-icon {
  flex-shrink: 0;
  font-size: 1.3rem;
  line-height: 1;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  margin: 0 0 4px 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
}

.toast-message {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
  word-break: break-word;
}

.toast-success {
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.3);
  color: #4cb050;
}

.toast-success .toast-icon {
  color: #4cb050;
}

.toast-error {
  background: rgba(248, 81, 73, 0.1);
  border-color: rgba(248, 81, 73, 0.3);
  color: var(--error-light);
}

.toast-error .toast-icon {
  color: var(--error-light);
}

.toast-warning {
  background: rgba(255, 152, 0, 0.1);
  border-color: rgba(255, 152, 0, 0.3);
  color: #ff9800;
}

.toast-warning .toast-icon {
  color: #ff9800;
}

.toast-info {
  background: rgba(31, 110, 251, 0.1);
  border-color: rgba(31, 110, 251, 0.3);
  color: var(--primary);
}

.toast-info .toast-icon {
  color: var(--primary);
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: currentColor;
  opacity: 0.5;
  animation: progress linear forwards;
}

@keyframes progress {
  from {
    width: 100%;
  }
  to {
    width: 0;
  }
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px;
  opacity: 0.7;
  transition: opacity 200ms ease;
}

.toast-close:hover {
  opacity: 1;
}

.toast-leave-active {
  animation: slideOut 300ms ease-out;
}

.toast-enter-active {
  animation: slideIn 300ms ease-out;
}

@media (max-width: 640px) {
  .toast-container {
    top: auto;
    bottom: var(--space-lg);
    right: var(--space-md);
    left: var(--space-md);
  }

  .toast {
    min-width: auto;
    max-width: none;
  }
}
</style>
