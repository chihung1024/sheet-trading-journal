<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast-slide">
        <div 
          v-for="toast in toasts" 
          :key="toast.id" 
          class="toast-card"
          :class="toast.type"
          @click="removeToast(toast.id)"
          role="alert"
        >
          <div class="toast-icon-wrapper">
             <span class="icon" v-if="toast.type === 'success'">✓</span>
             <span class="icon" v-else-if="toast.type === 'error'">✕</span>
             <span class="icon" v-else-if="toast.type === 'warning'">!</span>
             <span class="icon" v-else>i</span>
          </div>
          
          <div class="toast-content">
             <div v-if="toast.title" class="toast-title">{{ toast.title }}</div>
             <div class="toast-message">{{ toast.message }}</div>
          </div>
          
          <button class="btn-close" aria-label="Close">
            <span class="close-icon">×</span>
          </button>
          
          <div class="progress-track" v-if="toast.duration !== 0">
             <div 
                class="progress-fill" 
                :style="{ animationDuration: `${toast.duration || 3000}ms` }"
             ></div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast';

// 取得全域 Toast 狀態
const { toasts, removeToast } = useToast();
</script>

<style scoped>
/* 容器定位 - 使用 Teleport 確保層級 */
.toast-container {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none; /* 讓點擊穿透容器空白處 */
  padding: 10px;
}

/* Toast 卡片本體 */
.toast-card {
  pointer-events: auto; /* 恢復卡片點擊 */
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 320px;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 50px -10px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05);
}

/* 類型樣式配色 */
.toast-card.success { border-left: 4px solid #10b981; }
.toast-card.success .icon { background: #10b981; color: white; }

.toast-card.error { border-left: 4px solid #ef4444; }
.toast-card.error .icon { background: #ef4444; color: white; }

.toast-card.warning { border-left: 4px solid #f59e0b; }
.toast-card.warning .icon { background: #f59e0b; color: white; }

.toast-card.info { border-left: 4px solid #3b82f6; }
.toast-card.info .icon { background: #3b82f6; color: white; }

/* 圖示 */
.toast-icon-wrapper {
  flex-shrink: 0;
  padding-top: 2px;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-weight: 800;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* 內容區 */
.toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toast-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1f2937;
}

.toast-message {
  font-size: 0.9rem;
  color: #4b5563;
  line-height: 1.5;
}

/* 關閉按鈕 */
.btn-close {
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0 0 0 8px;
  transition: color 0.2s;
  display: flex;
  align-items: flex-start;
}

.close-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.btn-close:hover {
  color: #1f2937;
}

/* 進度條 */
.progress-track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0,0,0,0.05);
}

.progress-fill {
  height: 100%;
  background: rgba(0,0,0,0.1);
  width: 100%;
  transform-origin: left;
  animation: progress linear forwards;
}

.toast-card.success .progress-fill { background: #10b981; }
.toast-card.error .progress-fill { background: #ef4444; }
.toast-card.warning .progress-fill { background: #f59e0b; }
.toast-card.info .progress-fill { background: #3b82f6; }

@keyframes progress {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

/* 進場動畫 */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

/* 手機版適配 */
@media (max-width: 768px) {
  .toast-container {
    bottom: 24px;
    left: 16px;
    right: 16px;
    align-items: center;
  }

  .toast-card {
    min-width: 0;
    width: 100%;
    max-width: 100%;
    border-left: none; /* 手機版移除左側邊框，改用背景色強調 */
    border-top: 4px solid transparent;
  }
  
  .toast-card.success { border-top-color: #10b981; }
  .toast-card.error { border-top-color: #ef4444; }
  .toast-card.warning { border-top-color: #f59e0b; }
  .toast-card.info { border-top-color: #3b82f6; }

  .toast-slide-enter-from,
  .toast-slide-leave-to {
    transform: translateY(20px);
    opacity: 0;
  }
}

/* 深色模式支援 (若全域有 dark 類別) */
:global(.dark) .toast-card {
  background: rgba(30, 41, 59, 0.95);
  border: 1px solid rgba(255,255,255,0.1);
}
:global(.dark) .toast-title { color: #f1f5f9; }
:global(.dark) .toast-message { color: #cbd5e1; }
</style>
