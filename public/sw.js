// Service Worker v1.0.4 - FORCE UPDATE
const CACHE_VERSION = 'v1.0.4-20260111';
const CACHE_NAME = `trading-journal-${CACHE_VERSION}`;

// 需要快取的資源
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// 安裝事件：快取靜態資源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // 立即啟動新版本
  );
});

// 啟動事件：清除舊快取
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 立即控制所有頁面
  );
});

// Fetch 事件：Network-First 策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 跳過 chrome extension 請求
  if (request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // API 請求：不快取，直接請求
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // 其他資源：Network-First
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 如果網路請求成功，更新快取
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 網路失敗，嘗試從快取讀取
        return caches.match(request).then((response) => {
          return response || new Response('Offline - No cached version available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// 監聽訊息事件（用於手動刷新）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[SW] Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});
