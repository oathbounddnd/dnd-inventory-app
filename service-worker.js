// service-worker.js — safe install + basic cache-first fetch

const CACHE_NAME = 'dnd-inventory-cache-v1';

// Keep this list minimal and correct. Add more files as needed.
const PRECACHE_URLS = [
  './',
  './index.html',
  './assets/Background.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Attempt each request individually so a single failure won't abort install
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const resp = await fetch(url, { cache: 'no-store' });
            if (!resp.ok) throw new Error(`Bad response for ${url}: ${resp.status}`);
            await cache.put(url, resp.clone());
          } catch (err) {
            // Log and continue
            console.warn('[SW] Skipping precache URL due to error:', url, err.message);
          }
        })
      );
    } catch (e) {
      console.warn('[SW] Install encountered an error but will continue:', e.message);
    }
    // Activate new SW immediately on install
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Optionally clean old caches here
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    self.clients.claim();
  })());
});

// Basic cache-first strategy for GET requests
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      // Only cache successful, same-origin responses
      if (fresh.ok && new URL(req.url).origin === self.location.origin) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // Optional: return a fallback response here if desired
      return cached || Response.error();
    }
  })());
});
