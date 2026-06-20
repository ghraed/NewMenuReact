const CACHE_VERSION = 'v2';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const GUEST_API_CACHE = `guest-api-${CACHE_VERSION}`;
const APP_ASSET_EXTENSIONS = ['.js', '.css', '.woff', '.woff2', '.ttf', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico'];
const GUEST_API_PATTERNS = [
  /^\/api\/menu\/table\/\d+$/,
  /^\/api\/menu\/table\/\d+\/dish\/\d+$/,
  /^\/api\/menu\/[a-zA-Z0-9_-]+\/dishes$/,
];

const shouldHandleGuestApi = (url) => {
  if (url.origin !== self.location.origin) {
    return false;
  }

  return GUEST_API_PATTERNS.some((pattern) => pattern.test(url.pathname));
};

const isNavigationRequest = (request) => request.mode === 'navigate';

const isAppAssetRequest = (requestUrl) => {
  if (requestUrl.origin !== self.location.origin) {
    return false;
  }

  return APP_ASSET_EXTENSIONS.some((ext) => requestUrl.pathname.endsWith(ext));
};

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    throw error;
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  throw new Error('No cached data available');
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => ![APP_SHELL_CACHE, GUEST_API_CACHE].includes(name))
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (shouldHandleGuestApi(requestUrl)) {
    event.respondWith(staleWhileRevalidate(request, GUEST_API_CACHE));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request, APP_SHELL_CACHE));
    return;
  }

  if (isAppAssetRequest(requestUrl)) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      body: event.data ? event.data.text() : 'A guest is requesting staff assistance.',
    };
  }

  const title = payload.title || 'Guest wave';
  const options = {
    body: payload.body || 'A guest is requesting staff assistance.',
    icon: payload.icon || '/pwa-192.png',
    badge: payload.badge || '/pwa-192.png',
    tag: payload.tag || 'guest-wave',
    data: {
      url: payload.url || '/staff/orders',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/staff/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
