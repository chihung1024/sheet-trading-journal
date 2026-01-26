import { ref } from 'vue';
import { registerSW } from 'virtual:pwa-register';

// [Singleton State]
// 全域共用狀態，讓任何組件都能偵測更新
const needRefresh = ref(false);
const offlineReady = ref(false);
const updateServiceWorker = ref(undefined);

export function usePWA() {
  /**
   * 初始化 PWA 註冊
   * 建議在 main.js 或 App.vue mounted 時呼叫一次
   */
  const initPWA = () => {
    // 如果已經註冊過，直接返回
    if (updateServiceWorker.value) return;

    updateServiceWorker.value = registerSW({
      immediate: true, // 立即註冊 SW
      
      /**
       * 當 Service Worker 下載完畢並準備好離線工作時觸發
       */
      onOfflineReady() {
        console.log('📱 App ready to work offline');
        offlineReady.value = true;
        // 3秒後自動隱藏離線就緒提示
        setTimeout(() => {
          offlineReady.value = false;
        }, 3000);
      },

      /**
       * 當發現新版本 Service Worker 時觸發
       */
      onNeedRefresh() {
        console.log('✨ New content available, click on reload button to update.');
        needRefresh.value = true;
      },

      /**
       * 註冊錯誤處理
       */
      onRegisterError(error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    });
  };

  /**
   * 手動觸發更新
   * 當 needRefresh 為 true 時，UI 呼叫此函式來更新 SW 並重整頁面
   */
  const reloadApp = async () => {
    if (updateServiceWorker.value) {
      await updateServiceWorker.value(true); // true 表示強制 reload
    }
  };

  /**
   * 定期檢查更新 (選用)
   * @param {number} interval - 檢查間隔 (毫秒)，預設 1 小時
   */
  const enableAutoUpdateCheck = (interval = 60 * 60 * 1000) => {
    if ('serviceWorker' in navigator) {
      setInterval(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          console.log('🔄 Checking for PWA updates...');
          registration.update();
        }
      }, interval);
    }
  };

  // 自動啟動註冊
  initPWA();

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: reloadApp,
    enableAutoUpdateCheck
  };
}
