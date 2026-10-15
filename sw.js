const CACHE_NAME = 'pp360-shell-v1.0.0';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './backend.js',
  './config.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('pp360') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isPublicShellRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  const path = url.pathname;
  return [
    '/powerplant360/',
    '/powerplant360/index.html',
    '/powerplant360/styles.css',
    '/powerplant360/app.js',
    '/powerplant360/backend.js',
    '/powerplant360/config.js',
    '/powerplant360/manifest.json',
    '/powerplant360/icon.svg'
  ].includes(path);
}

function canonicalRequest(request) {
  const url = new URL(request.url);
  return new Request(url.origin + url.pathname, {method:'GET'});
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Never cache Supabase, OpenAI, CDN, private document, or other external traffic.
  if (!isPublicShellRequest(request)) return;

  const key = canonicalRequest(request);

  event.respondWith(
    fetch(request, {cache:'no-store'})
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(key, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(key);
        if (cached) return cached;

        if (request.mode === 'navigate') {
          const fallback = await caches.match(new Request(self.location.origin + '/powerplant360/index.html'));
          if (fallback) return fallback;
        }

        return new Response('PowerPlant360 requires an internet connection.', {
          status:503,
          headers:{'Content-Type':'text/plain; charset=utf-8'}
        });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
