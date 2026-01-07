<template>
  <teleport to="body">
    <transition name="dialog">
      <div 
        v-if="isOpen"
        class="dialog-overlay"
        @click="handleBackdropClick"
        role="presentation"
      >
        <div 
          class="dialog-container"
          role="alertdialog"
          :aria-labelledby="titleId"
          :aria-describedby="descId"
          @click.stop
        >
          <!-- 關閉按鈕 -->
          <button 
            class="dialog-close"
            @click="handleCancel"
            aria-label="關閉對話框"
          >
            ✕
          </button>

          <!-- 標題 -->
          <h2 :id="titleId" class="dialog-title">{{ title }}</h2>

          <!-- 內容 -->
          <div :id="descId" class="dialog-content">
            <slot>{{ message }}</slot>
          </div>

          <!-- 操作按鈕 -->
          <div class="dialog-actions">
            <button 
              class="btn btn-secondary"
              @click="handleCancel"
              :disabled="isLoading"
            >
              {{ cancelText }}
            </button>
            <button 
              class="btn btn-primary"
              @click="handleConfirm"
              :disabled="isLoading"
              :aria-busy="isLoading"
            >
              <span v-if="!isLoading">{{ confirmText }}</span>
              <span v-else class="loading-spinner">
                <span class="spinner-icon">⟳</span>
                {{ loadingText }}
              </span>
            </button>
          </div>

          <!-- 錯誤消息 -->
          <div v-if="errorMessage" class="dialog-error" role="alert">
            {{ errorMessage }}
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '確認'
  },
  message: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: '確認'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  loadingText: {
    type: String,
    default: '處理中...'
  },
  isDangerous: {
    type: Boolean,
    default: false
  },
  onBackdropClick: {
    type: String,
    enum: ['close', 'ignore'],
    default: 'close'
  }
});

const emit = defineEmits(['confirm', 'cancel', 'update:isOpen']);

const isLoading = ref(false);
const errorMessage = ref('');
const titleId = computed(() => `dialog-title-${Math.random()}`);
const descId = computed(() => `dialog-desc-${Math.random()}`);

const handleCancel = () => {
  errorMessage.value = '';
  emit('cancel');
  emit('update:isOpen', false);
};

const handleConfirm = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    await emit('confirm');
    emit('update:isOpen', false);
  } catch (error) {
    errorMessage.value = error.message || '操作失敗，請重試';
  } finally {
    isLoading.value = false;
  }
};

const handleBackdropClick = () => {
  if (props.onBackdropClick === 'close') {
    handleCancel();
  }
};

defineExpose({
  setLoading: (loading) => { isLoading.value = loading; },
  setError: (error) => { errorMessage.value = error; }
});
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-md);
}

.dialog-container {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  max-width: 450px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  position: relative;
  animation: slideUp 300ms ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-close {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px;
  transition: color 200ms ease;
}

.dialog-close:hover {
  color: var(--text);
}

.dialog-title {
  margin: 0 0 var(--space-md) 0;
  color: var(--text);
  font-size: 1.25rem;
  font-weight: 700;
  word-break: break-word;
}

.dialog-content {
  margin: 0 0 var(--space-lg) 0;
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
  margin-bottom: var(--space-md);
}

.btn {
  padding: 10px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 200ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 100px;
}

.btn:hover:not(:disabled) {
  background: var(--border);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-secondary);
  border-color: var(--border);
}

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark, var(--primary));
  box-shadow: 0 4px 12px rgba(31, 110, 251, 0.3);
}

.loading-spinner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.spinner-icon {
  display: inline-block;
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.dialog-error {
  margin-top: var(--space-md);
  padding: var(--space-md);
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid rgba(248, 81, 73, 0.3);
  border-radius: var(--radius-md);
  color: var(--error-light);
  font-size: 0.9rem;
  animation: slideDown 300ms ease-out;
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

/* 修改：完整的 transition 動畫類名定義 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 300ms ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-to,
.dialog-leave-from {
  opacity: 1;
}

@media (max-width: 480px) {
  .dialog-container {
    margin: var(--space-md);
  }

  .dialog-actions {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
  }
}
</style>
