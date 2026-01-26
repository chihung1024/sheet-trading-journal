import { ref } from 'vue';

// [Singleton State]
// 將狀態定義在函式外部，確保全應用共用同一份 Toast 列表
const toasts = ref([]);
let idCounter = 0;
const MAX_TOASTS = 5; // 畫面上最多同時顯示 5 則通知

export function useToast() {
  /**
   * 新增通知
   * @param {string} message - 通知內容
   * @param {string} type - 類型 ('success' | 'error' | 'warning' | 'info')
   * @param {number} duration - 顯示時間 (毫秒)，0 為不自動關閉
   * @param {string} title - (可選) 標題
   */
  const addToast = (message, type = 'info', duration = 3000, title = '') => {
    const id = idCounter++;
    
    // 建立新通知物件
    const toast = {
      id,
      message,
      type,
      title,
      duration
    };

    // 加入列表 (新訊息在最上方或最下方視 UI 設計而定，這裡採 Push)
    toasts.value.push(toast);

    // 數量限制檢查：若超過上限，移除最舊的
    if (toasts.value.length > MAX_TOASTS) {
      toasts.value.shift();
    }

    // 設定自動移除計時器
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  /**
   * 移除通知
   * @param {number} id - 通知 ID
   */
  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  };

  /**
   * 清空所有通知
   */
  const clearToasts = () => {
    toasts.value = [];
  };

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts
  };
}
