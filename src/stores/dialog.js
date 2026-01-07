import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDialogStore = defineStore('dialog', () => {
  const isOpen = ref(false);
  const title = ref('');
  const message = ref('');
  const onConfirm = ref(null);
  const onCancel = ref(null);
  const confirmText = ref('確認');
  const cancelText = ref('取消');
  const isDangerous = ref(false);

  const openConfirm = (options) => {
    title.value = options.title || '確認操作';
    message.value = options.message || '';
    onConfirm.value = options.onConfirm || null;
    onCancel.value = options.onCancel || null;
    confirmText.value = options.confirmText || '確認';
    cancelText.value = options.cancelText || '取消';
    isDangerous.value = options.isDangerous || false;
    isOpen.value = true;
  };

  const closeConfirm = () => {
    isOpen.value = false;
  };

  const confirm = async () => {
    if (onConfirm.value) {
      try {
        await onConfirm.value();
      } catch (error) {
        console.error('Confirm error:', error);
      }
    }
    closeConfirm();
  };

  const cancel = () => {
    if (onCancel.value) {
      onCancel.value();
    }
    closeConfirm();
  };

  return {
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    isDangerous,
    openConfirm,
    closeConfirm,
    confirm,
    cancel,
  };
});
