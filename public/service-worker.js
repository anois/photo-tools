/* photo-tools — service worker.
 *
 * Precache the SPA shell on install (cache-first, stale-while-revalidate on
 * subsequent visits) so the app loads instantly and works offline. The
 * libheif-js wasm bundle (~1.2MB) is excluded from precache because most
 * users never touch HEIC; it's cached on demand the first time it's fetched.
 *
 * Bump CACHE_VERSION on any change to the precache list or shell behavior;
 * the activate handler purges any cache whose name doesn't match.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = 'phototools-shell-' + CACHE_VERSION;

// Files that make up the offline-capable SPA shell. Paths are relative to
// the SW scope so the same SW works under '/' or '/photo-tools/' deploys.
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './i18n.js',
  './clientRender.js',
  './exporter.js',
  './exifio.js',
  './heic.js',
  './progressModal.js',
  './worker.js',
  './shared/render.js',
  './vendor/exifr.umd.js',
  './vendor/piexif.js',
  './vendor/jszip.min.js',
  './fonts.css',
  './logos.json',
  './logo.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('phototools-shell-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle same-origin GETs. Cross-origin fonts / fetches pass through.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    // Stale-while-revalidate: serve cached immediately, refresh in background.
    const networkPromise = fetch(req).then((res) => {
      // Only cache successful, basic (same-origin) responses. Opaque or
      // error responses must not pollute the cache.
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);

    if (cached) {
      // Don't await the background refresh — let it race; the cached copy
      // is what the user sees this navigation.
      networkPromise.catch(() => {});
      return cached;
    }
    const fresh = await networkPromise;
    if (fresh) return fresh;
    // Last-resort offline fallback for navigations: serve cached index.
    if (req.mode === 'navigate') {
      const indexCached = await cache.match('./index.html');
      if (indexCached) return indexCached;
    }
    return new Response('Offline and not in cache', { status: 503, statusText: 'Offline' });
  })());
});
