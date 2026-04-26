/**
 * DriveStream Service Worker
 * Strategi: Cache-First untuk aset statis, Network-First untuk API Apps Script.
 */

const CACHE_NAME   = 'drivestream-v2';
const OFFLINE_URL  = './index.html';

// Aset yang di-cache saat install (app shell)
// Path relatif agar bekerja di subdirektori manapun (mis. /film-apps/)
const PRECACHE = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Host yang selalu di-fetch live (tidak pernah dari cache)
const NETWORK_ONLY_HOSTS = [
  'script.google.com',       // Apps Script API
  'drive.google.com',        // video embed
  'api.themoviedb.org',      // TMDB (dipakai di code.gs, bukan frontend)
  'image.tmdb.org'           // poster — biarkan di-cache otomatis oleh browser
];

/* ── INSTALL ── pre-cache app shell */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── hapus cache lama */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH ── strategi hybrid */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Hanya tangani GET
  if (request.method !== 'GET') return;

  // Network-only untuk API & video
  if (NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(fetch(request));
    return;
  }

  // Stale-while-revalidate untuk CDN (Tailwind, FontAwesome, Google Fonts)
  const isCDN = url.hostname !== self.location.hostname;
  if (isCDN) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Cache-first untuk aset lokal (app shell)
  event.respondWith(cacheFirst(request));
});

/* ── Strategi: Cache-First ── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback: kembalikan index.html agar SPA tetap terbuka
    return caches.match(OFFLINE_URL);
  }
}

/* ── Strategi: Stale-While-Revalidate ── */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}
