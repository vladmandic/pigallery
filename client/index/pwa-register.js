import * as log from '../shared/log.js';

async function register(path) {
  const t0 = performance.now();
  if ('serviceWorker' in navigator) {
    try {
      let found = null;
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        log.debug(t0, 'PWA Found:', reg.scope);
        if (reg.scope.startsWith(location.origin)) found = reg;
      }
      if (!found) {
        const reg = await navigator.serviceWorker.register(path, { scope: '/' });
        found = reg;
        log.debug(t0, 'PWA Registered:', reg.scope);
      }
    } catch (err) {
      if (err.name === 'SecurityError') log.div('log', true, 'PWA: SSL certificate is untrusted');
      else log.debug(t0, 'PWA Error:', err);
    }
    if (navigator.serviceWorker.controller) {
      // @ts-ignore
      navigator.serviceWorker.controller.postMessage({ key: 'cacheModels', val: window.options.cacheModels });
      // @ts-ignore
      navigator.serviceWorker.controller.postMessage({ key: 'cacheAssets', val: window.options.cacheAssets });
      log.debug(t0, 'PWA Active:', navigator.serviceWorker.controller.scriptURL);
      const cache = await caches.open('pigallery');
      if (cache) {
        const content = await cache.matchAll();
        log.debug(t0, 'PWA Cache:', content.length, 'files');
      }
    }
  } else {
    log.debug(t0, 'PWA Inactive');
  }
}

exports.register = register;
