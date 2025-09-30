// service-worker.js — safe install for GitHub Pages project site

// IMPORTANT: This file must live at /dnd-inventory-app/service-worker.js for scope to match your pages site.
const CACHE_NAME = 'dnd-inventory-cache-v3';

// Dynamically determine base path
const getBasePath = () => {
  if (self.location.hostname.includes('github.io')) {
    const pathParts = self.location.pathname.split('/').filter(p => p);
    return pathParts.length > 0 ? `/${pathParts[0]}` : '';
  }
  return '';
};

const BASE = getBasePath();

// Only list URLs you know exist in the deployed site.
const PRECACHE_URLS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/assets/Background.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const resp = await fetch(url, { cache: 'no-store' });
            if (!resp.ok) throw new Error(`Bad response ${resp.status}`);
            await cache.put(url, resp.clone());
            console.log('[SW] Cached:', url);
          } catch (err) {
            console.warn('[SW] Skipped (failed to cache):', url, err.message);
          }
        })
      );
    } catch (e) {
      console.warn('[SW] Install encountered an error but will continue:', e.message);
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
    console.log('[SW] Activated');
  })());
});

// Cache-first for GET requests within our scope
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle our project scope to avoid caching random third-party stuff
  const inScope = url.pathname.startsWith('/dnd-inventory-app/');
  if (!inScope) return; // Let the network handle it

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh.ok) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // If offline and not cached, give up
      return cached || Response.error();
    }
  })());
});
