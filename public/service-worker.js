/**
 * Historical service-worker tombstone.
 *
 * This URL remains available only long enough to retire registrations from
 * earlier releases. It deliberately has no fetch handler and no app logic.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys().catch(() => []);
    await Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName).catch(() => false))
    );
    await self.clients.claim().catch(() => false);
    await self.registration.unregister().catch(() => false);
  })());
});
