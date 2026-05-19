// Passthrough SW — clears old caches on activation, no JS caching.
// App needs network for GitHub API anyway, caching JS causes stale-code issues.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// No fetch handler — all requests go to network.
