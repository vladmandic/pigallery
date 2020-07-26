/* global Popper */

// const oboe = require('oboe');
const moment = require('moment');
const marked = require('marked');
const faceapi = require('face-api.js');
const log = require('./log.js');
const config = require('./config.js');
const init = require('./init.js');
const list = require('./list.js');
const details = require('./details.js');
const map = require('./map.js');
const db = require('./indexdb.js');
const hash = require('./blockhash.js');
const options = require('./options.js');
const menu = require('./menu.js');
const pwa = require('./pwa-register.js');

// global variables
window.filtered = [];

function busy(working) {
  $('body').css('cursor', working ? 'wait' : 'default');
  $('main').css('cursor', working ? 'wait' : 'default');
  $('#btn-number').toggleClass('fa-images fa-clock');
  // $('#btn-number').css('color', working ? 'lightcoral' : `${window.theme.foreground}`);
  // $('#number').css('color', working ? 'gray' : '${window.theme.foreground}');
}

// eslint-disable-next-line no-unused-vars
async function time(fn, arg) {
  if (window.debug) {
    const t0 = window.performance.now();
    await fn(arg);
    log.debug(t0, `Timed ${fn.name}`);
  } else {
    fn(arg);
  }
}

// show tooltip with timeout
function showTip(parent, text, timeout = 3000) {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.role = 'tooltip';
  tip.className = 'popper';
  tip.innerHTML = text;
  parent.appendChild(tip);
  let popup = Popper.createPopper(parent, tip, { placement: 'left', strategy: 'absolute', modifiers: [{ name: 'offset', options: { offset: [0, 20] } }] });
  setTimeout(() => {
    popup.destroy();
    popup = null;
    parent.removeChild(tip);
  }, timeout);
}

// handles all clicks on sidebar menu (folders, locations, classes)
async function folderHandlers() {
  $('.collapsible').off();
  $('.collapsible').click(async (evt) => {
    $(evt.target).toggleClass('fa-chevron-circle-down fa-chevron-circle-right');
    $(evt.target).parent().parent().find('li').toggle('slow');
  });
  $('.folder').off();
  $('.folder').click(async (evt) => {
    const path = $(evt.target).attr('tag');
    const type = evt.target.getAttribute('type');
    if (!path || path.length < 1) return;
    const t0 = window.performance.now();
    busy(true);
    switch (type) {
      case 'folder':
        log.debug(t0, `Selected path: ${path}`);
        const root = window.user && window.user.root ? window.user.root : 'media/';
        if (window.filtered.length < await db.count()) {
          window.filtered = await db.all();
          window.options.listSortOrder = 'alpha-down';
        }
        if (path !== root) window.filtered = window.filtered.filter((a) => escape(a.image).startsWith(path));
        await menu.classes();
        folderHandlers();
        break;
      case 'location':
        log.debug(t0, `Selected location: ${path}`);
        if (window.filtered.length < await db.count()) {
          window.filtered = await db.all();
          window.options.listSortOrder = 'numeric-down';
        }
        if (path !== 'Unknown') window.filtered = window.filtered.filter((a) => (path.startsWith(escape(a.location.near)) || path.startsWith(escape(a.location.country))));
        else window.filtered = window.filtered.filter((a) => (!a.location || !a.location.near));
        await menu.classes();
        folderHandlers();
        break;
      case 'class':
        if (!window.filtered) window.filtered = [];
        window.filtered = window.filtered.filter((a) => {
          const found = a.tags.find((b) => (escape(Object.values(b)[0]).toString().startsWith(path)));
          return found;
        });
        log.debug(t0, `Selected class: ${path}`);
        break;
      case 'share':
        $('#share').toggle(true);
        const share = window.shares.find((a) => a.key === path);
        if (!share.name || !share.key) return;
        $('#share-name').val(share.name);
        $('#share-url').val(`${window.location.origin}?share=${share.key}`);
        $('#btn-shareadd').removeClass('fa-plus-square').addClass('fa-minus-square');
        window.share = share.key;
        // eslint-disable-next-line no-use-before-define
        sortResults(window.options.listSortOrder);
        await menu.enumerate();
        folderHandlers();
        break;
      default:
    }
    list.redraw();
    busy(false);
  });
}

// used by filterresults
function filterWord(word) {
  const skip = ['in', 'a', 'the', 'of', 'with', 'using', 'wearing', 'and', 'at', 'during', 'on'];
  if (skip.includes(word)) return window.filtered;
  const res = window.filtered.filter((obj) => {
    for (const tag of obj.tags) {
      const str = Object.values(tag) && Object.values(tag)[0] ? Object.values(tag)[0].toString() : '';
      const found = str.startsWith(word);
      if (found) return true;
    }
    return false;
  });
  return res;
}

// filters images based on search strings
async function filterResults(words) {
  busy(true);
  list.previous = null;
  let foundWords = 0;
  const t0 = window.performance.now();
  const size = window.filtered.length;
  for (const word of words.split(' ')) {
    window.filtered = filterWord(word.toLowerCase());
    foundWords += (window.filtered && window.filtered.length > 0) ? 1 : 0;
  }
  if (window.filtered && window.filtered.length > 0) log.debug(t0, `Searching for "${words}" found ${foundWords} words in ${window.filtered.length || 0} matches out of ${size} images`);
  else log.debug(t0, `Searching for "${words}" found ${foundWords} of ${words.split(' ').length} terms`);
  await menu.enumerate();
  folderHandlers();
  list.redraw();
  busy(false);
}

// randomize image order using Fisher-Yates (aka Knuth) shuffle
function shuffle(array) {
  let currentIndex = array.length;
  let temporaryValue;
  let randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

// sort by image simmilarity
async function simmilarImage(image) {
  busy(true);
  const t0 = window.performance.now();
  window.options.listDivider = 'simmilarity';
  const object = window.filtered.find((a) => a.image === decodeURI(image));
  for (const img of window.filtered) img.simmilarity = hash.distance(img.phash, object.phash);
  window.filtered = window.filtered
    .filter((a) => a.simmilarity < 70)
    .sort((a, b) => a.simmilarity - b.simmilarity);
  log.debug(t0, `Simmilar: ${window.filtered.length} images`);
  list.redraw();
  await menu.enumerate();
  folderHandlers();
  list.scroll();
  busy(false);
}

async function simmilarPerson(image) {
  busy(true);
  const t0 = window.performance.now();
  window.options.listDivider = 'simmilarity';
  const object = window.filtered.find((a) => a.image === decodeURI(image));
  const descriptor = (object.person && object.person[0] && object.person[0].descriptor) ? new Float32Array(Object.values(object.person[0].descriptor)) : null;
  if (!descriptor) {
    log.debug(t0, 'Simmilar Search aborted as no person found in image');
    busy(false);
    return;
  }
  for (const i in window.filtered) {
    const target = (window.filtered[i].person && window.filtered[i].person[0] && window.filtered[i].person[0].descriptor) ? new Float32Array(Object.values(window.filtered[i].person[0].descriptor)) : null;
    window.filtered[i].simmilarity = target ? Math.round(100 * faceapi.euclideanDistance(target, descriptor)) : 100;
  }
  window.filtered = window.filtered
    .filter((a) => ((a.person && a.person[0]) && (a.simmilarity < 55) && (a.person[0].gender === object.person[0].gender)))
    .sort((a, b) => a.simmilarity - b.simmilarity);
  log.debug(t0, `Simmilar: ${window.filtered.length} persons`);
  list.redraw();
  await menu.enumerate();
  folderHandlers();
  list.scroll();
  busy(false);
}

async function simmilarClasses(image) {
  busy(true);
  const t0 = window.performance.now();
  window.options.listDivider = 'simmilarity';
  const object = window.filtered.find((a) => a.image === decodeURI(image));

  const valid = ['classified', 'detected', 'camera', 'conditions', 'zoom', 'near'];
  const tags = object.tags.filter((obj) => valid.includes(Object.keys(obj)[0])).map((a) => Object.values(a)[0]);
  const count = tags.length;
  for (const i in window.filtered) {
    const t = window.filtered[i].tags.filter((obj) => valid.includes(Object.keys(obj)[0])).map((a) => Object.values(a)[0]);
    const found = tags.filter((a) => t.includes(a));
    window.filtered[i].simmilarity = Math.round(100.0 * found.length / count);
  }
  window.filtered = window.filtered
    .filter((a) => a.simmilarity > 55)
    .sort((a, b) => b.simmilarity - a.simmilarity);
  log.debug(t0, `Simmilar: ${window.filtered.length} classes`);
  list.redraw();
  await menu.enumerate();
  folderHandlers();
  list.scroll();
  busy(false);
}

// sorts images based on given sort order
let loadTried = false;
async function sortResults(sort) {
  // window.share = (window.location.search && window.location.search.startsWith('?share=')) ? window.location.search.split('=')[1] : null;
  $('#optionslist').toggle(false);
  if (!window.user.user) return;
  busy(true);

  // refresh records
  // eslint-disable-next-line no-use-before-define
  await loadGallery(window.options.listLimit, true);

  const t0 = window.performance.now();
  log.debug(t0, `Sorting: ${sort.replace('navlinebutton fas sort fa-', '')}`);
  if (sort.includes('random')) {
    window.filtered = await db.all();
    shuffle(window.filtered);
  }
  list.previous = null;
  // sort by
  if (sort.includes('alpha-down')) window.filtered = await db.all('name', true, 1, window.options.listItemCount);
  if (sort.includes('alpha-up')) window.filtered = await db.all('name', false, 1, window.options.listItemCount);
  if (sort.includes('numeric-down')) window.filtered = await db.all('date', false, 1, window.options.listItemCount);
  if (sort.includes('numeric-up')) window.filtered = await db.all('date', true, 1, window.options.listItemCount);
  if (sort.includes('amount-down')) window.filtered = await db.all('size', false, 1, window.options.listItemCount);
  if (sort.includes('amount-up')) window.filtered = await db.all('size', true, 1, window.options.listItemCount);
  // if (sort.includes('simmilarity')) window.filtered = await db.all('simmilarity', false); // simmilarity is calculated, not stored in indexdb
  // group by
  if (sort.includes('numeric-down') || sort.includes('numeric-up')) window.options.listDivider = 'month';
  else if (sort.includes('amount-down') || sort.includes('amount-up')) window.options.listDivider = 'size';
  else if (sort.includes('alpha-down') || sort.includes('alpha-up')) window.options.listDivider = 'folder';
  else if (sort.includes('simmilarity')) window.options.listDivider = 'simmilarity';
  else window.options.listDivider = '';
  list.redraw();
  $('#splash').toggle(false);
  log.debug(t0, `Cached images: ${window.filtered.length} fetched initial`);
  const t1 = window.performance.now();
  $('#all').focus();
  if (sort.includes('alpha-down')) window.filtered = window.filtered.concat(await db.all('name', true, window.options.listItemCount + 1));
  if (sort.includes('alpha-up')) window.filtered = window.filtered.concat(await db.all('name', false, window.options.listItemCount + 1));
  if (sort.includes('numeric-down')) window.filtered = window.filtered.concat(await db.all('date', false, window.options.listItemCount + 1));
  if (sort.includes('numeric-up')) window.filtered = window.filtered.concat(await db.all('date', true, window.options.listItemCount + 1));
  if (sort.includes('amount-down')) window.filtered = window.filtered.concat(await db.all('size', false, window.options.listItemCount + 1));
  if (sort.includes('amount-up')) window.filtered = window.filtered.concat(await db.all('size', true, window.options.listItemCount + 1));
  log.debug(t1, `Cached images: ${window.filtered.length} fetched remaining`);
  if (window.filtered.length > 0) log.result(`Retrieved ${window.filtered.length} images from cache`);
  else log.result('Image cache empty');
  if (!loadTried && window.filtered.length === 0) {
    loadTried = true;
    // eslint-disable-next-line no-use-before-define
    await loadGallery(window.options.listLimit);
  }
  await menu.enumerate();
  folderHandlers();
  list.scroll();
  busy(false);
}

// find duplicate images based on pre-computed sha-256 hash
async function findDuplicates() {
  busy(true);

  log.result('Analyzing images for simmilarity ...');
  const t0 = window.performance.now();
  list.previous = null;

  const f = '/dist/worker.js';
  const worker = new Worker(f);
  worker.addEventListener('message', (msg) => {
    // console.log('Miain received message', msg.data);
    window.filtered = msg.data;
    const t1 = window.performance.now();
    log.result(`Found ${window.filtered.length} simmilar images in ${Math.round(t1 - t0).toLocaleString()} ms`);
    sortResults('simmilarity');
    busy(false);
  });
  const all = await db.all();
  worker.postMessage(all);
}

async function fetchChunks(response) {
  const t0 = window.performance.now();
  const reader = response.body.getReader();
  // for (const header of response.headers.entries()) console.log('header', header);
  const size = parseInt(response.headers.get('content-Size') || response.headers.get('content-Length'), 10);
  let received = 0;
  const chunks = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const t1 = window.performance.now();
    const perf = Math.round(received / (t1 - t0));
    const progress = Math.round(100 * received / size);
    $('#progress').html(`Downloading ${progress}%:<br>${received.toLocaleString()} / ${size.toLocaleString()} bytes<br> (${perf.toLocaleString()} KB/sec)`);
  }
  const all = new Uint8Array(received);
  let position = 0;
  for (const chunk of chunks) {
    all.set(chunk, position);
    position += chunk.length;
  }
  const result = new TextDecoder('utf-8').decode(all);
  const json = JSON.parse(result);
  return json;
}

// loads imagesm, displays gallery and enumerates sidebar
async function loadGallery(limit, refresh = false) {
  $('#progress').text('Requesting');
  if (window.share) return;
  if (!window.user.user) return;
  if (window.user.user.startsWith('share')) {
    log.result('Application access with share credentials and no direct share');
    return;
  }
  busy(true);
  const t0 = window.performance.now();
  if (!refresh) {
    log.result('Downloading image cache ...');
    await db.reset();
    await db.open();
  }
  const updated = new Date().getTime();
  const since = refresh ? window.options.lastUpdated : 0;
  const res = await fetch(`/api/get?find=all&limit=${limit}&time=${since}`);
  let json = [];
  // if (res && res.ok) json = await res.json();
  if (res && res.ok) json = await fetchChunks(res);

  const t1 = window.performance.now();
  $('#progress').text('Indexing');
  await db.store(json);
  const t2 = window.performance.now();
  if (window.debug) {
    const size = JSON.stringify(json).length;
    log.debug(t0, `Cache download: ${json.length} images ${size.toLocaleString()} bytes ${Math.round(size / (t1 - t0)).toLocaleString()} KB/sec`);
  } else {
    // eslint-disable-next-line no-lonely-if
    if (!refresh) log.result(`Downloaded cache: ${await db.count()} images in ${Math.round(t1 - t0).toLocaleString()} ms stored in ${Math.round(t2 - t1).toLocaleString()} ms`);
  }
  if (refresh && (json.length > 0)) {
    log.result(`Refreshed cache: ${json.length} images updated since ${moment(window.options.lastUpdated).format('YYYY-MM-DD HH:mm:ss')} in ${Math.round(t1 - t0).toLocaleString()} ms`);
  }
  // window.filtered = await db.all();
  window.options.lastUpdated = updated;
  $('#progress').text('Almost done');
  if (!refresh) sortResults(window.options.listSortOrder);
  busy(false);
}

// popup on right-click
async function showContextPopup(evt) {
  evt.preventDefault();
  showTip(evt.target, `displaying ${window.filtered.length} of ${await db.count()} images`);
}

// resize viewport
function resizeViewport() {
  $('#main').height(window.innerHeight - $('#log').height() - $('#navbar').height() - 16);
  if ($('#popup').css('display') !== 'none') details.show();
}

// show/hide navigation bar elements
function showNavbar(elem) {
  if (!window.user.admin) $('#livevideo').toggle(false);
  if (elem) elem.toggle('slow');
  // hide the rest
  elem = elem || $('#main');
  $('#map').toggle(false);
  if (elem && elem[0] !== $('#popup')[0]) $('#popup').toggle(false);
  if (elem && elem[0] !== $('#docs')[0]) $('#docs').toggle(false);
  if (elem && elem[0] !== $('#searchbar')[0]) $('#searchbar').toggle(false);
  if (elem && elem[0] !== $('#userbar')[0]) $('#userbar').toggle(false);
  if (elem && elem[0] !== $('#optionslist')[0]) $('#optionslist').toggle(false);
  if (elem && elem[0] !== $('#optionsview')[0]) $('#optionsview').toggle(false);
  $(document).on('pagecontainerbeforechange', (evt, data) => {
    if (typeof data.toPage === 'string' && data.options.direction === 'back') {
      data.toPage = window.location;
      data.options.transition = 'flip';
    }
  });
}

async function initSharesHandler() {
  if (!window.user.admin) {
    $('#sharestitle').toggle(false);
    return;
  }
  $('#sharestitle').off();
  $('#sharestitle').click(() => {
    const show = $('#share').is(':visible');
    $('#btn-shareadd').removeClass('fa-minus-square').addClass('fa-plus-square');
    $('#share').toggle(!show);
    $('#shares').find('li').toggle(!show);
    $('#share-name').val('');
    $('#share-url').val('');
    $('#share-name').focus();
  });

  $('#btn-shareadd').off();
  $('#btn-shareadd').click(() => {
    const t0 = window.performance.now();
    if ($('#btn-shareadd').hasClass('fa-plus-square')) {
      const share = {};
      share.creator = window.user.user;
      share.name = $('#share-name').val();
      share.images = window.filtered.map((a) => a.image);
      log.debug(t0, `Share create: creator: ${share.creator} name: ${share.name} images: ${share.images.length.toLocaleString()} size: ${JSON.stringify(share).length.toLocaleString()} bytes`);
      if (!share.creator || !share.name || ((share.name.length < 2) || !share.images) || (share.images.length < 1)) {
        $('#share-url').val('invalid data');
        return;
      }
      $.post('/api/share', share)
        .done((res) => $('#share-url').val(`${window.location.origin}?share=${res.key}`))
        .fail(() => $('#share-url').val('error creating share'));
      menu.shares();
    } else {
      const name = $('#share-name').val();
      const key = $('#share-url').val().split('=')[1];
      log.debug(t0, `Share remove: ${name} ${key}`);
      fetch(`/api/share?rm=${key}`).then(() => menu.shares());
    }
  });

  $('#btn-sharecopy').off();
  $('#btn-sharecopy').click(() => {
    $('#share-url').focus();
    $('#share-url').select();
    document.execCommand('copy');
  });
}

// handle keypresses on main
async function initHotkeys() {
  $('html').keydown(() => {
    const top = $('#results').scrollTop();
    const line = window.options.listThumbSize / 2 + 16;
    const page = $('#results').height() - window.options.listThumbSize;
    const bottom = $('#results').prop('scrollHeight');
    $('#results').stop();
    switch (event.keyCode) {
      // case 38: $('#results').animate({ scrollTop: top - line }, 4000); break; // key=up: scroll line up
      // case 40: $('#results').animate({ scrollTop: top + line }, 4000); break; // key=down; scroll line down
      case 38: $('#results').scrollTop(top - line); break; // key=down; scroll line down
      case 40: $('#results').scrollTop(top + line); break; // key=down; scroll line down
      case 33: $('#results').animate({ scrollTop: top - page }, 400); break; // key=pgup; scroll page up
      case 34: $('#results').animate({ scrollTop: top + page }, 400); break; // key=pgdn; scroll page down
      case 36: $('#results').animate({ scrollTop: 0 }, 1000); break; // key=home; scroll to top
      case 35: $('#results').animate({ scrollTop: bottom }, 1000); break; // key=end; scroll to bottom
      case 37: details.next(true); break; // key=left; previous image in details view
      case 39: details.next(false); break; // key=right; next image in details view
      case 191: $('#btn-search').click(); break; // key=/; open search input
      case 190: $('#btn-sort').click(); break; // key=.; open sort options
      case 188: $('#btn-desc').click(); break; // key=,; show/hide list descriptions
      case 220: loadGallery(window.options.listLimit); break; // key=\; refresh all
      case 222: sortResults(window.options.listSortOrder); break; // key='; remove filters
      case 27: // key=esc; close all
        $('#popup').toggle(false);
        $('#searchbar').toggle(false);
        $('#optionslist').toggle(false);
        $('#optionsview').toggle(false);
        $('#popup').toggle(false);
        details.slideshow(false);
        break;
      default: // log.result('Unhandled keydown event', event.keyCode);
    }
  });
}

function initSidebarHandlers() {
  $('#resettitle').click(() => {
    window.share = null;
    sortResults(window.options.listSortOrder);
  });
  $('#folderstitle').click(() => $('#folders').toggle('slow'));
  $('#locationstitle').click(() => $('#locations').toggle('slow'));
  $('#classestitle').click(() => $('#classes').toggle('slow'));
  $('#folders').toggle(false);
  $('#locations').toggle(false);
  $('#classes').toggle(false);
  $(window).resize(() => resizeViewport());
}

// initializes all mouse handlers for main menu in list view
async function initListHandlers() {
  // navbar user
  $('#btn-user').click(() => {
    showNavbar($('#userbar'));
    $('#imagenum')[0].value = window.options.listLimit;
    $('#imagenum')[0].focus();
  });

  // navline user input
  $('#imagenum').keyup(() => {
    if (event.keyCode === 13) {
      $('#btn-load').click();
      showNavbar();
    }
  });

  // navline user load
  $('#btn-load').click((evt) => {
    window.options.listLimit = parseInt($('#imagenum')[0].value, 10);
    showTip(evt.target, `Loading maximum of ${window.options.listLimit} latest images`);
    showNavbar();
    loadGallery(window.options.listLimit);
  });

  // navline user update db
  // starts image processing in a separate window
  $('#btn-update').click(() => {
    if (window.user.admin) {
      log.result('Image database update requested ...');
      showNavbar();
      window.open('/process', '_blank');
    } else {
      log.result('Image database update not authorized');
    }
  });

  // navline user docs
  $('#btn-doc').click(async () => {
    await showNavbar($('#docs'));
    // $('#docs').click(() => $('#docs').toggle('fast'));
    if ($('#docs').css('display') !== 'none') {
      const res = await fetch('/README.md');
      const md = await res.text();
      if (md) $('#docs').html(marked(md));
    }
  });

  // navline user changelog
  $('#btn-changelog').click(async () => {
    await showNavbar($('#docs'));
    // $('#docs').click(() => $('#docs').toggle('fast'));
    if ($('#docs').css('display') !== 'none') {
      const res = await fetch('/CHANGELOG.md');
      const md = await res.text();
      if (md) $('#docs').html(marked(md));
    }
  });

  // navline user options
  $('#btn-options').click(async () => {
    await showNavbar($('#docs'));
    if ($('#docs').css('display') !== 'none') options.show();
  });

  // navline user logout
  $('#btn-logout').click(() => {
    showNavbar();
    $.post('/api/auth');
    if ($('#btn-user').hasClass('fa-user-slash')) window.location = '/client/auth.html';
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    window.location.reload();
  });

  // navbar search
  $('#btn-search').click(async () => {
    await showNavbar($('#searchbar'));
    $('#btn-search').toggleClass('fa-search fa-search-location');
    $('#search-input').focus();
  });

  // navbar map
  $('#btn-map').click(() => {
    $('#btn-map').toggleClass('fa-map fa-map-marked');
    map.show($('btn-map').hasClass('fa-map-marked'));
  });

  // navline search input
  $('#search-input').keyup(() => {
    event.preventDefault();
    if (event.keyCode === 191) $('#search-input')[0].value = ''; // reset on key=/
    if (event.keyCode === 13) filterResults($('#search-input')[0].value);
  });

  // navline search ok
  $('#btn-searchnow').click(() => filterResults($('#search-input')[0].value));

  // navline search cancel
  $('#btn-resetsearch').click(() => {
    $('#search-input')[0].value = '';
    // filterResults('');
    sortResults(window.options.listSortOrder);
  });

  // navbar list
  $('#btn-list').click(async () => {
    await showNavbar($('#optionslist'));
  });

  // navline list sidebar
  $('#btn-folder').click(() => {
    $('#folderbar').toggle('slow');
    $('#btn-folder').toggleClass('fa-folder fa-folder-open');
    window.options.listFolders = !window.options.listFolders;
  });

  // navline list descriptions
  $('#btn-desc').click(() => {
    window.options.listDetails = !window.options.listDetails;
    $('.description').toggle('slow');
    $('#btn-desc').toggleClass('fa-comment fa-comment-slash');
  });

  $('#btn-title').click(() => {
    window.options.listTitle = !window.options.listTitle;
    $('.divider').toggle('slow');
    $('#btn-title').toggleClass('fa-comment-dots fa-comment-slash');
  });

  // navline list duplicates
  $('#btn-duplicates').click(() => {
    findDuplicates();
  });

  // navline list sort
  $('.sort').click((evt) => {
    window.options.listSortOrder = evt.target.className;
    sortResults(evt.target.className);
  });

  // navline list thumbnail size
  $('#thumbsize').on('input', () => list.resize());

  // navbar slideshow
  $('#btn-slide').click(() => {
    details.show(window.filtered[0].image);
    details.slideshow(true);
  });

  // navbar livevideo
  // starts live video detection in a separate window
  $('#btn-video').click(() => {
    log.result('Starting Live Video interface ...');
    window.open('/video', '_blank');
  });

  // navbar images number
  $('#btn-number').click(async () => {
    const t0 = window.performance.now();
    sortResults(window.options.listSortOrder);
    log.debug(t0, 'Reset filtered results');
  });

  $('#btn-number').mouseover(async () => {
    // showTip(evt.target, `Currently displaying: ${(parseInt(list.current - 1, 10) + 1)}<br><br>Total images: ${window.filtered.length}`);
  });
}

async function hashChange(evt) {
  const t0 = window.performance.now();
  log.debug(t0, `URL Hash change: ${evt.newURL}`);
  const target = parseInt(evt.newURL.substr(evt.newURL.indexOf('#') + 1), 10);
  const source = parseInt(evt.oldURL.substr(evt.oldURL.indexOf('#') + 1), 10);
  if (source > target) {
    const top = parseInt($('#all').scrollTop(), 10) === 0;
    const all = await db.count() - window.filtered.length;
    if (top && all === 0) {
      log.debug(t0, 'Exiting ...');
    } else {
      sortResults(window.options.listSortOrder);
      log.debug(t0, 'Reset image selection');
    }
  }
}

async function animate() {
  $('body').css('background', `radial-gradient(at 50% 100%, ${window.theme.gradient} 0, ${window.theme.background} 100%, ${window.theme.background} 100%)`);
  $(document).mousemove((event) => {
    const mouseXpercentage = Math.round(event.pageX / $(window).width() * 100);
    const mouseYpercentage = Math.round(event.pageY / $(window).height() * 100);
    $('body').css('background', `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, ${window.theme.gradient} 0, ${window.theme.background} 100%, ${window.theme.background} 100%)`);
  });
}

async function googleAnalytics() {
  // eslint-disable-next-line prefer-rest-params
  // function gtag() { window.dataLayer.push(arguments); }
  // gtag('js', new Date());
  // gtag('config', 'UA-155273-2', { page_path: `${location.pathname}` });
  // gtag('set', { user_id: `${window.user}` }); // Set the user ID using signed-in user_id.
}

async function main() {
  if (config.default.registerPWA) pwa.register('/client/pwa-serviceworker.js');
  window.share = (window.location.search && window.location.search.startsWith('?share=')) ? window.location.search.split('=')[1] : null;

  resizeViewport();
  googleAnalytics();
  await config.theme();
  animate();
  await init.user();
  await showNavbar();
  $('body').contextmenu((evt) => showContextPopup(evt));
  initListHandlers();
  initSidebarHandlers();
  details.handlers();
  initHotkeys();
  await db.open();
  initSharesHandler();
  window.details = details;
  window.simmilarImage = simmilarImage;
  window.simmilarPerson = simmilarPerson;
  window.simmilarClasses = simmilarClasses;
  if (window.share) log.debug(null, `Direct link to share: ${window.share}`);
  $('body').css('display', 'block');
  list.resize();
  await sortResults(window.options.listSortOrder);
  $('.collapsible').parent().parent().find('li').toggle(false);
}

window.onpopstate = (evt) => log.debug(null, `URL Pop state: ${evt.target.location.href}`);
window.onhashchange = (evt) => hashChange(evt);
window.onload = main;

exports.load = loadGallery;
