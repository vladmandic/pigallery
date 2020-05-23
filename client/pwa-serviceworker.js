/* eslint-disable no-console */

const cacheName = 'pigallery';
const cacheFiles = [
  '/favicon.ico',
  '/manifest.json',
  '/gallery',
];

let listening = false;

function cacheGet(request) {
  const res = caches.open(cacheName).then((cache) => cache.match(request));
  if (res) {
    // console.log('Cache hit:', request.cache, request.mode, request.method, request.url);
    return res;
  }
  // console.log('Cache miss:', request.cache, request.mode, request.method, request.url);
  return fetch(request);
}

function cacheUpdate(request) {
  return caches.open(cacheName).then((cache) => fetch(request).then((response) => {
    if (response.status === 200 || response.status === 304) cache.put(request, response.clone()).then(() => response);
  }));
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
    evt.respondWith(cacheGet(evt.request)); // get cached data and respond with cached data if found, else fetch
    evt.waitUntil(cacheUpdate(evt.request)); // update cached data
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
