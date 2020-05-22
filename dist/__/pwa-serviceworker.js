// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"../pwa-serviceworker.js":[function(require,module,exports) {
/* eslint-disable no-console */
// https://codelabs.developers.google.com/codelabs/your-first-pwapp/#0
const cacheName = 'pigallery';
const cacheFiles = ['/favicon.ico', '/manifest.json', '/assets/dash-64.png', '/assets/dash-128.png', '/assets/dash-256.png', '/assets/dash-512.png', '/assets/dash-1024.png', '/assets/roboto.ttf', '/assets/roboto-condensed.ttf'];
let listening = false;

if (!listening) {
  self.addEventListener('message', evt => {
    console.log('PWA Event Message:', evt);
  });
  self.addEventListener('install', evt => {
    self.skipWaiting();
    evt.waitUntil(caches.open(cacheName).then(cache => cache.addAll(cacheFiles)));
  });
  self.addEventListener('activate', evt => {
    evt.waitUntil(self.clients.claim());
  });
  self.addEventListener('fetch', evt => {
    const uri = new URL(evt.request.url);
    if (evt.request.cache === 'only-if-cached' && evt.request.mode !== 'same-origin') return;
    if (evt.request.method !== 'GET') return;
    if (uri.origin !== location.origin) return;

    if (evt.request.mode === 'navigate') {
      evt.respondWith(caches.match(evt.request).then(cache => cache || fetch(evt.request)).catch(() => caches.match('/offline.html')));
    }
  });
  let refreshed = false;
  self.addEventListener('controllerchange', evt => {
    console.log(`PWA: ${evt.type}`);
    if (refreshed) return;
    refreshed = true;
    window.location.reload();
  });
  self.addEventListener('notificationclick', evt => {
    if (evt.action === 'close') {
      evt.notification.close();
    } else {
      console.log(`Notification: ${evt.type}`);
    }
  });
  self.addEventListener('push', evt => {
    let json = evt.data.text();

    try {
      json = JSON.parse(json);
    } catch {
      /***/
    }

    const options = {
      body: json.text || json,
      timestamp: json.time || evt.timeStamp,
      badge: 'favicon.ico',
      lang: 'en',
      requireInteraction: false,
      silent: true,
      icon: 'favicon.ico',
      tag: 'pidash',
      data: {
        received: Date.now()
      },
      actions: [{
        action: 'close',
        title: 'Dismiss'
      }]
    };
    console.log(`PWA: ${evt.type} ${options.body}`);
    evt.waitUntil(self.registration.showNotification('PiDash', options));
  });
  listening = true;
}
},{}]},{},["../pwa-serviceworker.js"], null)
//# sourceMappingURL=/__/pwa-serviceworker.js.map