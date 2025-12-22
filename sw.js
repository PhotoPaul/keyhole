const CACHE_NAME = 'archive-share-v2';
const ASSETS = [
    './',
    './index.html',
    './settings.html',
    './style.css',
    './app.js',
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
    // 2. If successful, update cache and return
    // 3. If failed (offline), return from cache
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
                        cache.put(event.request, responseToCache);
                    });

                return networkResponse;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request);
            })
    );
});
