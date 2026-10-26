// Offline voor het hoofdadres: bewaart alleen de doorverwijspagina (index.html)
// zodat https://rjong-ctrl.github.io/Labelmaker/ ook zonder internet opent.
// De app zelf staat in v2/ en heeft daar een eigen service worker.
const CACHE = 'lm-hoofd-1';
const PAGINA = new URL('./', self.location).href;
const INDEX = new URL('index.html', self.location).href;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(PAGINA, { cache: 'reload' }))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('lm-hoofd-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url.split(/[?#]/)[0];
  if (e.request.method !== 'GET' || (url !== PAGINA && url !== INDEX)) return; // de rest gaat gewoon naar het netwerk
  e.respondWith((async () => {
    try {
      const antwoord = await fetch(e.request, { cache: 'no-cache' });
      if (antwoord.ok) (await caches.open(CACHE)).put(PAGINA, antwoord.clone());
      return antwoord;
    } catch {
      return (await caches.match(PAGINA)) || Response.error();
    }
  })());
});
