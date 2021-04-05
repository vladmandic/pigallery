// @ts-nocheck

// css-imports used by esbuild
import '../../assets/bootstrap.css';
import '../../assets/fontawesome.css';
import '../../assets/mapquest.css';
import './iv-viewer.css';
import '../pigallery.css';

import $ from 'jquery';
import * as log from '../shared/log';
import * as marked from '../../assets/marked.esm';
import * as config from '../shared/config';
import * as indexdb from './indexdb';
import * as details from './details';
import * as hash from '../shared/blockhash';
import * as user from '../shared/user';
import * as list from './list';
import * as map from './map';
import * as enumerate from './enumerate';
import * as optionsConfig from './options';
import * as pwa from './pwa-register';

// global variables
window.filtered = [];
const stats = { images: 0, latency: 0, fetch: 0, interactive: 0, complete: 0, load: 0, store: 0, size: 0, speed: 0, initial: 0, remaining: 0, enumerate: 0, ready: 0, cache: 0 };

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
    const t0 = performance.now();
    await fn(arg);
    log.debug(t0, `Timed ${fn.name}`);
  } else {
    fn(arg);
  }
}

// handles all clicks on sidebar menu (folders, locations, classes)
async function folderHandlers() {
  $('.collapsible').off();
  $('.collapsible').children('li').hide();
  $('.collapsible').on('click', async (evt) => {
    $(evt.target).toggleClass('fa-chevron-circle-down fa-chevron-circle-right');
    $(evt.target).parent().parent().find('li')
      .toggle('slow');
  });
  $('.folder').off();
  $('.folder').on('click', async (evt) => {
    const path = $(evt.target).attr('tag');
    if (!path || path.length < 1) return;
    $('.folder').off();
    const type = evt.target.getAttribute('type');
    const t0 = performance.now();
    busy(`Selected ${type}<br>${path}`);
    switch (type) {
      case 'folder':
        log.debug(t0, `Selected path: ${path}`);
        // eslint-disable-next-line no-case-declarations
        const root = window.user && window.user.root ? window.user.root : 'media/';
        if (window.filtered.length < await indexdb.count()) window.filtered = await indexdb.refresh();
        if (path !== (root)) window.filtered = window.filtered.filter((a) => escape(a.image).startsWith(path));
        break;
      case 'location':
        log.debug(t0, `Selected location: ${path}`);
        if (window.filtered.length < await indexdb.count()) window.filtered = await indexdb.refresh();
        if (path !== 'Unknown') window.filtered = window.filtered.filter((a) => (path.startsWith(escape(a.location.near)) || path.startsWith(escape(a.location.country))));
        else window.filtered = window.filtered.filter((a) => (!a.location || !a.location.near));
        break;
      case 'class':
        if (!window.filtered) window.filtered = [];
        window.filtered = window.filtered.filter((a) => a.tags.find((b) => (escape(Object.values(b)[0]).toString().startsWith(path))));
        log.debug(t0, `Selected class: ${path}`);
        break;
      case 'share':
        $('#share').toggle(true);
        // eslint-disable-next-line no-case-declarations
        const share = window.shares.find((a) => a.key === path);
        if (!share.name || !share.key) return;
        $('#share-name').val(share.name);
        $('#share-url').val(`${location.origin}?share=${share.key}`);
        $('#btn-shareadd').removeClass('fa-plus-square').addClass('fa-minus-square');
        window.share = share.key;
        window.filtered = await indexdb.refresh();
        break;
      default:
    }
    await enumerate.enumerate();
    folderHandlers();
    await list.redraw();
    busy();
  });
}

// used by filterresults
function filterWord(word) {
  const skip = ['in', 'a', 'the', 'of', 'with', 'using', 'wearing', 'and', 'at', 'during', 'on', 'having'];
  if (skip.includes(word)) return window.filtered;
  const res = window.filtered.filter((obj) => {
    for (const tag of obj.tags) {
      const str = Object.values(tag) && Object.values(tag)[0] ? Object.values(tag)[0].toString() : '';
      const found = str.startsWith(word);
      if (found) return true;
    }
    return false;
  });
  // log.debug('Debug searching for:', word, 'found:', res);
  return res;
}

// filters images based on search strings
async function filterResults(input) {
  busy(`Searching for<br>${input}`);
  list.clearPrevious();
  const t0 = performance.now();
  const words = [];
  let selective = null;
  for (const word of input.split(' ')) {
    if (!word.includes(':')) words.push(word);
    else if (!selective) selective = word;
  }
  if (selective) {
    const keys = selective.split(':');
    if (keys.length !== 2) window.filtered = [];
    const key = keys[0].toLowerCase();
    const val = parseInt(keys[1]) || keys[1].toLowerCase();
    if (key === 'limit') window.filtered = await indexdb.all('date', false, 1, parseInt(keys[1]));
    else window.filtered = await indexdb.all('date', false, 1, Number.MAX_SAFE_INTEGER, { tag: key, value: val });
  } else {
    window.filtered = await indexdb.refresh();
  }
  if (words.length > 0) {
    if (words.length > 1) {
      const full = filterWord(words.join(' ').toLowerCase());
      if (full.length > 0) window.filtered.push(...full);
    }
    for (const word of words) {
      if (window.filtered.length > 0) window.filtered = filterWord(word.toLowerCase());
    }
  }
  $('#search-result').html(`"${input}"<br>found ${window.filtered.length || 0} images`);
  log.debug(t0, `Searching for "${input}" found ${window.filtered.length || 0} images`);
  enumerate.enumerate().then(folderHandlers).catch(false);
  list.redraw();
  busy();
}

async function deleteImage(image) {
  if (window.user.admin) {
    const res = await fetch(`/api/record/del?rm=${image}`);
    const deleted = await res.json();
    log.div('log', true, 'Record delete:', res.status, deleted);
  } else {
    log.div('log', true, 'Error: must be admin to remove images');
  }
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

// sort by image similarity
async function similarImage(image) {
  busy('Searching for<br>similar images');
  const t0 = performance.now();
  window.options.listDivider = 'similarity';
  const object = window.filtered.find((a) => a.image === decodeURIComponent(image));
  for (const img of window.filtered) img.similarity = 100 - Math.trunc(100 * hash.distance(img.phash, object.phash));
  window.filtered = window.filtered
    .filter((a) => a.similarity > 30)
    .sort((a, b) => b.similarity - a.similarity);
  log.debug(t0, `Similar: ${window.filtered.length} images`);
  list.redraw();
  enumerate.enumerate().then(folderHandlers).catch(false);
  list.scroll();
  busy();
}

function euclideanDistance(embedding1, embedding2, order = 2) {
  if (!embedding1 || !embedding2) return 0;
  if (embedding1?.length === 0 || embedding2?.length === 0) return 0;
  if (embedding1?.length !== embedding2?.length) return 0;
  // general minkowski distance, euclidean distance is limited case where order is 2
  const distance = 4.0 * embedding1
    .map((val, i) => (Math.abs(embedding1[i] - embedding2[i]) ** order)) // distance squared
    .reduce((sum, now) => (sum + now), 0) // sum all distances
    ** (1 / order); // get root of
  const res = Math.round(10 * Math.max(0, 100 - distance)) / 1000;
  return res;
}

async function similarPerson(image) {
  let count = 0;
  busy('Searching for<br>similar people');
  const t0 = performance.now();
  window.options.listDivider = 'similarity';
  const object = window.filtered.find((a) => a.image === decodeURIComponent(image));
  const descriptor = [];
  if (object.person) {
    for (const p of object.person) {
      if (p.descriptor) descriptor.push(new Float32Array(Object.values(p.descriptor)));
    }
  }
  if (!descriptor || descriptor.length === 0) {
    log.debug(t0, 'Similar Search aborted as no person found in image');
    busy();
    return;
  }
  let targets = 0;
  for (const i in window.filtered) {
    const isPerson = (img) => {
      const found = img.detect.filter((a) => a.class === 'person');
      return found && img.person && img.person.length > 0;
    };
    const target = [];
    if (isPerson(window.filtered[i])) {
      for (const p of window.filtered[i].person) {
        if (p.descriptor) target.push(new Float32Array(Object.values(p.descriptor)));
      }
      let best = 1;
      targets += target.length;
      for (const x of descriptor) {
        for (const y of target) {
          count++;
          const distance = euclideanDistance(x, y, 3);
          if (distance < best) best = distance;
        }
      }
      window.filtered[i].similarity = 100 * best;
    } else {
      window.filtered[i].similarity = 100;
    }
  }
  window.filtered = window.filtered
    .filter((a) => (a.person && a.person[0]) && (a.similarity > 50))
    .sort((a, b) => b.similarity - a.similarity);
  log.debug(t0, `Source: ${descriptor.length} Target: ${targets} Compares:${count}`);
  log.debug(t0, `Similar: ${window.filtered.length} persons`);
  list.redraw();
  enumerate.enumerate().then(folderHandlers).catch(false);
  list.scroll();
  busy();
}

async function similarClasses(image) {
  busy('Searching for<br>similar classes');
  const t0 = performance.now();
  window.options.listDivider = 'similarity';
  const object = window.filtered.find((a) => a.image === decodeURIComponent(image));

  const valid = ['classified', 'detected', 'camera', 'conditions', 'zoom', 'near'];
  const tags = object.tags.filter((obj) => valid.includes(Object.keys(obj)[0])).map((a) => Object.values(a)[0]);
  const count = tags.length;
  for (const i in window.filtered) {
    const t = window.filtered[i].tags.filter((obj) => valid.includes(Object.keys(obj)[0])).map((a) => Object.values(a)[0]);
    const found = tags.filter((a) => t.includes(a));
    window.filtered[i].similarity = Math.round(100.0 * found.length / count);
  }
  window.filtered = window.filtered
    .filter((a) => a.similarity > 55)
    .sort((a, b) => b.similarity - a.similarity);
  log.debug(t0, `Similar: ${window.filtered.length} classes`);
  list.redraw();
  enumerate.enumerate().then(folderHandlers).catch(false);
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

  const t0 = performance.now();
  log.debug(t0, `Sorting: ${sort.replace('navlinebutton fad sort fa-', '')}`);
  if (sort.includes('random')) {
    window.filtered = await indexdb.all();
    shuffle(window.filtered);
  }
  list.clearPrevious();
  // sort by
  busy('Sorting images');
  if (sort.includes('alpha-down')) window.filtered = await indexdb.all('name', true, 1, window.options.listItemCount);
  if (sort.includes('alpha-up')) window.filtered = await indexdb.all('name', false, 1, window.options.listItemCount);
  if (sort.includes('numeric-down')) window.filtered = await indexdb.all('date', false, 1, window.options.listItemCount);
  if (sort.includes('numeric-up')) window.filtered = await indexdb.all('date', true, 1, window.options.listItemCount);
  if (sort.includes('amount-down')) window.filtered = await indexdb.all('size', false, 1, window.options.listItemCount);
  if (sort.includes('amount-up')) window.filtered = await indexdb.all('size', true, 1, window.options.listItemCount);
  // if (sort.includes('similarity')) window.filtered = await db.all('similarity', false); // similarity is calculated, not stored in indexdb
  // group by
  if (sort.includes('numeric-down') || sort.includes('numeric-up')) window.options.listDivider = 'month';
  else if (sort.includes('amount-down') || sort.includes('amount-up')) window.options.listDivider = 'size';
  else if (sort.includes('alpha-down') || sort.includes('alpha-up')) window.options.listDivider = 'folder';
  else if (sort.includes('similarity')) window.options.listDivider = 'similarity';
  else window.options.listDivider = '';
  list.redraw();
  $('#splash').toggle(false);
  log.debug(t0, `Cached images: ${window.filtered.length} fetched initial`);
  const t1 = performance.now();
  stats.initial = Math.floor(t1 - t0);
  $('#all').focus();
  busy('Loading remaining<br>images in background');
  if (sort.includes('alpha-down')) window.filtered = window.filtered.concat(await indexdb.all('name', true, window.options.listItemCount + 1));
  if (sort.includes('alpha-up')) window.filtered = window.filtered.concat(await indexdb.all('name', false, window.options.listItemCount + 1));
  if (sort.includes('numeric-down')) window.filtered = window.filtered.concat(await indexdb.all('date', false, window.options.listItemCount + 1));
  if (sort.includes('numeric-up')) window.filtered = window.filtered.concat(await indexdb.all('date', true, window.options.listItemCount + 1));
  if (sort.includes('amount-down')) window.filtered = window.filtered.concat(await indexdb.all('size', false, window.options.listItemCount + 1));
  if (sort.includes('amount-up')) window.filtered = window.filtered.concat(await indexdb.all('size', true, window.options.listItemCount + 1));
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
  // await enumerate.enumerate();
  // folderHandlers();
  enumerate.enumerate().then(folderHandlers).catch(false);
  stats.enumerate = Math.floor(window.performance.now() - t1);
  list.scroll();
  // log.div('log', true, 'Displaying: ', window.filtered.length, ' images');
  busy();
}

// find duplicate images based on pre-computed sha-256 hash
async function findDuplicates() {
  busy('Searching for<br>duplicate images');

  log.div('log', true, 'Analyzing images for similarity ...');
  const t0 = performance.now();
  list.clearPrevious();

  const f = '/dist/index/worker.js';
  const worker = new Worker(f);
  worker.addEventListener('message', (msg) => {
    window.filtered = msg.data;
    const t1 = performance.now();
    log.div('log', true, `Found ${window.filtered.length} similar images in ${Math.round(t1 - t0).toLocaleString()} ms`);
    sortResults('similarity');
    busy(false);
  });
  const all = await indexdb.all();
  worker.postMessage(all);
}

// loads images, displays gallery and enumerates sidebar
async function loadGallery(refresh = false) {
  const chunkSize = 200;
  const cached = await indexdb.count();
  if (window.share) return;
  if (!window.user.user) return;
  $('#progress').text('Requesting');
  if (window.user.user.startsWith('share')) {
    log.div('log', true, 'Application access with share credentials and no direct share');
    return;
  }
  busy('Loading images<br>in background');
  const t0 = performance.now();
  if (!refresh) {
    log.div('log', true, 'Downloading image cache ...');
    await indexdb.reset();
    await indexdb.open();
  }
  const updated = new Date().getTime();
  const since = refresh ? window.options.lastUpdated : 0;
  const first = await fetch(`/api/record/get?&time=${since}&chunksize=${chunkSize}&page=0`);
  if (!first || !first.ok) return;
  const totalSize = parseFloat(first.headers.get('content-TotalSize') || '');
  const pages = parseInt(first.headers.get('content-Pages') || '0');
  const json0 = await first.json();
  let dlSize = JSON.stringify(json0).length;
  indexdb.store(json0);
  const promisesReq = [];
  const promisesData = [];
  let progress = Math.min(100, Math.round(100 * dlSize / totalSize));
  let perf = Math.round(dlSize / (performance.now() - t0));
  $('#progress').html(`Downloading ${progress}%:<br>${dlSize.toLocaleString()} / ${totalSize.toLocaleString()} bytes<br>${perf.toLocaleString()} KB/sec`);
  for (let page = 1; page <= pages; page++) {
    const promise = fetch(`/api/record/get?&time=${since}&chunksize=${chunkSize}&page=${page}`);
    promisesReq.push(promise);
    // eslint-disable-next-line no-loop-func, promise/catch-or-return
    promise.then((result) => {
      const req = result.json();
      promisesData.push(req);
      // eslint-disable-next-line promise/catch-or-return, promise/no-nesting
      req.then(async (json) => {
        dlSize += JSON.stringify(json).length;
        progress = Math.min(100, Math.round(100 * dlSize / totalSize));
        perf = Math.round(dlSize / (performance.now() - t0));
        const t2 = performance.now();
        await indexdb.store(json);
        const t3 = performance.now();
        stats.store += t3 - t2;
        log.debug('Donwloading', `page:${page} progress:${progress}% bytes:${dlSize.toLocaleString()} / ${totalSize.toLocaleString()} perf:${perf.toLocaleString()} KB/sec`);
        if (progress === 100) $('#progress').html(`Creating cache<br>${totalSize.toLocaleString()} bytes`);
        else $('#progress').html(`Downloading ${progress}%:<br>${dlSize.toLocaleString()} / ${totalSize.toLocaleString()} bytes<br>${perf.toLocaleString()} KB/sec`);
        return true;
      });
      return true;
    });
  }
  await Promise.all(promisesReq);
  await Promise.all(promisesData);
  const t1 = performance.now();

  const dt = window.options.lastUpdated === 0 ? 'start' : new Date(window.options.lastUpdated).toLocaleDateString();
  const current = await indexdb.count();
  perf = (current - cached) > 0 ? `performance: ${Math.round(dlSize / (t1 - t0)).toLocaleString()} KB/sec ` : '';
  log.div('log', true, `Download cached: ${cached} updated: ${current - cached} images in ${Math.round(t1 - t0).toLocaleString()} ms ${perf}updated since ${dt}`);
  // window.filtered = await db.all();
  window.options.lastUpdated = updated;
  stats.size = dlSize;
  stats.load = Math.round(t1 - t0);
  stats.store = Math.round(stats.store);
  stats.speed = Math.round(dlSize / (t1 - t0 - stats.store));
  $('#progress').text('Almost done');
  if (!refresh) sortResults(window.options.listSortOrder);
}

// popup on right-click
async function showContextPopup(evt) {
  evt.preventDefault();
}

// resize viewport
function resizeViewport() {
  const viewportScale = Math.min(1, Math.round(100 * window.outerWidth / 800) / 100);
  log.debug('Viewport scale:', viewportScale);
  document.querySelector('meta[name=viewport]').setAttribute('content', `width=device-width, shrink-to-fit=yes; initial-scale=${viewportScale}`);
  $('#main').height(window.innerHeight - ($('#log').height() || 0) - ($('#navbar').height() || 0) - 16);
  if ($('#popup').css('display') !== 'none') details.show();
  const top = $('#optionsview').clientHeight;
  const height = $('body').clientHeight - top;
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
  $('body').css('fontSize', window.options.fontSize);
  $('#folderbar').toggle(window.options.listFolders);
  $('.description').toggle(window.options.listDetails);
  $('#thumbsize')[0].value = window.options.listThumbSize;

  if (elem) {
    elem.toggle('slow');
    $('#btn-close').show();
  } else {
    $('#btn-close').hide();
  }
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
  if (elem && elem[0] !== $('#iframe')[0]) {
    $('#iframe').attr('src', '');
    $('#iframe').hide();
  }
  $(document).on('pagecontainerbeforechange', (evt, data) => {
    if (typeof data.toPage === 'string' && data.options.direction === 'back') {
      data.toPage = location;
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
  $('#sharestitle').on('click', async () => {
    const show = $('#share').is(':visible');
    if (!show) {
      await enumerate.shares();
      await folderHandlers();
    }
    $('#btn-shareadd').removeClass('fa-minus-square').addClass('fa-plus-square');
    $('#share').toggle(!show);
    $('#shares').find('li').toggle(!show);
    $('#share-name').val('');
    $('#share-url').val('');
    $('#share-name').focus();
  });

  $('#btn-shareadd').off();
  $('#btn-shareadd').on('click', () => {
    const t0 = performance.now();
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
      $.post('/api/share/put', share)
        .done((res) => $('#share-url').val(`${location.origin}?share=${res.key}`))
        .fail(() => $('#share-url').val('error creating share'));
      enumerate.shares();
    } else {
      const name = $('#share-name').val();
      const key = $('#share-url').val().split('=')[1];
      log.debug(t0, `Share remove: ${name} ${key}`);
      fetch(`/api/share/del?rm=${key}`).then(enumerate.shares).catch(false);
    }
  });

  $('#btn-sharecopy').off();
  $('#btn-sharecopy').on('click', () => {
    $('#share-url').focus();
    $('#share-url').select();
    document.execCommand('copy');
  });
}

// handle keypresses on main
async function initHotkeys() {
  $('html').on('keydown', () => {
    const top = $('#results').scrollTop() || 0;
    const line = window.options.listThumbSize / 2 + 16;
    const page = ($('#results').height() || 0) - window.options.listThumbSize;
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
      case 220: loadGallery(); break; // key=\; refresh all
      case 222: sortResults(window.options.listSortOrder); break; // key='; remove filters
      case 27: // key=esc; close all
        $('#popup').toggle(false);
        $('#searchbar').toggle(false);
        $('#optionslist').toggle(false);
        $('#optionsview').toggle(false);
        $('#popup').toggle(false);
        details.slideShow(false);
        break;
      default: // log.div('log', true, 'Unhandled keydown event', event.keyCode);
    }
  });
}

function initSidebarHandlers() {
  $('#resettitle').on('click', () => {
    window.share = (location.search && location.search.startsWith('?share=')) ? location.search.split('=')[1] : null;
    sortResults(window.options.listSortOrder);
  });
  $('#folderstitle').on('click', () => $('#folders').toggle('slow'));
  $('#locationstitle').on('click', () => $('#locations').toggle('slow'));
  $('#classestitle').on('click', () => $('#classes').toggle('slow'));
  $('#folders').toggle(false);
  $('#locations').toggle(false);
  $('#classes').toggle(false);
  $(window).on('resize', () => resizeViewport());
}

// initializes all mouse handlers for main menu in list view
async function initMenuHandlers() {
  log.debug('Navigation enabled');

  window.passive = false;
  // navbar user
  $('#btn-user').on('click', () => {
    showNavbar($('#userbar'));
  });

  // navbar close
  $('#btn-close').on('click', () => {
    showNavbar();
  });

  // navline user input
  $('#imagenum').on('keyup', () => {
    if (event.keyCode === 13) {
      $('#btn-load').click();
      showNavbar();
    }
  });

  // navline user load
  $('#btn-load').on('click', () => {
    showNavbar();
    loadGallery(window.options.listLimit);
  });

  // navline process images
  $('#btn-update').on('click', () => {
    showNavbar($('#iframe'));
    $('#iframe').attr('src', '/process');
    // window.open('/process', '_blank');
  });

  // navline user docs
  $('#btn-doc').on('click', async () => {
    await showNavbar($('#docs'));
    if ($('#docs').css('display') !== 'none') {
      const res = await fetch('/README.md');
      const md = await res.text();
      if (md) $('#docs').html(marked.default(md));
    }
  });

  // navline user changelog
  $('#btn-changelog').on('click', async () => {
    await showNavbar($('#docs'));
    if ($('#docs').css('display') !== 'none') {
      const res = await fetch('/CHANGELOG.md');
      const md = await res.text();
      if (md) $('#docs').html(marked.default(md));
    }
  });

  // navline user options
  $('#btn-options').on('click', async () => {
    await showNavbar($('#docs'));
    if ($('#docs').css('display') !== 'none') optionsConfig.show();
  });

  // navline global params
  $('#btn-params').on('click', async () => {
    await showNavbar($('#docs'));
    if ($('#docs').css('display') !== 'none') optionsConfig.params();
  });

  // navline user logout
  $('#btn-logout').on('click', async () => {
    log.debug('Logout');
    await showNavbar();
    $.post('/api/user/auth');
    let loc = location.href;
    if (loc.includes('share=')) loc = '/auth';
    if ($('#btn-user').hasClass('fa-user-slash')) loc = '/auth';
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    document.cookie = 'connect.sid=null; expires=Thu, 1 Jan 2000 12:00:00 UTC; path=/';
    location.replace(loc);
  });

  // navbar search
  $('#btn-search').on('click', async () => {
    await showNavbar($('#searchbar'));
    $('#btn-search').toggleClass('fa-search fa-search-location');
    $('#search-input').focus();
  });

  // navbar map
  $('#btn-map').on('click', () => {
    $('#btn-map').toggleClass('fa-map fa-map-marked');
    map.show($('btn-map').hasClass('fa-map-marked'));
  });

  // navline search input
  $('#search-input').on('keyup', () => {
    event.preventDefault();
    if (event.keyCode === 191) $('#search-input')[0].value = ''; // reset on key=/
    if (event.keyCode === 13) filterResults($('#search-input')[0].value);
  });

  // navline search ok
  $('#btn-searchnow').on('click', () => filterResults($('#search-input')[0].value));

  // navline search cancel
  $('#btn-resetsearch').on('click', () => {
    $('#search-input')[0].value = '';
    sortResults(window.options.listSortOrder);
  });

  // navbar list
  $('#btn-list').on('click', async () => {
    await showNavbar($('#optionslist'));
  });

  // navline list sidebar
  $('#btn-folder').on('click', () => {
    $('#folderbar').toggle('slow');
    $('#btn-folder').toggleClass('fa-folder fa-folder-open');
    window.options.listFolders = !window.options.listFolders;
  });

  // navline list descriptions
  $('#btn-desc').on('click', () => {
    window.options.listDetails = !window.options.listDetails;
    $('.description').toggle('slow');
    $('#btn-desc').toggleClass('fa-comment fa-comment-slash');
  });

  $('#btn-title').on('click', () => {
    window.options.listTitle = !window.options.listTitle;
    $('.divider').toggle('slow');
    $('#btn-title').toggleClass('fa-comment-dots fa-comment-slash');
  });

  // navline list duplicates
  $('#btn-duplicates').on('click', () => {
    findDuplicates();
  });

  // navline list sort
  $('.sort').on('click', (evt) => {
    window.options.listSortOrder = evt.target.className;
    sortResults(evt.target.className);
  });

  // navline list thumbnail size
  $('#thumbsize').on('input', () => list.resize());

  // navbar slideshow
  $('#btn-slide').on('click', () => {
    details.show(window.filtered[0].image);
    details.slideshow(true);
  });

  // navbar livevideo
  $('#btn-video').on('click', async () => {
    showNavbar($('#iframe'));
    $('#iframe').attr('src', '/video');
  });

  // navbar images number
  $('#btn-number').on('click', async () => {
    const t0 = performance.now();
    sortResults(window.options.listSortOrder);
    log.debug(t0, 'Reset filtered results');
  });

  $('#btn-number').on('mouseover', async () => { /**/ });
}

async function hashChange(evt) {
  const t0 = performance.now();
  log.debug(t0, `URL Hash change: ${evt.newURL}`);
  const target = parseInt(evt.newURL.substr(evt.newURL.indexOf('#') + 1));
  const source = parseInt(evt.oldURL.substr(evt.oldURL.indexOf('#') + 1));
  if (source > target) {
    const top = parseInt($('#all').scrollTop()) === 0;
    const all = await indexdb.count() - window.filtered.length;
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
  $(document).on('mousemove', (event) => {
    const mouseXpercentage = Math.round(event.pageX / $(window).width() * 100);
    const mouseYpercentage = Math.round(event.pageY / $(window).height() * 100);
    $('body').css('background', `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, ${window.theme.gradient} 0, ${window.theme.background} 100%, ${window.theme.background} 100%)`);
    if ($('#popup').css('display') !== 'none') {
      if (window.dominant) $('#popup').css('background', `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, ${window.dominant[1]} 0, ${window.dominant[0]} 100%, ${window.dominant[0]} 100%)`);
      else $('#popup').css('background', `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, ${window.theme.gradient} 0, ${window.theme.background} 100%, ${window.theme.background} 100%)`);
    }
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
    // log.debug('Performance:', perf);
  } else if (window.performance) {
    log.debug('Performance:', performance.timing);
  }
}

async function installable(evt) {
  evt.preventDefault();
  const deferredPrompt = evt;
  // show only if not yet installed
  if (!matchMedia('(display-mode: standalone)').matches) document.getElementById('install').style.display = 'block';
  document.getElementById('install').addEventListener('click', () => {
    document.getElementById('install').style.display = 'none';
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((res) => log.debug('Application Install: ', res.outcome)).catch(false);
  });
}

async function main() {
  const t0 = performance.now();
  log.debug('Starting PiGallery');
  window.addEventListener('beforeinstallprompt', (evt) => installable(evt));
  if (config.default.registerPWA) await pwa.register('/dist/index/pwa-serviceworker.js');
  window.share = (location.search && location.search.startsWith('?share=')) ? location.search.split('=')[1] : null;
  await config.setTheme();
  await animate();
  await user.get();
  await showNavbar();
  googleAnalytics();
  details.handlers();
  initHotkeys();
  await indexdb.open();
  window.details = details;
  window.similarImage = similarImage;
  window.similarPerson = similarPerson;
  window.similarClasses = similarClasses;
  window.deleteImage = deleteImage;
  if (window.share) log.debug(`Direct link to share: ${window.share}`);
  $('body').on('contextmenu', (evt) => showContextPopup(evt));
  $('body').css('display', 'block');
  $('.collapsible').parent().parent().find('li')
    .toggle(false);
  await resizeViewport();
  await perfDetails();
  await list.resize();

  // init main menu
  await initMenuHandlers();
  // load images
  await sortResults(window.options.listSortOrder);
  // init sidebar only after images are loaded
  await initSharesHandler();
  await initSidebarHandlers();

  stats.images = window.filtered.length;
  stats.ready = Math.floor(window.performance.now() - t0);
  stats.pageMode = parent.location.href === location.href ? 'Standalone' : 'Frame';
  stats.appMode = matchMedia('(display-mode: standalone)').matches ? 'Standalone' : 'Browser';

  const cache = caches ? await caches.open('pigallery') : null;
  stats.cache = cache ? (await cache.matchAll()).length : 0;
  await config.done();
  log.server('Load stats:', stats);
  log.div('log', true, 'Ready:', stats.ready, 'ms');
}

// window.onpopstate = (evt) => log.debug(`URL Pop state: ${evt.target.location.href}`);
window.onhashchange = (evt) => hashChange(evt);
window.onload = main;
