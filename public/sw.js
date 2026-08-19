const VERSION = 'v1';
const CACHE = `offline-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
    )
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
    fetch(request).catch(() =>
      caches.open(CACHE).then((cache) => cache.match(OFFLINE_URL))
    )
  );
});
