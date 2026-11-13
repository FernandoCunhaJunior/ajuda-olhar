// Rede primeiro; se estiver sem internet, usa a cópia guardada (inclui o modelo de reconhecimento).
const CACHE = 'ajuda-olhar-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || Response.error()))
  );
});
