/**
 * BYE QUIZ LIVE - PWA Service Worker
 * Caches essential static assets (HTML, CSS, JS, icons) while strictly
 * bypassing dynamic TikTok streams, SSE (/api/events), and live REST endpoints.
 */
const CACHE_NAME = 'byequiz-v3-static';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/broadcast.html',
  '/css/style.css',
  '/js/audio.js',
  '/js/game.js',
  '/js/engine/iconSystem.js',
  '/js/engine/reactionCanvas.js',
  '/js/engine/giftEventEngine.js',
  '/js/engine/eventManager.js',
  '/js/engine/gameState.js',
  '/js/engine/questionModel.js',
  '/js/engine/questionValidator.js',
  '/js/engine/questionSelector.js',
  '/js/engine/participantCard.js',
  '/js/engine/participantManager.js',
  '/js/engine/questionEngine.js',
  '/js/engine/answerEngine.js',
  '/js/engine/drawEngine.js',
  '/js/engine/scoreEngine.js',
  '/js/engine/statisticsEngine.js',
  '/js/engine/reactionEngine.js',
  '/js/engine/milestoneEngine.js',
  '/js/engine/reactionAggregator.js',
  '/js/engine/reactionQueue.js',
  '/js/engine/effectManager.js',
  '/js/engine/sceneManager.js',
  '/js/engine/roundManager.js',
  '/js/engine/gameEngine.js',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache add warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // The service worker itself must never be served from an old cache.
  if (url.pathname === '/service-worker.js') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // 1. NEVER cache SSE, API endpoints or live commands
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/events') || url.pathname.includes('/command')) {
    return; // Pass through directly to network
  }

  // 2. Cache-First Strategy for static assets with Network Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
