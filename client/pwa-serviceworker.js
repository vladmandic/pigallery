/* eslint-disable no-console */

// https://codelabs.developers.google.com/codelabs/your-first-pwapp/#0

const cacheName = 'pigallery';
const cacheFiles = [
  '/favicon.ico',
  '/manifest.json',
  '/assets/dash-64.png',
  '/assets/dash-128.png',
  '/assets/dash-256.png',
  '/assets/dash-512.png',
  '/assets/dash-1024.png',
  '/assets/roboto.ttf',
  '/assets/roboto-condensed.ttf',
  '/client/auth.html',
  '/client/offline.html',
];

let listening = false;

if (!listening) {
  self.addEventListener('message', (evt) => {
    console.log('PWA Event Message:', evt);
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
    if (evt.request.cache === 'only-if-cached' && evt.request.mode !== 'same-origin') return;
    if (evt.request.method !== 'GET') return;
    if (uri.origin !== location.origin) return;
    if (evt.request.mode === 'navigate') {
      evt.respondWith(caches.match(evt.request).then((cache) => cache || fetch(evt.request)).catch(() => caches.match('/client/offline.html')));
    }
  });

  let refreshed = false;
  self.addEventListener('controllerchange', (evt) => {
    console.log(`PWA: ${evt.type}`);
    if (refreshed) return;
    refreshed = true;
    window.location.reload();
  });

  self.addEventListener('notificationclick', (evt) => {
    if (evt.action === 'close') {
      evt.notification.close();
    } else {
      console.log(`Notification: ${evt.type}`);
    }
  });

  self.addEventListener('push', (evt) => {
    let json = evt.data.text();
    try {
      json = JSON.parse(json);
    } catch { /***/ }
    const options = {
      body: json.text || json,
      timestamp: json.time || evt.timeStamp,
      badge: 'favicon.ico',
      lang: 'en',
      requireInteraction: false,
      silent: true,
      icon: 'favicon.ico',
      tag: 'pidash',
      data: { received: Date.now() },
      actions: [{ action: 'close', title: 'Dismiss' }],
    };
    console.log(`PWA: ${evt.type} ${options.body}`);
    evt.waitUntil(
      self.registration.showNotification('PiDash', options),
    );
  });

  listening = true;
}
