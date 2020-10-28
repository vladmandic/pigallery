import $ from 'jquery';
import * as log from './log.js';

async function getUser() {
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
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    $('#user').text(window.user.user.split('@')[0]);
    log.div('log', true, `User: ${window.user.user} root:${window.user.root} admin:${window.user.admin}`);
  } else {
    window.location.replace('/auth');
  }
}

exports.get = getUser;
