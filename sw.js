const CACHE = 'inainthu-othuvom-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/config.js',
  '/script-auth.js',
  '/script-email.js',
  '/script-hadiya.js',
  '/script-main.js',
  '/script-notify.js',
  '/script-report.js',
  '/script-supabase.js',
  '/script-utils.js',
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
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
