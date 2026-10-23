const CACHE = 'inainthu-othuvom-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=3',
  '/config.js',
  '/script-auth.js?v=3',
  '/script-email.js?v=3',
  '/script-hadiya.js?v=3',
  '/script-main.js?v=3',
  '/script-notify.js?v=3',
  '/script-report.js?v=3',
  '/script-supabase.js?v=3',
  '/script-utils.js?v=3',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
