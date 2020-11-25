// import $ from 'jquery';
import config from '../shared/config.js';
import * as log from '../shared/log.js';
import * as user from '../shared/user.js';

async function main() {
  //
}

async function init() {
  log.debug(window.location.href);
  await user.get();
  await config.theme();
  await main();
  if (!window.user.admin) {
    log.debug('User not authorized: ', window.user);
    return;
  }
  await config.done();
  await main();
}

window.onload = init;
