/* eslint-disable no-console */

const cacheName = 'pigallery';
const cacheFiles = ['/favicon.ico', '/manifest.json', '/client/offline.html']; // assets and models are cached on first access
let cacheModels = false;
let listening = false;
const stats = { hit: 0, miss: 0 };

function ts() {
  const dt = new Date();
  return `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}.${dt.getMilliseconds().toString().padStart(3, '0')}`;
}

async function cached(evt) {
  let found;
  if (navigator.onLine) found = await caches.match(evt.request); // || await fetch(evt.request);
  else found = await caches.match('/client/offline.html');

  if (found && found.type === 'basic' && found.ok) {
    const clone = found.clone();
    if (evt.request.url.includes('/assets/')) evt.waitUntil(caches.open(cacheName).then((cache) => cache.put(evt.request, clone)));
    if (cacheModels && evt.request.url.includes('/models/')) evt.waitUntil(caches.open(cacheName).then((cache) => cache.put(evt.request, clone)));
  }

  if (!found) {
    stats.miss += 1;
    found = await fetch(evt.request);
  } else {
    stats.hit += 1;
  }
  console.log(stats);
  return found;
}

function refresh() {
  caches.open(cacheName)
    .then((cache) => cache.addAll(cacheFiles)
      .then(
        () => console.log(ts(), 'PWA Cache refresh:', cacheFiles.length, 'files'),
        (err) => console.log(ts(), 'PWA Cache error', err),
      ));
}

if (!listening) {
  self.addEventListener('message', (evt) => {
    if (evt.data.key === 'cacheModels') cacheModels = evt.data.val;
    else console.log(ts(), 'PWA event message:', evt);
  });

  self.addEventListener('install', (evt) => {
    console.log(ts(), 'PWA Install');
    self.skipWaiting();
    evt.waitUntil(refresh);
  });

  self.addEventListener('activate', (evt) => {
    console.log(ts(), 'PWA Activate');
    refresh();
    evt.waitUntil(self.clients.claim());
  });

  self.addEventListener('fetch', (evt) => {
    const uri = new URL(evt.request.url);
    if (evt.request.cache === 'only-if-cached' && evt.request.mode !== 'same-origin') return; // required for chrome bug
    if (evt.request.method !== 'GET') return; // only cache get requests
    if (uri.origin !== location.origin) return; // skip non-local requests
    if (evt.request.url.includes('/api/')) return; // skip api calls
    // if (evt.request.url.includes('/models/')) return; // skip caching model data
    const response = cached(evt);
    if (response) evt.respondWith(response);
  });

  let refreshed = false;
  self.addEventListener('controllerchange', (evt) => {
    console.log(ts(), `PWA: ${evt.type}`);
    if (refreshed) return;
    refreshed = true;
    window.location.reload();
  });

  listening = true;
}
