import * as log from '../shared/log';
import * as config from '../shared/config';

export async function register(path) {
  const t0 = performance.now();
  if ('serviceWorker' in navigator) {
    try {
      let found;
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        log.debug(t0, 'PWA found:', reg.scope);
        if (reg.scope.startsWith(location.origin)) found = reg;
      }
      if (!found) {
        const reg = await navigator.serviceWorker.register(path, { scope: '/' });
        found = reg;
        log.debug(t0, 'PWA registered:', reg.scope);
      }
    } catch (err) {
      if (err.name === 'SecurityError') log.div('log', true, 'PWA: SSL certificate is untrusted');
      else log.debug(t0, 'PWA error:', err);
    }
    if (navigator.serviceWorker.controller) {
      // update pwa configuration as it doesn't have access to it
      navigator.serviceWorker.controller.postMessage({ key: 'cacheModels', val: config.default.cacheModels });
      navigator.serviceWorker.controller.postMessage({ key: 'cacheAssets', val: config.default.cacheAssets });
      navigator.serviceWorker.controller.postMessage({ key: 'cacheMedia', val: config.default.cacheMedia });
      navigator.serviceWorker.controller.postMessage({ key: 'mediaRoot', val: config.default.mediaRoot });
      navigator.serviceWorker.controller.postMessage({ key: 'modelsRoot', val: config.default.modelsRoot });

      log.debug(t0, 'PWA Active:', navigator.serviceWorker.controller.scriptURL);
      const cache = await caches.open('pigallery');
      if (cache) {
        const content = await cache.matchAll();
        log.debug(t0, 'PWA cache:', content.length, 'files');
      }
    }
  } else {
    log.debug(t0, 'PWA inactive');
  }
}
