/**
 * Service Worker: Trading Journal PWA (v20260119)
 * 更新：版本號跳號以清理舊緩存，確保新的數據流轉邏輯生效
 */

const CACHE_NAME = 'trading-journal-v20260119'; // ✅ 更新版本號
const STATIC_CACHE = 'static-v3';
const DYNAMIC_CACHE = 'dynamic-v3';

// 需要緩存的靜態資源 (核心框架)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 1. 安裝 Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing New Service Worker Version...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  self.skipWaiting(); // 強制跳過等待，立即啟用新版本
});

// 2. 激活 Service Worker 並清理舊緩存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 如果緩存名稱不是目前的版本，則刪除
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache version:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim(); // 立即取得頁面控制權
});

// 3. 攔截請求策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳過非 HTTP(S) 請求 (如 chrome-extension 等)
  if (!request.url.startsWith('http')) {
    return;
  }

  // ✅ 核心修正：API 請求採「絕對網絡優先」且「不緩存」策略
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 確保 API 響應不進入任何快取
          return response;
        })
        .catch((error) => {
          console.warn('[SW] API Offline:', url.pathname);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Offline', 
              message: '無法連接到伺服器' 
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 503 }
          );
        })
    );
    return;
  }

  // ✅ HTML/JS/CSS：網路優先策略，確保前端邏輯是最新的
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // 網路失敗才使用緩存
          return caches.match(request);
        })
    );
    return;
  }

  // 4. 其他靜態資源 (圖片、字體等)：緩存優先策略
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
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

// 監聽消息 (供手動清理)
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

// 推送通知與點擊邏輯 (維持原狀)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Trading Journal';
  const options = {
    body: data.body || '您有新的通知',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: data.url || '/'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || '/'));
});
