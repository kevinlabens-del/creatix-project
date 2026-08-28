const CACHE = 'cr3atix-soutien-v1.1.0-paypal';
const SHELL = ['./','./index.html','./styles.css','./app.js','./projects.js','./config.js','./legal.html','./admin.html','./admin.css','./admin.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const dynamic = url.pathname.endsWith('/projects.json');
  if (event.request.mode === 'navigate' || dynamic) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(async response => { if (response.ok) (await caches.open(CACHE)).put(event.request, response.clone()); return response; }).catch(() => caches.match(event.request).then(match => match || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => { if (response.ok) (await caches.open(CACHE)).put(event.request, response.clone()); return response; })));
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
