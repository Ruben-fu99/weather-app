const VERSION = '__VERSION__';
const SHELL_CACHE = `weather-shell-${VERSION}`;
const TILE_CACHE = `weather-tiles-${VERSION}`;
const TILE_HOST = 'gibs.earthdata.nasa.gov';

const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'src/advice.js',
  'src/art.js',
  'src/api.js',
  'src/cache.js',
  'src/chart.js',
  'src/chinese-places.js',
  'src/cities.js',
  'src/depth.js',
  'src/errors.js',
  'src/format.js',
  'src/globe-math.js',
  'src/globe-renderer.js',
  'src/globe-textures.js',
  'src/iss.js',
  'src/globe.js',
  'src/i18n.js',
  'src/location.js',
  'src/main.js',
  'src/quakes.js',
  'src/scene.js',
  'src/season.js',
  'src/storage.js',
  'src/sun.js',
  'src/ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' })));
      await cache.add(new Request('config.js', { cache: 'reload' })).catch(() => undefined);
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('weather-') && name !== SHELL_CACHE && name !== TILE_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  if (cached) {
    refresh.catch(() => undefined);
    return cached;
  }

  try {
    return await refresh;
  } catch {
    return request.mode === 'navigate' ? cache.match('index.html') : Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.hostname === TILE_HOST) {
    event.respondWith(cacheFirst(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
