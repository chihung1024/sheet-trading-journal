// Service Worker v1.0.5 - FORCE NETWORK
const CACHE_VERSION = 'v1.0.5-20260111-0045';
const CACHE_NAME = `trading-journal-${CACHE_VERSION}`;

// ⚠️ 絽急模式：先從網路請求，失敗再用快取
const EMERGENCY_MODE = true;

// 需要快取的資源
const urlsToCache = [
  '/'
];

// 安裝事件
self.addEventListener('install', (event) => {
  console.log('%c[SW] 🔥 Installing v' + CACHE_VERSION, 'color: #ff6b6b; font-weight: bold');
  
  event.waitUntil(
    // 直接 skipWaiting，不快取
    self.skipWaiting()
  );
});

// 啟動事件：清除所有舊快取
self.addEventListener('activate', (event) => {
  console.log('%c[SW] ✅ Activating v' + CACHE_VERSION, 'color: #51cf66; font-weight: bold');
  
  event.waitUntil(
    Promise.all([
      // 1. 刪除所有舊快取
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('%c[SW] 🗑️ Deleting cache: ' + cacheName, 'color: #ffa94d');
            return caches.delete(cacheName);
          })
        );
      }),
      // 2. 立即控制所有頁面
      self.clients.claim(),
      // 3. 通知所有客戶端重新載入
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_CLEARED',
            version: CACHE_VERSION,
            message: '快取已清除，請重新整理頁面'
          });
        });
      })
    ]).then(() => {
      console.log('%c[SW] 🎉 All caches cleared! Ready for fresh content.', 'color: #51cf66; font-weight: bold');
    })
  );
});

// Fetch 事件：絽急模式 - 強制網路優先
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 跳過 chrome extension
  if (request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // 🔥 絽急模式：所有請求都直接請求網路
  if (EMERGENCY_MODE) {
    event.respondWith(
      fetch(request, {
        cache: 'no-store',  // 強制不使用快取
        headers: {
          ...request.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      .then(response => {
        console.log('%c[SW] ✅ Network: ' + request.url, 'color: #51cf66');
        return response;
      })
      .catch(error => {
        console.log('%c[SW] ❌ Network failed: ' + request.url, 'color: #ff6b6b');
        // 網路失敗才嘗試快取
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('%c[SW] 📂 Using cache: ' + request.url, 'color: #ffa94d');
            return cachedResponse;
          }
          return new Response('😫 離線狀態，無快取可用', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        });
      })
    );
    return;
  }
  
  // 正常模式：API 不快取
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // 正常模式：Network-First
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// 監聽訊息事件
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[SW] 🗑️ Manual clear:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        // 通知所有客戶端
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION,
      emergency: EMERGENCY_MODE
    });
  }
});

console.log('%c[SW] 🚀 Service Worker ' + CACHE_VERSION + ' loaded!', 'color: #339af0; font-weight: bold; font-size: 14px');
