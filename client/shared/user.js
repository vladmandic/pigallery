// @ts-nocheck

import $ from 'jquery';
import * as log from './log';

// eslint-disable-next-line import/prefer-default-export
export async function get() {
  $('#progress').html('Authenticating');
  if (window.share) {
    await $.post('/api/user/auth', { authShare: window.share }); // autologin for direct shares
  }

  let res;
  try {
    res = await fetch('/api/user/get');
  } catch (err) {
    log.debug('Error /api/user/get:', err);
    if (err.toString().includes('Failed to fetch')) window.user = { user: 'offline', root: '', admin: false };
  }

  if (res && res.ok) window.user = await res.json();
  else if (res && res.status === 503) window.user = { user: 'offline', root: '', admin: false };

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
