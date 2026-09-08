/* Service worker Shadow Tarot — réseau d'abord, cache en secours (hors-ligne) */
const CACHE = 'shadowtarot-v1';
const COEUR = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(COEUR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* Jamais de cache pour l'API ni les requêtes externes non-GET */
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  /* Réseau d'abord (toujours la dernière version), cache en secours si hors-ligne */
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp && resp.ok && url.origin === location.origin) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
