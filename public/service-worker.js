/* photo-tools — service worker.
 *
 * Cache strategy:
 *   - Navigation requests (`document`) → network-first. Latest HTML wins
 *     when online; cached HTML only on hard offline. This is what stops a
 *     returning user from being stuck on yesterday's deploy.
 *   - All other GET requests → stale-while-revalidate. Serve cached for
 *     instant paint, refresh from origin in the background; next visit
 *     gets the fresh copy.
 *   - Every network fetch the SW makes uses {cache: 'reload'}, so the
 *     browser's own HTTP cache layer can't poison the SW's cache with
 *     stale bytes. The SW is the single authority for what's cached.
 *   - libheif-js wasm bundle (~1.2MB) is excluded from precache (most
 *     users never touch HEIC) and lazy-cached on first use.
 *   - leaflet.js + leaflet.css (~165KB) are likewise excluded — only users
 *     who open the GPS map picker pull them, and once cached the SW serves
 *     them stale-while-revalidate like any other asset.
 *
 * Bump CACHE_VERSION on any change to the precache list or shell behavior;
 * the activate handler purges any cache whose name doesn't match.
 */

const CACHE_VERSION = 'v71';
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
  './cloudS3.js',
  './exifio.js',
  './heic.js',
  './geopicker.js',
  './progressModal.js',
  './worker.js',
  './shared/render.js',
  './frames/frosted-noir.js',
  './frames/gallery-white.js',
  './frames/instax.js',
  './frames/film-35.js',
  './frames/film-mf.js',
  './frames/slide-mount.js',
  './frames/torn.js',
  './frames/halftone.js',
  './vendor/exifr.umd.js',
  './vendor/piexif.js',
  './vendor/jszip.min.js',
  './fonts.css',
  './logos.json',
  './logo.svg',
  './manifest.json',
  './CHANGELOG.md'
];

self.addEventListener('install', (event) => {
  // Don't skipWaiting() automatically — the page shows a "new version
  // available" banner and only swaps in the new SW when the user clicks
  // refresh, so they aren't surprised by a mid-session reload. The banner
  // posts {type:'SKIP_WAITING'} below to trigger the swap on demand.
  //
  // Precache fetches are wrapped with cache:'reload' so each one bypasses
  // the browser's HTTP cache. Without this, a 30-min-old cached app.js at
  // the HTTP layer would land in the SW's v6 precache verbatim, defeating
  // the version bump's whole point.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Helper: fetch from origin (NOT browser HTTP cache) and put a copy
    // into the SW cache before returning. cache:'reload' is what makes
    // the SW the authoritative cache layer — without it, browser's HTTP
    // cache can hand the SW stale bytes that get re-cached as "fresh".
    const fromNetwork = () => fetch(req, { cache: 'reload' }).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    });

    // ─── Navigation: network-first ─────────────────────────────────────
    // Returning users always see the latest deploy in one round-trip.
    // Offline → fall back to whatever index.html the cache holds.
    if (isNavigation) {
      try {
        const fresh = await fromNetwork();
        if (fresh) return fresh;
      } catch (_) { /* offline / DNS fail → fall through */ }
      const cached = await cache.match(req);
      if (cached) return cached;
      const indexCached = await cache.match('./index.html');
      if (indexCached) return indexCached;
      return new Response('Offline and not in cache', { status: 503, statusText: 'Offline' });
    }

    // ─── Asset: stale-while-revalidate ─────────────────────────────────
    // Cache hit → instant paint; spawn a background refresh so the next
    // visit picks up any new bytes. Cache miss → wait for network.
    const cached = await cache.match(req);
    const networkPromise = fromNetwork().catch(() => null);
    if (cached) {
      networkPromise.catch(() => {});
      return cached;
    }
    const fresh = await networkPromise;
    if (fresh) return fresh;
    return new Response('Offline and not in cache', { status: 503, statusText: 'Offline' });
  })());
});
