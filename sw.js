const CACHE_NAME = 'archive-share-v8';
const ASSETS = [
    './',
    './index.html',
    './settings.html',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    // Force immediate activation
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    // Take control of all clients immediately
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Clean up old caches
            caches.keys().then(keys => {
                return Promise.all(
                    keys.map(key => {
                        if (key !== CACHE_NAME) {
                            console.log('Deleting old cache:', key);
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    // Network-First Strategy
    // 1. Try network
    // 2. If successful, update cache (using clean URL) and return
    // 3. If failed (offline), return from cache (ignoring query params)
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // Clone response to put in cache
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        // Store using the clean URL (no query params) so we don't duplicate files
                        // e.g. style.css?v=123 -> style.css
                        const cleanUrl = event.request.url.split('?')[0];
                        cache.put(cleanUrl, responseToCache);
                    });

                return networkResponse;
            })
            .catch(() => {
                // Network failed, try cache
                // ignoreSearch: true allows matching style.css when style.css?v=123 is requested (or vice versa)
                return caches.match(event.request, { ignoreSearch: true });
            })
    );
});
