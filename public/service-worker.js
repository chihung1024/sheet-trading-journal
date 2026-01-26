/**
 * Service Worker: Trading Journal PRO (v20260127)
 * 優化重點：SPA 離線路由支援、Google Fonts 快取策略、激進的版本清理
 */

const CACHE_NAME = 'journal-pro-v20260127'; // ✅ 更新版本號以強制刷新 UI
const RUNTIME_CACHE = 'runtime-v20260127';
const FONT_CACHE = 'fonts-v1';

// 核心靜態資源 (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // 注意：main.js 與 style.css 由 Vite 打包後檔名會帶 hash，
  // 這裡不寫死，改由下方的 Runtime Caching 動態捕捉
];

// 1. 安裝階段：預先快取核心檔案
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // 強制跳過等待，立即接管
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

  // 3-1. API 請求：絕對網路優先 (Network Only)
  // 確保財務數據永遠即時，絕不讀取快取
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // 離線時回傳標準錯誤 JSON
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
  // 字體檔案不常變動且體積大，適合長期快取
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

  // 3-4. SPA 頁面導航 (HTML)：網路優先，失敗則回退到 index.html
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
  // 確保使用者總是用到最新發布的程式碼
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 只快取成功的請求
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
