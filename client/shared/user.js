// @ts-nocheck

import $ from 'jquery';
import * as log from './log';

// eslint-disable-next-line import/prefer-default-export
export async function get() {
  $('#progress').html('Authenticating');
  if (window.share) {
    await $.post('/api/user/auth', { authShare: window.share }); // autologin for direct shares
  }
  const res = await fetch('/api/user/get');
  if (res.ok) window.user = await res.json();
  if (!window.share && window.user && window.user.user && window.user.user.startsWith('share')) {
    $.post('/api/user/auth'); // logout on share credentials and no share
    log.debug('Logging out user with share credentials and no direct share link');
    window.user = {};
  }
  if (window.user && window.user.user) {
    $('#user').text(window.user.user.split('@')[0]);
    log.div('log', true, `User: ${window.user.user} root:${window.user.root} admin:${window.user.admin}`);
  } else {
    location.replace('/auth');
  }
  return window.user;
}
