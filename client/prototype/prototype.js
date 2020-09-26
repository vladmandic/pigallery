const jQuery = require('jquery');
const log = require('../shared/log.js');
const config = require('../shared/config.js');
const user = require('../shared/user.js');

async function main() {
  //
}

async function init() {
  window.$ = jQuery;
  await user.get();
  await config.theme();
  if (!window.user.admin) {
    log.debug('User not authorized: ', window.user);
    return;
  }
  await config.done();
  await main();
}

window.onload = init;
