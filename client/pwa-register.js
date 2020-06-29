const log = require('./log.js');

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
          log.result(`PWA error: code ${err.code} ${err.name} - ${err.message}`);
        });
      if (!found) {
        navigator.serviceWorker
          .register(path, { scope: '/' })
          // eslint-disable-next-line no-unused-vars
          .then((reg) => {
            // log.result(`PWA registration scope: ${reg.scope}`);
          })
          .catch((err) => {
            if (err.name === 'SecurityError') log.result('SSL certificate is untrusted');
            else log.result(`PWA error: code ${err.code} ${err.name} - ${err.message}`);
          });
      }
    } catch (err) {
      if (err.name === 'SecurityError') log.result('SSL certificate is untrusted');
      else log.result(`PWA error: code ${err.code} ${err.name} - ${err.message}`);
    }
  }
}

exports.register = register;
