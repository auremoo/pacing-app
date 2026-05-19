const CACHE   = 'pacing-v1';
const STATIC  = [
  './',
  './index.html',
  './css/reset.css',
  './css/tokens.css',
  './css/components.css',
  './js/app.js',
  './js/store.js',
  './js/github-api.js',
  './js/parser.js',
  './js/views/lock.js',
  './js/views/dashboard.js',
  './js/views/event.js',
  './js/views/plan-view.js',
  './js/views/course-view.js',
  './js/views/versions-view.js',
  './js/views/infos-view.js',
  './js/views/session-view.js',
  './js/views/settings.js',
  './js/utils/dates.js',
  './js/utils/markdown.js',
  './js/utils/gpx-parser.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // GitHub API → always network, no cache
  if (url.hostname === 'api.github.com') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static assets → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
