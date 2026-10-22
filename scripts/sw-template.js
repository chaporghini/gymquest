/* global __FILES__ */
/* GYMQUEST Service Worker: macht die Web-App offline startbar. Wird von scripts/build-web.mjs erzeugt. */
const VERSION = '__VERSION__';
const CACHE = `gymquest-${VERSION}`;
const PRECACHE = __FILES__;
const SCOPE = new URL('./', self.location.href);
const INDEX = new URL('index.html', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new Request(new URL(path, SCOPE).href, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Aktuelle und vorherige Version behalten, damit eine noch offene alte Seite ihre Dateien findet.
      const keys = (await caches.keys()).filter((k) => k.startsWith('gymquest-') && k !== CACHE);
      await Promise.all(keys.slice(0, -1).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Nur eigene Dateien; Supabase und andere Server laufen direkt übers Netz.
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;

  if (request.mode === 'navigate') {
    // Alle Seiten der App sind dieselbe index.html. Aus dem Cache: sofortiger Start, auch ohne Netz.
    event.respondWith(caches.match(INDEX).then((hit) => hit || fetch(request)));
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
