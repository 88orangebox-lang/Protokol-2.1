// ===== MP Komfort - Protokol PWA - Service Worker =====
// Po každej zmene cache zoznamu alebo logiky bumpni CACHE_VERSION.
// Pri ďalšom otvorení appky sa stará cache automaticky vymaže a načíta nová verzia.
const CACHE_VERSION = 'v5';
const CACHE_NAME = 'mp-protokol-' + CACHE_VERSION;

// Jadro aplikácie — bez týchto súborov appka nefunguje.
// Ak addAll zlyhá, install zlyhá a stará cache ostane aktívna.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './ikona_protokol_192.png',
  './ikona_protokol_512.png'
];

// Lokálne knižnice pre offline skener / OCR.
// Ak ich user ešte nestiahol (alebo zlyhá ich fetch), nezhodíme celý install —
// pridáme ich do cache best-effort a appka ostáva funkčná.
const OPTIONAL_ASSETS = [
  // Skener čiarových / QR kódov
  './lib/html5-qrcode/html5-qrcode.min.js',
  // OCR - Tesseract.js
  './lib/tesseract/tesseract.min.js',
  './lib/tesseract/worker.min.js',
  './lib/tesseract/tesseract-core-simd.wasm.js',
  './lib/tesseract/tesseract-core-simd.wasm',
  './lib/tesseract/tesseract-core.wasm.js',
  './lib/tesseract/tesseract-core.wasm',
  './lib/tesseract/lang/eng.traineddata.gz'
];

// ===== INSTALL: predcacheovať jadro + best-effort knižnice =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      // Knižnice cachujeme jednotlivo a zlyhania pohltíme — appka funguje aj bez nich
      await Promise.all(
        OPTIONAL_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn('SW: optional asset not cached:', url, err?.message || err);
          })
        )
      );
      return self.skipWaiting();
    })
  );
});

// ===== ACTIVATE: vyčistiť staré cache + prevziať klientov =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith('mp-protokol-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// ===== FETCH stratégia =====
// - HTML (navigačné požiadavky): network-first s fallbackom na cache
//   → keď je technik online, vždy dostane najnovšiu verziu appky
//   → keď je offline, appka stále funguje z cache
// - Ostatné súbory (JS, CSS, WASM, obrázky, jazykové dáta): cache-first
//   → rýchle a šetrné na dáta; nové verzie prichádzajú s bumpom CACHE_VERSION
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
