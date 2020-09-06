import * as tf from '../assets/tf.es2017.js';
import marked from '../assets/marked.esm.js';

const jQuery = require('jquery');
const faceapi = require('../assets/face-api.cjs');
const config = require('./config.js');
const db = require('./indexdb.js');
const details = require('./details.js');
const hash = require('./blockhash.js');
const init = require('./init.js');
const list = require('./list.js');
const log = require('./log.js');
const map = require('./map.js');
const menu = require('./menu.js');
const video = require('./video.js');
const process = require('./process.js');
const options = require('./options.js');
const pwa = require('./pwa-register.js');

// global variables
window.$ = jQuery;
window.filtered = [];
const stats = { images: 0, latency: 0, fetch: 0, interactive: 0, complete: 0, load: 0, size: 0, speed: 0, store: 0, initial: 0, remaining: 0, enumerate: 0, ready: 0, cache: 0 };

async function busy(text) {
  if (text) {
    $('#busy-text').html(text);
    $('.busy').show();
  } else {
    $('.busy').hide();
  }
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
    busy(`Selected<br>${path}`);
    switch (type) {
      case 'folder':
        log.debug(t0, `Selected path: ${path}`);
        const root = window.user && window.user.root ? window.user.root : 'media/';
        if (window.filtered.length < await db.count()) {
          window.filtered = await db.all();
          // window.options.listSortOrder = 'alpha-down';
        }
        if (path !== root) window.filtered = window.filtered.filter((a) => escape(a.image).startsWith(path));
        await menu.classes();
        folderHandlers();
        break;
      case 'location':
        log.debug(t0, `Selected location: ${path}`);
        if (window.filtered.length < await db.count()) {
          window.filtered = await db.all();
          // window.options.listSortOrder = 'numeric-down';
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
    busy();
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
  busy('Searching for<br>simmilar images');
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
  busy();
}

async function simmilarPerson(image) {
  busy('Searching for<br>simmilar people');
  const t0 = window.performance.now();
  window.options.listDivider = 'simmilarity';
  const object = window.filtered.find((a) => a.image === decodeURI(image));
  const descriptor = (object.person && object.person[0] && object.person[0].descriptor) ? new Float32Array(Object.values(object.person[0].descriptor)) : null;
  if (!descriptor) {
    log.debug(t0, 'Simmilar Search aborted as no person found in image');
    busy();
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
  busy();
}

async function simmilarClasses(image) {
  busy('Searching for<br>simmilar classes');
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
  busy();
}

// sorts images based on given sort order
let loadTried = false;
async function sortResults(sort) {
  $('#optionslist').toggle(false);
  if (!window.user.user) return;

  // refresh records
  // eslint-disable-next-line no-use-before-define
  await loadGallery(window.options.listLimit, true);

  const t0 = window.performance.now();
  log.debug(t0, `Sorting: ${sort.replace('navlinebutton fad sort fa-', '')}`);
  if (sort.includes('random')) {
    window.filtered = await db.all();
    shuffle(window.filtered);
  }
  list.previous = null;
  // sort by
  busy('Sorting images');
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
  stats.initial = Math.floor(t1 - t0);
  $('#all').focus();
  busy('Loading remaining<br>images in background');
  if (sort.includes('alpha-down')) window.filtered = window.filtered.concat(await db.all('name', true, window.options.listItemCount + 1));
  if (sort.includes('alpha-up')) window.filtered = window.filtered.concat(await db.all('name', false, window.options.listItemCount + 1));
  if (sort.includes('numeric-down')) window.filtered = window.filtered.concat(await db.all('date', false, window.options.listItemCount + 1));
  if (sort.includes('numeric-up')) window.filtered = window.filtered.concat(await db.all('date', true, window.options.listItemCount + 1));
  if (sort.includes('amount-down')) window.filtered = window.filtered.concat(await db.all('size', false, window.options.listItemCount + 1));
  if (sort.includes('amount-up')) window.filtered = window.filtered.concat(await db.all('size', true, window.options.listItemCount + 1));
  log.debug(t1, `Cached images: ${window.filtered.length} fetched remaining`);
  stats.remaining = Math.floor(window.performance.now() - t1);
  // if (window.filtered.length > 0) log.div('log', true, `Loaded ${window.filtered.length} images from cache`);
  if (window.filtered.length === 0) log.div('log', true, 'Image cache empty');
  if (!loadTried && window.filtered.length === 0) {
    loadTried = true;
    // eslint-disable-next-line no-use-before-define
    await loadGallery(window.options.listLimit);
  }
  busy('Enumerating images');
  await menu.enumerate();
  stats.enumerate = Math.floor(window.performance.now() - t1);
  folderHandlers();
  list.scroll();
  busy();
}

// find duplicate images based on pre-computed sha-256 hash
async function findDuplicates() {
  busy('Searching for<br>duplicate images');

  log.div('log', true, 'Analyzing images for simmilarity ...');
  const t0 = window.performance.now();
  list.previous = null;

  const f = '/dist/worker.js';
  const worker = new Worker(f);
  worker.addEventListener('message', (msg) => {
    // console.log('Miain received message', msg.data);
    window.filtered = msg.data;
    const t1 = window.performance.now();
    log.div('log', true, `Found ${window.filtered.length} simmilar images in ${Math.round(t1 - t0).toLocaleString()} ms`);
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
  const size = parseInt(response.headers.get('content-Size') || response.headers.get('content-Length'));
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
    $('#progress').html(`Downloading ${progress}%:<br>${received.toLocaleString()} / ${size.toLocaleString()} bytes<br>${perf.toLocaleString()} KB/sec`);
  }
  $('#progress').html(`Download complete<br>${size.toLocaleString()} bytes`);
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
  if (window.share) return;
  if (!window.user.user) return;
  $('#progress').text('Requesting');
  if (window.user.user.startsWith('share')) {
    log.div('log', true, 'Application access with share credentials and no direct share');
    return;
  }
  busy('Loading images<br>in background');
  const t0 = window.performance.now();
  if (!refresh) {
    log.div('log', true, 'Downloading image cache ...');
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
  stats.load = Math.floor(t1 - t0);
  $('#progress').text('Indexing');
  await db.store(json);
  const t2 = window.performance.now();
  stats.store = Math.floor(t2 - t1);
  if (window.debug) {
    const size = JSON.stringify(json).length;
    stats.size = size;
    stats.speed = Math.round(size / (t1 - t0));
    log.debug(t0, `Cache download: ${json.length} images ${size.toLocaleString()} bytes ${Math.round(size / (t1 - t0)).toLocaleString()} KB/sec`);
  } else {
    // eslint-disable-next-line no-lonely-if
    if (!refresh) log.div('log', true, `Downloaded cache: ${await db.count()} images in ${Math.round(t1 - t0).toLocaleString()} ms stored in ${Math.round(t2 - t1).toLocaleString()} ms`);
  }
  if (refresh && (json.length > 0)) {
    // const dt = window.options.lastUpdated === 0 ? 'start' : moment(window.options.lastUpdated).format('YYYY-MM-DD HH:mm:ss');
    const dt = window.options.lastUpdated === 0 ? 'start' : new Date(window.options.lastUpdated).toLocaleDateString();
    log.div('log', true, `Refreshed cache: ${json.length} images updated since ${dt}`);
  }
  // window.filtered = await db.all();
  window.options.lastUpdated = updated;
  $('#progress').text('Almost done');
  if (!refresh) sortResults(window.options.listSortOrder);
}

// popup on right-click
async function showContextPopup(evt) {
  evt.preventDefault();
}

// resize viewport
function resizeViewport() {
  $('#main').height(window.innerHeight - $('#log').height() - $('#navbar').height() - 16);
  if ($('#popup').css('display') !== 'none') details.show();
  const top = $('#optionsview').css('height');
  const height = $('body').height() - parseInt($('#optionsview').css('height'));
  $('#popup').css('top', top);
  $('#popup').height(height);
  $('#docs').css('top', top);
  $('#docs').height(height);
  $('#video').css('top', top);
  $('#video').height(height);
  $('#process').css('top', top);
  $('#process').height(height);
}

// show/hide navigation bar elements
function showNavbar(elem) {
  if (elem) elem.toggle('slow');
  // hide the rest
  elem = elem || $('#main');
  $('#map').hide();
  if (elem && elem[0] !== $('#popup')[0]) $('#popup').hide();
  if (elem && elem[0] !== $('#docs')[0]) $('#docs').hide();
  if (elem && elem[0] !== $('#video')[0]) $('#video').hide();
  if (elem && elem[0] !== $('#process')[0]) $('#process').hide();
  if (elem && elem[0] !== $('#searchbar')[0]) $('#searchbar').hide();
  if (elem && elem[0] !== $('#userbar')[0]) $('#userbar').hide();
  if (elem && elem[0] !== $('#optionslist')[0]) $('#optionslist').hide();
  if (elem && elem[0] !== $('#optionsview')[0]) $('#optionsview').hide();
  $(document).on('pagecontainerbeforechange', (evt, data) => {
    if (typeof data.toPage === 'string' && data.options.direction === 'back') {
      data.toPage = window.location;
      data.options.transition = 'flip';
    }
  });
  $('#btn-desc').removeClass('fa-comment fa-comment-slash');
  $('#btn-desc').addClass(window.options.listDetails ? 'fa-comment' : 'fa-comment-slash');
  $('#btn-title').removeClass('fa-comment-dots fa-comment-slash');
  $('#btn-title').addClass(window.options.listTitle ? 'fa-comment-dots' : 'fa-comment-slash');
}

async function initSharesHandler() {
  if (!window.user.admin) {
    $('#sharestitle').toggle(false);
    return;
  }
  $('#sharestitle').off();
  $('#sharestitle').click(async () => {
    const show = $('#share').is(':visible');
    if (!show) await menu.shares();
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
      default: // log.div('log', true, 'Unhandled keydown event', event.keyCode);
    }
  });
}

function initSidebarHandlers() {
  $('#resettitle').click(() => {
    window.share = (window.location.search && window.location.search.startsWith('?share=')) ? window.location.search.split('=')[1] : null;
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
async function initMenuHandlers() {
  // navbar user
  $('#btn-user').click(() => {
    showNavbar($('#userbar'));
  });

  // navline user input
  $('#imagenum').keyup(() => {
    if (event.keyCode === 13) {
      $('#btn-load').click();
      showNavbar();
    }
  });

  // navline user load
  $('#btn-load').click(() => {
    showNavbar();
    loadGallery(window.options.listLimit);
  });

  // navline user update db
  $('#btn-update').click(async () => {
    if (window.user.admin) {
      await showNavbar($('#process'));
      if ($('#process').css('display') !== 'none') {
        await process.start();
        await loadGallery(window.options.listLimit);
      }
    } else {
      log.div('log', true, 'Image database update not authorized');
    }
  });

  // navline user docs
  $('#btn-doc').click(async () => {
    await showNavbar($('#docs'));
    if ($('#docs').css('display') !== 'none') {
      const res = await fetch('/README.md');
      const md = await res.text();
      if (md) $('#docs').html(marked(md));
    }
  });

  // navline user changelog
  $('#btn-changelog').click(async () => {
    await showNavbar($('#docs'));
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
  $('#btn-logout').click(async () => {
    await showNavbar();
    $.post('/api/auth');
    if ($('#btn-user').hasClass('fa-user-slash')) window.location = '/client/auth.html';
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    document.cookie = 'connect.sid=null; expires=Thu, 1 Jan 2000 12:00:00 UTC; path=/';
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
  $('#btn-video').click(async () => {
    if ($('#video').css('display') === 'none') video.init();
    else video.stop();
    await showNavbar($('#video'));
    // 'media/Samples/Videos/video-appartment.mp4'
    // 'media/Samples/Videos/video-jen.mp4'
    // 'media/Samples/Videos/video-dash.mp4'
    // 'media/Samples/Videos/video-r1.mp4'
  });

  // navbar images number
  $('#btn-number').click(async () => {
    const t0 = window.performance.now();
    sortResults(window.options.listSortOrder);
    log.debug(t0, 'Reset filtered results');
  });

  $('#log').click(() => {
    if (!window.deferredPrompt) {
      log.debug('Application is not installable');
      return;
    }
    window.deferredPrompt.prompt();
    window.deferredPrompt.userChoice.then((res) => {
      log.debug('Application Install: ', res.outcome);
    });
  });

  $('#btn-number').mouseover(async () => { /**/ });
  $('.navbarbutton').css('opacity', 1);
}

async function hashChange(evt) {
  const t0 = window.performance.now();
  log.debug(t0, `URL Hash change: ${evt.newURL}`);
  const target = parseInt(evt.newURL.substr(evt.newURL.indexOf('#') + 1));
  const source = parseInt(evt.oldURL.substr(evt.oldURL.indexOf('#') + 1));
  if (source > target) {
    const top = parseInt($('#all').scrollTop()) === 0;
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
    if (window.dominant) $('#popup').css('background', `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, ${window.dominant[1]} 0, ${window.dominant[0]} 100%, ${window.dominant[0]} 100%)`);
    else $('#popup').css('background', `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, ${window.theme.gradient} 0, ${window.theme.background} 100%, ${window.theme.background} 100%)`);
  });
}

async function googleAnalytics() {
  // eslint-disable-next-line prefer-rest-params
  // function gtag() { window.dataLayer.push(arguments); }
  // gtag('js', new Date());
  // gtag('config', 'UA-155273-2', { page_path: `${location.pathname}` });
  // gtag('set', { user_id: `${window.user}` }); // Set the user ID using signed-in user_id.
}

async function perfDetails() {
  if (window.PerformanceNavigationTiming) {
    const perf = performance.getEntriesByType('navigation')[0];
    stats.latency = Math.round(perf.fetchStart);
    stats.fetch = Math.round(perf.responseEnd);
    stats.interactive = Math.round(perf.domInteractive);
    stats.complete = Math.round(perf.duration);
    log.debug('Performance:', perf);
  } else if (window.performance) {
    log.debug('Performance:', performance.timing);
  }
}

async function main() {
  const t0 = window.performance.now();
  log.debug(null, 'Starting PiGallery');
  window.addEventListener('beforeinstallprompt', (evt) => {
    evt.preventDefault();
    window.deferredPrompt = evt;
  });
  if (config.default.registerPWA) await pwa.register('/client/pwa-serviceworker.js');
  window.share = (window.location.search && window.location.search.startsWith('?share=')) ? window.location.search.split('=')[1] : null;

  await config.theme();
  animate();
  await init.user();
  await showNavbar();
  googleAnalytics();
  details.handlers();
  initHotkeys();
  await db.open();
  window.details = details;
  window.simmilarImage = simmilarImage;
  window.simmilarPerson = simmilarPerson;
  window.simmilarClasses = simmilarClasses;
  if (window.share) log.debug(null, `Direct link to share: ${window.share}`);
  $('body').contextmenu((evt) => showContextPopup(evt));
  $('body').css('display', 'block');
  $('.collapsible').parent().parent().find('li').toggle(false);
  await resizeViewport();
  await perfDetails();
  await list.resize();
  await sortResults(window.options.listSortOrder);

  await initSidebarHandlers();
  await initSharesHandler();
  await initMenuHandlers();

  window.tf = tf;
  window.faceapi = faceapi;

  log.debug('TensorFlow/JS', tf.version_core);
  stats.images = window.filtered.length;
  stats.ready = Math.floor(window.performance.now() - t0);
  const cache = caches ? await caches.open('pigallery') : null;
  stats.cache = cache ? await cache.matchAll().length : 0;
  if (window.filtered.length > 0) {
    log.div('log', true, 'Ready: ', stats.images, ' Images in ', stats.ready, 'ms');
    log.server('Stats: ', stats);
  }
}

// window.onpopstate = (evt) => log.debug(null, `URL Pop state: ${evt.target.location.href}`);
window.onhashchange = (evt) => hashChange(evt);
window.onload = main;
