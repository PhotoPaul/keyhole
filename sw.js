const CACHE_NAME = 'archive-share-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    // For share targets, we generally want to go network-only or network-first 
    // to ensure we process parameters correctly, but for the app shell we use cache.
    // Since this is a simple single-page app, a Stale-While-Revalidate strategy is safe.

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});
