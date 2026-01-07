<template>
  <teleport to="body">
    <transition name="dialog">
      <div v-if="dialogStore.isOpen" class="dialog-backdrop" @click.self="dialogStore.cancel()">
        <div class="dialog-content" role="dialog" aria-modal="true">
          <div class="dialog-header">
            <h2 class="dialog-title">{{ dialogStore.title }}</h2>
            <button
              class="dialog-close"
              @click="dialogStore.cancel()"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>

          <div class="dialog-body">
            <p>{{ dialogStore.message }}</p>
          </div>

          <div class="dialog-footer">
            <button class="btn btn-secondary" @click="dialogStore.cancel()">
              {{ dialogStore.cancelText }}
            </button>
            <button
              :class="['btn', dialogStore.isDangerous ? 'btn-danger' : 'btn-primary']"
              @click="dialogStore.confirm()"
            >
              {{ dialogStore.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { useDialogStore } from '../stores/dialog';

const dialogStore = useDialogStore();
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
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

.dialog-content {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 90%;
  width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  animation: scaleIn 300ms var(--easing-ease-out);
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .dialog-content {
    width: calc(100% - 32px);
    margin: 16px;
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--border);
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.5rem;
  padding: 4px 8px;
  transition: color 200ms ease;
}

.dialog-close:hover {
  color: var(--text);
}

.dialog-body {
  padding: var(--space-lg);
  color: var(--text-secondary);
  line-height: 1.6;
}

.dialog-body p {
  margin: 0;
}

.dialog-footer {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg);
  border-top: 1px solid var(--border);
  justify-content: flex-end;
}

@media (max-width: 480px) {
  .dialog-footer {
    gap: var(--space-sm);
  }

  .dialog-footer .btn {
    flex: 1;
  }
}

/* 轉場動畫 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 300ms var(--easing-ease-in-out);
}

.dialog-enter-from,
.dialog-leave-to {
