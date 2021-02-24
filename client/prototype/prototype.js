/* eslint-disable import/no-named-as-default-member */

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
  await config.setTheme();
  await main();
  // @ts-ignore
  if (!window.user.admin) {
    // @ts-ignore
    log.debug('User not authorized: ', window.user);
    return;
  }
  await config.done();
  await main();
}

window.onload = init;
