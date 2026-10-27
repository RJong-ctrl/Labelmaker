// Service worker van de Labelmaker: na het eerste bezoek opent de app ook zonder internet.
//
// BELANGRIJK: verander VERSIE bij elke wijziging in een bestand van de app, anders blijven
// bezoekers de oude bestanden uit hun cache houden. De lijst BESTANDEN moet alle bestanden
// van de app bevatten (tests/unit/sw_bestanden.test.mjs controleert dat); data/ hoort er niet in.
const VERSIE = '20261027-1558';
const CACHE = `labelmaker-${VERSIE}`;

// Paden relatief aan deze sw.js (dus aan de map van de app).
const BESTANDEN = [
  './',
  'index.html',
  'assets/dsl-logo.svg',
  'css/app.css',
  'css/beheer.css',
  'css/opmaak.css',
  'fonts/barlow-condensed-500.woff2',
  'fonts/barlow-condensed-700.woff2',
  'fonts/jost-400.woff',
  'fonts/jost-500.woff',
  'fonts/jost-700.woff',
  'fonts/LEESMIJ.txt',
  'fonts/OFL-Barlow.txt',
  'fonts/OFL-Jost.txt',
  'js/afleiden.js',
  'js/app.js',
  'js/beheer-extra.js',
  'js/beheer.js',
  'js/bestanden.js',
  'js/dialogen.js',
  'js/editor.js',
  'js/html.js',
  'js/import.js',
  'js/indeling.js',
  'js/kleuren.js',
  'js/maken.js',
  'js/model.js',
  'js/offline.js',
  'js/opmaak.js',
  'js/opslag.js',
  'js/oud.js',
  'js/printen.js',
  'js/profielen.js',
  'js/publiceren.js',
  'js/qr.js',
  'js/samenvoegen.js',
  'js/sjablonen.js',
  'js/standaard.js',
  'js/werkscherm.js',
];

const sleutel = (url) => url.origin + url.pathname; // zonder ?zoekdeel en #anker
const APP = new Set(BESTANDEN.map((b) => sleutel(new URL(b, self.location))));
const DATA = new URL('data/', self.location).pathname;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 'reload' slaat de HTTP-cache van de browser over (GitHub Pages geeft max-age=600),
    // anders belandt een tot 10 minuten oude versie van een bestand in de nieuwe cache.
    await cache.addAll(BESTANDEN.map((b) => new Request(b, { cache: 'reload' })));
    await neemDataOver(cache);
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const naam of await caches.keys()) {
      if (naam.startsWith('labelmaker-') && naam !== CACHE) await caches.delete(naam);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'versie' && e.ports[0]) e.ports[0].postMessage({ versie: VERSIE });
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(DATA)) e.respondWith(netwerkEerst(request, sleutel(url)));
  else if (APP.has(sleutel(url))) e.respondWith(cacheEerst(request, sleutel(url)));
  // Al het andere (bijvoorbeeld versie 25 in een andere map) gaat ongemoeid naar het netwerk.
});

/** App-bestanden: uit de cache van deze versie, alleen bij een gemiste cache het netwerk. */
async function cacheEerst(request, sleutelUrl) {
  const cache = await caches.open(CACHE);
  return (await cache.match(sleutelUrl, { ignoreVary: true })) || fetch(request);
}

/** Gepubliceerde basis (data/): altijd het nieuwste van het netwerk, offline de laatst geziene. */
async function netwerkEerst(request, sleutelUrl) {
  const cache = await caches.open(CACHE);
  try {
    const antwoord = await fetch(request, { cache: 'no-cache' }); // herkeuren, niet 10 minuten oud
    if (antwoord.ok) await cache.put(sleutelUrl, antwoord.clone());
    return antwoord;
  } catch (fout) {
    const bewaard = await cache.match(sleutelUrl, { ignoreVary: true });
    if (bewaard) return bewaard;
    throw fout;
  }
}

/** Bij een nieuwe versie gaat de oude cache weg; de laatst geziene basis uit data/ nemen we mee. */
async function neemDataOver(nieuw) {
  for (const naam of await caches.keys()) {
    if (!naam.startsWith('labelmaker-') || naam === CACHE) continue;
    const oud = await caches.open(naam);
    for (const verzoek of await oud.keys()) {
      if (new URL(verzoek.url).pathname.startsWith(DATA) && !(await nieuw.match(verzoek))) {
        await nieuw.put(verzoek, await oud.match(verzoek));
      }
    }
  }
}
