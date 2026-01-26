<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="toast-item"
        :class="toast.type"
      >
        <div class="toast-icon">
          <span v-if="toast.type === 'success'">✅</span>
          <span v-else-if="toast.type === 'error'">❌</span>
          <span v-else-if="toast.type === 'warning'">⚠️</span>
          <span v-else>ℹ️</span>
        </div>
        <span class="message">{{ toast.message }}</span>
        <button class="close-btn" @click="removeToast(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast';

// 使用與 App.vue 相同的 composable，因為 state 是全域共用的
const { toasts, removeToast } = useToast();
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none; /* 讓點擊穿透容器 */
}

.toast-item {
  pointer-events: auto; /* 恢復卡片的點擊事件 */
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-left-width: 4px;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 300px;
  max-width: 400px;
  color: var(--text-main, #1f2937);
  animation: slideIn 0.3s ease-out;
}

/* 類型樣式 */
.toast-item.success { border-left-color: #10b981; }
.toast-item.error { border-left-color: #ef4444; }
.toast-item.warning { border-left-color: #f59e0b; }
.toast-item.info { border-left-color: #3b82f6; }

.toast-icon { font-size: 1.2rem; }
.message { font-size: 0.95rem; flex: 1; line-height: 1.4; }

.close-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.4rem;
  color: #9ca3af;
  line-height: 1;
  padding: 0 4px;
}
.close-btn:hover { color: #4b5563; }

/* Vue Transition 動畫 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Dark mode 適配 (若全域有定義變數) */
:global(.dark-mode) .toast-item {
  background: #1f2937;
  border-color: #374151;
  color: #f3f4f6;
}
</style>
