<template>
  <div class="toast-container">
    <TransitionGroup name="toast-list" tag="div" class="toast-wrapper">
      <div 
        v-for="toast in toasts" 
        :key="toast.id"
        class="toast-card"
        :class="[toast.type, { 'is-paused': hoveredId === toast.id }]"
        @click="removeToast(toast.id)"
        @mouseenter="hoveredId = toast.id"
        @mouseleave="hoveredId = null"
      >
        <div class="toast-icon">
          <span v-if="toast.type === 'success'">✓</span>
          <span v-else-if="toast.type === 'error'">✕</span>
          <span v-else-if="toast.type === 'warning'">!</span>
          <span v-else>ℹ</span>
        </div>

        <div class="toast-content">
          <p class="toast-message">{{ toast.message }}</p>
        </div>

        <button class="btn-close" aria-label="Close">×</button>

        <div class="progress-track" v-if="toast.timeout > 0">
          <div 
            class="progress-fill" 
            :style="{ animationDuration: `${toast.timeout}ms` }"
          ></div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useToast } from '../composables/useToast';

// 取得全域 Toast 狀態
const { toasts, removeToast } = useToast();

// 用於控制暫停倒數 (雖然 CSS animation-play-state 可以處理，但 JS 狀態可用於擴充邏輯)
const hoveredId = ref(null);

</script>

<style scoped>
/* Container Positioning */
.toast-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none; /* Allow clicks to pass through empty areas */
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  /* Desktop Position: Bottom Right */
  bottom: 24px;
  right: 24px;
  width: 360px;
  max-width: 90vw;
}

.toast-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end; /* Align cards to right on desktop */
}

/* Toast Card Base */
.toast-card {
  pointer-events: auto; /* Re-enable clicks on cards */
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(8px);
  transform-origin: center right;
  transition: transform 0.2s, box-shadow 0.2s;
}

.toast-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15);
}

/* Type Variants */
.toast-card.success { border-left: 4px solid var(--success); background: linear-gradient(to right, rgba(16, 185, 129, 0.05), var(--bg-card)); }
.toast-card.success .toast-icon { color: var(--success); background: rgba(16, 185, 129, 0.1); }
.toast-card.success .progress-fill { background: var(--success); }

.toast-card.error { border-left: 4px solid var(--danger); background: linear-gradient(to right, rgba(239, 68, 68, 0.05), var(--bg-card)); }
.toast-card.error .toast-icon { color: var(--danger); background: rgba(239, 68, 68, 0.1); }
.toast-card.error .progress-fill { background: var(--danger); }

.toast-card.warning { border-left: 4px solid var(--warning); background: linear-gradient(to right, rgba(245, 158, 11, 0.05), var(--bg-card)); }
.toast-card.warning .toast-icon { color: var(--warning); background: rgba(245, 158, 11, 0.1); }
.toast-card.warning .progress-fill { background: var(--warning); }

.toast-card.info { border-left: 4px solid var(--primary); background: linear-gradient(to right, rgba(59, 130, 246, 0.05), var(--bg-card)); }
.toast-card.info .toast-icon { color: var(--primary); background: rgba(59, 130, 246, 0.1); }
.toast-card.info .progress-fill { background: var(--primary); }

/* Icon */
.toast-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
  margin-top: 2px;
}

/* Content */
.toast-content {
  flex: 1;
  padding-right: 12px;
}

.toast-message {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-main);
  line-height: 1.4;
  font-weight: 500;
}

/* Close Button */
.btn-close {
  background: transparent;
  border: none;
  color: var(--text-sub);
  font-size: 1.2rem;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
  margin-top: 2px;
}
.btn-close:hover { opacity: 1; }

/* Progress Bar */
.progress-track {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: rgba(0,0,0,0.05);
}

.progress-fill {
  height: 100%;
  width: 100%;
  transform-origin: left;
  animation-name: progress-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

/* Pause animation on hover */
.toast-card.is-paused .progress-fill {
  animation-play-state: paused;
}

@keyframes progress-shrink {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

/* Transition Animations (Vue TransitionGroup) */
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

.toast-list-move {
  transition: transform 0.4s ease;
}

/* RWD: Mobile Bottom Center */
@media (max-width: 768px) {
  .toast-container {
    right: 16px;
    left: 16px;
    bottom: 24px; /* Above bottom nav if any */
    width: auto;
    max-width: none;
    align-items: center;
  }
  
  .toast-wrapper {
    align-items: center;
    width: 100%;
  }
  
  .toast-card {
    width: 100%;
    max-width: 400px; /* Prevent overly wide toasts on tablets */
    transform-origin: center bottom;
  }
  
  /* Adjust animation for mobile (slide up) */
  .toast-list-enter-from,
  .toast-list-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
}
</style>
