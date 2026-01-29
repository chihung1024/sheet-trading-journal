/**
 * Service Worker: Trading Journal PRO (v20260130)
 * 修復：過濾 chrome-extension:// 協議避免緩存錯誤
 */

const CACHE_NAME = 'journal-pro-v20260130';
const RUNTIME_CACHE = 'runtime-v20260130';
const FONT_CACHE = 'fonts-v1';

// 核心靜態資源 (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// 1. 安裝階段：預先快取核心檔案
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. 激活階段：清理舊快取
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating & cleaning old caches...');
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, FONT_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. 請求攔截策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ✅ [修復] 過濾掉不支援的協議 (chrome-extension, chrome, about 等)
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return; // 不處理，讓瀏覽器默認處理
  }

  // 3-1. API 請求：絕對網路優先 (Network Only)
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ success: false, message: 'Offline Mode: 無法連接伺服器' }),
          { 
            status: 503, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      })
    );
    return;
  }

  // 3-2. Google Fonts 字體檔 (woff2)：快取優先 (Cache First)
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((networkResponse) => {
          return caches.open(FONT_CACHE).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 3-3. Google Fonts 樣式表 (css)：重新驗證 (Stale-While-Revalidate)
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3-4. SPA 頁面導航 (HTML)：網路優先
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 3-5. 靜態資源 (JS, CSS, Images)：網路優先 (Network First)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 只快取成功的 HTTP(S) 請求
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // 預設：直接請求
  event.respondWith(fetch(request));
});
