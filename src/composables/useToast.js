import { ref } from 'vue';

const toasts = ref([]);

export function useToast() {
  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    toasts.value.push({ id, message, type });
    
    // 3秒後自動消失
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  const removeToast = (id) => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  };

  return { toasts, addToast, removeToast };
}
