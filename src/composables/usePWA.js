import { ref, onMounted } from 'vue';

export function usePWA() {
  const isInstallable = ref(false);
  const deferredPrompt = ref(null);
  const isInstalled = ref(false);
  const isOnline = ref(navigator.onLine);

  // 檢測是否已安裝
  const checkIfInstalled = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled.value = true;
    }
    
    if (navigator.standalone === true) {
      isInstalled.value = true;
    }
  };

  // 監聽安裝提示事件
  const listenForInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt.value = e;
      isInstallable.value = true;
    });

    window.addEventListener('appinstalled', () => {
      isInstalled.value = true;
      isInstallable.value = false;
      deferredPrompt.value = null;
      console.log('PWA installed successfully');
    });
  };

  // 觸發安裝
  const install = async () => {
    if (!deferredPrompt.value) {
      return false;
    }

    deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      deferredPrompt.value = null;
      isInstallable.value = false;
      return true;
    }
    
    return false;
  };

  // 監聽網絡狀態
  const setupNetworkListeners = () => {
    window.addEventListener('online', () => {
      isOnline.value = true;
      console.log('App is online');
    });

    window.addEventListener('offline', () => {
      isOnline.value = false;
      console.log('App is offline');
    });
  };

  // 註冊 Service Worker
  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(
          '/service-worker.js',
          { scope: '/' }
        );
        
        console.log('Service Worker registered:', registration);

        // 監聽更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 有新版本可用
              console.log('New version available');
              
              if (confirm('發現新版本，是否立即更新？')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });

        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  };

  // 請求通知權限
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  // 發送通知
  const sendNotification = (title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        ...options
      });
    }
  };

  // 清除緩存
  const clearCache = async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
      return true;
    }
    return false;
  };

  onMounted(() => {
    checkIfInstalled();
    listenForInstallPrompt();
    setupNetworkListeners();
    registerServiceWorker();
  });

  return {
    isInstallable,
    isInstalled,
    isOnline,
    install,
    requestNotificationPermission,
    sendNotification,
    clearCache
  };
}
