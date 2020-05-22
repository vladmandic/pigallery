import log from './log.js';

async function register(path) {
  if ('serviceWorker' in navigator) {
    try {
      let found = false;
      navigator.serviceWorker.getRegistrations()
        .then((regs) => {
          for (const reg of regs) {
            if (reg.active && reg.active.state === 'activated') found = true;
          }
          return found;
        })
        .catch((err) => {
          log.result(`PWA Error: code ${err.code} ${err.name} - ${err.message}`);
        });
      if (!found) {
        navigator.serviceWorker
          .register(path, { scope: '/' })
          .then((reg) => {
            log.result(`PWA Registration scope: ${reg.scope}`);
          })
          .catch((err) => {
            if (err.name === 'SecurityError') log.result('SSL certificate is untrusted');
            else log.result(`PWA Error: code ${err.code} ${err.name} - ${err.message}`);
          });
      }
    } catch (err) {
      if (err.name === 'SecurityError') log.result('SSL certificate is untrusted');
      else log.result(`PWA Error: code ${err.code} ${err.name} - ${err.message}`);
    }
  }
}

const pwa = {
  register,
};

export default pwa;
