import { ref, onMounted } from 'vue';

export function usePWA() {
  const needRefresh = ref(false);
  const offlineReady = ref(false);
  const deferredPrompt = ref(null);

  /**
   * 更新 Service Worker
   * 當偵測到新版本時，發送指令讓等待中的 SW 立即接管
   */
  const updateServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          // 向正在等待的 SW 發送 SKIP_WAITING 指令
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          // 如果沒有等待中的 SW，直接執行頁面重新整理
          window.location.reload();
        }
      });
    }
  };

  /**
   * 強制清空瀏覽器快取並重新載入
   * 透過發送消息給 Service Worker 來執行 caches.delete()
   */
  const forceClearCacheAndReload = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
      console.log('🧹 [PWA] 已發送清空快取指令...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      window.location.reload();
    }
  };

  /**
   * 手動觸發 PWA 安裝提示 (Add to Home Screen)
   */
  const installPWA = async () => {
    if (!deferredPrompt.value) return;
    deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    console.log(`👤 [PWA] 使用者安裝選擇: ${outcome}`);
    deferredPrompt.value = null;
  };

  onMounted(() => {
    // 1. 監聽 PWA 安裝提示 (A2HS)
    window.addEventListener('beforeinstallprompt', (e) => {
      // 防止某些瀏覽器自動彈出提示
      e.preventDefault();
      // 儲存事件，供後續在 UI 點擊按鈕時調用 installPWA()
      deferredPrompt.value = e;
      console.log('📦 [PWA] 已捕捉到安裝提示事件');
    });

    // 2. 監聽應用已成功安裝
    window.addEventListener('appinstalled', () => {
      deferredPrompt.value = null;
      console.log('✅ [PWA] 應用程式安裝成功');
    });

    // 3. 監聽 Service Worker 控制權變更
    if ('serviceWorker' in navigator) {
      // 當新的 SW 取得控制權 (透過 SKIP_WAITING 指令) 時觸發
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 [PWA] 控制器已變更，正在重新整理頁面以應用最新版本...');
        window.location.reload();
      });

      // 4. 監聽 Service Worker 更新狀態
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // 代表這是版本更新
                  needRefresh.value = true;
                  console.log('✨ [PWA] 發現伺服器端有新版本，請點擊更新按鈕刷新');
                } else {
                  // 代表初次載入並已緩存成功
                  offlineReady.value = true;
                  console.log('💾 [PWA] 靜態資源已成功緩存，現可離線使用');
                }
              }
            };
          }
        });
      });
    }
  });

  return {
    needRefresh,
    offlineReady,
    deferredPrompt,
    installPWA,
    updateServiceWorker,
    forceClearCacheAndReload
  };
}
