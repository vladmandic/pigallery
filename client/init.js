const log = require('./log.js');

async function initUser() {
  $('#progress').html('Authenticating');
  if (window.share) {
    await $.post('/api/auth', { authShare: window.share }); // autologin for direct shares
  }
  const res = await fetch('/api/user');
  if (res.ok) window.user = await res.json();
  if (!window.share && window.user && window.user.user && window.user.user.startsWith('share')) {
    $.post('/api/auth'); // logout on share credentials and no share
    log.debug('Logging out user with share credentials and no direct share link');
    window.user = {};
  }
  if (window.user && window.user.user) {
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    $('#user').text(window.user.user.split('@')[0]);
    log.div('log', true, `User: ${window.user.user} root:${window.user.root} admin:${window.user.admin}`);
    if (!window.user.admin) $('#btn-update').css('color', 'gray');
  } else {
    window.location = '/client/auth.html';
  }
  $('body').css('fontSize', window.options.fontSize);
  $('#folderbar').toggle(window.options.listFolders);
  $('.description').toggle(window.options.listDetails);
  $('#thumbsize')[0].value = window.options.listThumbSize;
  // log.debug(null, 'Cookie:', document.cookie);
}

exports.user = initUser;
