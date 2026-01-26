<template>
  <div class="toast-container">
    <TransitionGroup name="toast-list" tag="div" class="toast-wrapper">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="toast-card"
        :class="toast.type"
        @click="removeToast(toast.id)"
        role="alert"
      >
        <div class="toast-icon">
          <span v-if="toast.type === 'success'">✅</span>
          <span v-else-if="toast.type === 'error'">⛔</span>
          <span v-else-if="toast.type === 'warning'">⚠️</span>
          <span v-else>ℹ️</span>
        </div>

        <div class="toast-content">
          <h4 v-if="toast.title" class="toast-title">{{ toast.title }}</h4>
          <p class="toast-message">{{ toast.message }}</p>
        </div>

        <button class="toast-close" aria-label="Close">
          ×
        </button>

        <div class="progress-bar">
          <div class="progress-fill" :style="{ animationDuration: (toast.duration || 3000) + 'ms' }"></div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast';

// 使用 Composable 取得全域狀態
const { toasts, removeToast } = useToast();
</script>

<style scoped>
/* 容器定位 */
.toast-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none; /* 讓點擊穿透容器，只在卡片上觸發 */
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* Desktop 預設位置：右下 */
  bottom: 32px;
  right: 32px;
  width: 360px;
  max-width: 90vw;
}

.toast-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end; /* Desktop 靠右對齊 */
}

/* Toast 卡片本體 */
.toast-card {
  pointer-events: auto; /* 恢復點擊 */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.15), 
              0 4px 6px -4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 300px;
  max-width: 100%;
  border-left: 5px solid; /* 色條 */
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.toast-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 35px -10px rgba(0, 0, 0, 0.2);
}

/* 類型樣式 */
.toast-card.success {
  border-left-color: #10b981;
  background: linear-gradient(to right, rgba(16, 185, 129, 0.05), rgba(255, 255, 255, 0.95) 20%);
}
.toast-card.error {
  border-left-color: #ef4444;
  background: linear-gradient(to right, rgba(239, 68, 68, 0.05), rgba(255, 255, 255, 0.95) 20%);
}
.toast-card.warning {
  border-left-color: #f59e0b;
  background: linear-gradient(to right, rgba(245, 158, 11, 0.05), rgba(255, 255, 255, 0.95) 20%);
}
.toast-card.info {
  border-left-color: #3b82f6;
  background: linear-gradient(to right, rgba(59, 130, 246, 0.05), rgba(255, 255, 255, 0.95) 20%);
}

/* 暗色模式適配 */
:global(.dark) .toast-card {
  background: rgba(30, 41, 59, 0.95);
  color: #f1f5f9;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
}
:global(.dark) .toast-card.success { background: linear-gradient(to right, rgba(16, 185, 129, 0.15), rgba(30, 41, 59, 0.95) 20%); }
:global(.dark) .toast-card.error { background: linear-gradient(to right, rgba(239, 68, 68, 0.15), rgba(30, 41, 59, 0.95) 20%); }
:global(.dark) .toast-card.warning { background: linear-gradient(to right, rgba(245, 158, 11, 0.15), rgba(30, 41, 59, 0.95) 20%); }
:global(.dark) .toast-card.info { background: linear-gradient(to right, rgba(59, 130, 246, 0.15), rgba(30, 41, 59, 0.95) 20%); }

/* 內容排版 */
.toast-icon {
  font-size: 1.2rem;
  line-height: 1;
  padding-top: 2px;
}

.toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toast-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: inherit;
}

.toast-message {
  margin: 0;
  font-size: 0.9rem;
  color: inherit;
  opacity: 0.9;
  line-height: 1.4;
}

.toast-close {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.4;
  padding: 0 0 0 8px;
  color: inherit;
}

.toast-close:hover {
  opacity: 1;
}

/* 進度條動畫 */
.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0,0,0,0.05);
}

.progress-fill {
  height: 100%;
  background: currentColor; /* 跟隨文字顏色(通常是黑或白) */
  opacity: 0.2;
  width: 100%;
  transform-origin: left;
  animation-name: progress;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

.success .progress-fill { background: #10b981; opacity: 0.5; }
.error .progress-fill { background: #ef4444; opacity: 0.5; }
.warning .progress-fill { background: #f59e0b; opacity: 0.5; }
.info .progress-fill { background: #3b82f6; opacity: 0.5; }

@keyframes progress {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

/* Vue Transition Group 動畫 */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.9);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.9);
}

/* 讓移除時下方的項目平滑移動 */
.toast-list-move {
  transition: transform 0.4s ease;
}

/* 手機版 RWD */
@media (max-width: 768px) {
  .toast-container {
    top: 20px; /* 改為頂部 */
    bottom: auto;
    left: 20px;
    right: 20px;
    width: auto;
    align-items: center; /* 置中 */
  }

  .toast-wrapper {
    align-items: center; /* 置中 */
    width: 100%;
  }

  .toast-card {
    min-width: 0; /* 允許縮小 */
    width: 100%;
    border-radius: 16px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
  }

  /* 手機版進場動畫改為從上方滑入 */
  .toast-list-enter-from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  
  .toast-list-leave-to {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
}
</style>
