const VERSION = 'v2';
const CACHE = `offline-${VERSION}`;

// UWAGA: adres BEZ rozszerzenia .html. Cloudflare Workers serwuje `dist/` z
// `html_handling: "drop-trailing-slash"` (wrangler.jsonc), wiec /offline.html
// odpowiada 307 na /offline. Odpowiedzi po przekierowaniu (`response.redirected`)
// przegladarka odrzuca w odpowiedzi na nawigacje - fallback konczyl sie wtedy
// bledem sieci zamiast nasza strona. Trzymamy sie adresu kanonicznego.
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `cache: 'reload'` pobiera strone z sieci, a nie z cache przegladarki,
      // wiec nie zapisujemy nieaktualnej wersji juz na starcie.
      const response = await fetch(OFFLINE_URL, { cache: 'reload' });
      if (!response.ok) throw new Error(`offline precache: HTTP ${response.status}`);
      // Przepisujemy tresc do czystej odpowiedzi: gdyby adres kiedykolwiek zaczal
      // przekierowywac, flaga `redirected` znow wywrocilaby fallback.
      await cache.put(
        OFFLINE_URL,
        new Response(await response.blob(), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Service Worker nie dotyka POST, API, paneli admina ani wysylki formularzy.
  if (request.method !== 'GET') return;
  // Fallback dotyczy wczytywania stron, nie obrazkow i nie zapytan XHR - bez tego
  // brakujacy obrazek dostaje w odpowiedzi HTML strony offline.
  if (request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(OFFLINE_URL);
      return cached || Response.error();
    })
  );
});
