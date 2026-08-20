/**
 * Historical service-worker tombstone.
 *
 * This URL remains available only long enough to retire registrations from
 * earlier releases. It deliberately has no fetch handler and no app logic.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
