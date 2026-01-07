import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([]);
  let toastId = 0;

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = toastId++;
    const toast = { id, message, type };
    toasts.value.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  };

  const success = (message, duration = 3000) => addToast(message, 'success', duration);
  const error = (message, duration = 4000) => addToast(message, 'error', duration);
  const warning = (message, duration = 3500) => addToast(message, 'warning', duration);
  const info = (message, duration = 3000) => addToast(message, 'info', duration);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
});
