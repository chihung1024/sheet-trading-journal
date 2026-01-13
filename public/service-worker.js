const CACHE_NAME = 'trading-journal-v20260114';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

// 需要緩存的靜態資源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim();
});

// 攔截請求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳過非 HTTP(S) 請求
  if (!request.url.startsWith('http')) {
    return;
  }

  // API 請求：網絡優先策略
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 不緩存 API 響應
          return response;
        })
        .catch((error) => {
          console.log('[SW] API request failed:', error);
          // 返回離線頁面或錯誤信息
          return new Response(
            JSON.stringify({ 
              error: 'Offline', 
              message: '無法連接到服務器，請檢查網絡連接' 
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503
            }
          );
        })
    );
    return;
  }

  // ✅ 對 HTML/JS/CSS 使用「網絡優先」策略，確保總是獲取最新版本
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      request.url.endsWith('.html') ||
      request.url.endsWith('.js') ||
      request.url.endsWith('.css')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功獲取後更新快取
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // 網絡失敗時才使用快取（離線支援）
          console.log('[SW] Network failed, using cache for:', request.url);
          return caches.match(request);
        })
    );
    return;
  }

  // 其他靜態資源（圖片、字體等）：緩存優先策略
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // 只緩存成功的 GET 請求
        if (
          !response ||
          response.status !== 200 ||
          response.type !== 'basic' ||
          request.method !== 'GET'
        ) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});

// 監聽消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

// 後台同步
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // 執行數據同步邏輯
      syncDataToServer()
    );
  }
});

// 推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Trading Journal';
  const options = {
    body: data.body || '您有新的通知',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: [
      { action: 'open', title: '查看' },
      { action: 'close', title: '關閉' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 通知點擊
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});

// 輔助函數：同步數據到服務器
async function syncDataToServer() {
  try {
    // 實現數據同步邏輯
    console.log('[SW] Syncing data to server...');
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    return Promise.reject(error);
  }
}
