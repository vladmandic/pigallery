/* eslint-disable no-console */

const cacheName = 'pigallery';
const cacheFiles = [
  '/favicon.ico',
  '/manifest.json',
  '/gallery',
  '/assets/roboto.ttf',
  '/assets/dash-256.png',
  '/assets/dash-512.png',
  '/assets/dash-1024.png',
  '/assets/bootstrap.css',
];

let listening = false;

async function cached(request) {
  let found = await caches.match(request);
  // console.log(found ? 'cached' : 'not cached', request.url);
  if (!found) found = fetch(request);
  return found;
}

if (!listening) {
  self.addEventListener('message', (evt) => {
    console.log('PWA event message:', evt);
  });

  self.addEventListener('install', (evt) => {
    self.skipWaiting();
    evt.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(cacheFiles)));
  });

  self.addEventListener('activate', (evt) => {
    evt.waitUntil(self.clients.claim());
  });

  self.addEventListener('fetch', (evt) => {
    const uri = new URL(evt.request.url);
    if (evt.request.cache === 'only-if-cached' && evt.request.mode !== 'same-origin') return; // required for chrome bug
    if (evt.request.method !== 'GET') return; // skip anything but post
    if (uri.origin !== location.origin) return; // skip non-local requests
    if (evt.request.url.includes('/api/')) return; // skip api calls
    if (evt.request.url.includes('/models/')) return; // skip caching model data
    // get cached data and respond with cached data if found, else leave to default handler
    evt.respondWith(cached(evt.request));
    /*
      async function () {
        let cached = await caches.match(evt.request);
        console.log(cached ? 'cached' : 'not cached', evt.request.url);
        if (!cached) cached = fetch(evt.request);
        return cached;
      }());
    */
  });

  let refreshed = false;
  self.addEventListener('controllerchange', (evt) => {
    console.log(`PWA: ${evt.type}`);
    if (refreshed) return;
    refreshed = true;
    window.location.reload();
  });

  listening = true;
}
