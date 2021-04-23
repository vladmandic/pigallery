import $ from 'jquery';
import * as log from './log';

type User = { user: undefined | String, root: String, admin: boolean };
// eslint-disable-next-line import/no-mutable-exports
export let user:User = { user: undefined, root: '', admin: false };

// eslint-disable-next-line import/prefer-default-export
export async function get(isShare = null) {
  $('#progress').html('Authenticating');
  if (isShare) {
    await $.post('/api/user/auth', { authShare: isShare }); // autologin for direct shares
  }

  let res;
  try {
    res = await fetch('/api/user/get');
  } catch (err) {
    log.debug('Error /api/user/get:', err);
    if (err.toString().includes('Failed to fetch')) user = { user: 'offline', root: '', admin: false };
  }

  if (res && res.ok) user = await res.json();
  else if (res && res.status === 503) user = { user: 'offline', root: '', admin: false };

  if (!isShare && user && user.user && user.user.startsWith('share')) {
    $.post('/api/user/auth'); // logout on share credentials and no share
    log.debug('Logging out user with share credentials and no direct share link');
    user = { user: undefined, root: '', admin: false };
  }
  if (user && user.user) {
    $('#user').text(user.user.split('@')[0]);
    log.div('log', true, `User: ${user.user} root:${user.root} admin:${user.admin}`);
  } else {
    location.replace('/auth');
  }
  return user;
}
