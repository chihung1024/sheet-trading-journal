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
    try {
      const cacheNames = await caches.keys();
      await Promise.allSettled(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    } finally {
      try {
        await self.clients.claim();
      } catch {
        // A failed claim must not prevent registration removal.
      }
      await self.registration.unregister();
    }
  })());
});
