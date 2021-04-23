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
import * as db from './indexdb';
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
window.$ = $;
const stats = { images: 0, latency: 0, fetch: 0, interactive: 0, complete: 0, load: 0, store: 0, size: 0, speed: 0, initial: 0, remaining: 0, enumerate: 0, ready: 0, cache: 0, pageMode: '', appMode: '' };

async function busy(text: string | null = null) {
  // if (text && $('.busy').is(':visible')) return true;
  if (text) {
    $('.busy').width(($('.folderbar').width() as number).toString());
    $('#busy-text').html(text || '');
    $('.busy').show();
  } else {
    $('.busy').hide();
  }
  return false;
}

// handles all clicks on sidebar menu (folders, locations, classes)
async function folderHandlers() {
  busy();
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
        const root = user.user && user.user.root ? user.user.root : 'media/';
        if (window.filtered.length < await db.count()) window.filtered = await db.refresh();
        if (path !== (root)) window.filtered = window.filtered.filter((a) => escape(a.image).startsWith(path));
        break;
      case 'location':
        log.debug(t0, `Selected location: ${path}`);
        if (window.filtered.length < await db.count()) window.filtered = await db.refresh();
        if (path !== 'Unknown') window.filtered = window.filtered.filter((a) => (path.startsWith(escape(a.location.near)) || path.startsWith(escape(a.location.country))));
        else window.filtered = window.filtered.filter((a) => (!a.location || !a.location.near));
        break;
      case 'class':
        if (!window.filtered) window.filtered = [];
        window.filtered = window.filtered.filter((a) => a.tags.find((b) => (escape(Object.values(b)[0] as string).startsWith(path))));
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
        window.filtered = await db.refresh();
        break;
      default:
    }
    await enumerate.enumerate(window.filtered);
    folderHandlers();
    list.redraw(window.filtered);
    busy();
  });
}

// used by filterresults
function filterWord(word) {
  const skip = ['in', 'a', 'the', 'of', 'with', 'using', 'wearing', 'and', 'at', 'during', 'on', 'having'];
  if (skip.includes(word)) return window.filtered;
  const res = window.filtered.filter((obj) => {
    for (const tag of obj.tags) {
      const str = Object.values(tag) && Object.values(tag)[0] ? Object.values(tag)[0] as string : '';
      const found = str.startsWith(word);
      if (found) return true;
    }
    return false;
  });
  // log.debug('Searching for:', word, 'found:', res.length);
  return res;
}

// filters images based on search strings
async function filterResults(input) {
  busy(`Searching for<br>${input}`);
  const t0 = performance.now();
  const words:Array<string> = [];
  let selective: string | null = null;
  for (const word of input.split(' ')) {
    if (!word.includes(':')) words.push(word);
    else if (!selective) selective = word;
  }
  if (selective) {
    const keys = selective.split(':');
    if (keys.length !== 2) window.filtered = [];
    const key = keys[0].toLowerCase();
    const val = parseInt(keys[1]) || keys[1].toLowerCase();
    if (key === 'limit') window.filtered = await db.all('date', false, 1, parseInt(keys[1]), null, window.share);
    else window.filtered = await db.all('date', false, 1, Number.MAX_SAFE_INTEGER, { tag: key, value: val }, window.share);
  } else if (window.filtered.length === 0) {
    window.filtered = await db.refresh();
  }
  let full = [];
  const all:Array<any> = [];
  config.options.listDivider = 'search';
  list.redraw(full, 'search results', true);
  if (words.length > 0) {
    // full match
    const term = words.join(' ').toLowerCase();
    full = filterWord(term);
    if (full.length > 0) all.push(...full);
    list.clearPrevious();
    await list.redraw(full, `exact match: ${term}`, false);
    // match for each word
    if (words.length > 1) {
      for (const word of words) {
        const partials = filterWord(word.toLowerCase());
        const res:Array<any> = [];
        for (const partial of partials) {
          const found = all.filter((a) => a.image === partial.image);
          if (!found || found.length === 0) res.push(partial);
        }
        all.push(...res);
        list.clearPrevious();
        await list.redraw(res, `partial match: ${word}`, false);
      }
    }
  }
  window.filtered = all;
  $('#search-result').html(`"${input}"<br>exact:${full.length} total:${all.length}`);
  log.debug(t0, `Searching for "${input}" exact:${full.length} partial:${all.length - full.length} total:${all.length} images`);
  enumerate.enumerate(window.filtered).then(folderHandlers).catch((err) => err);
  busy();
}

async function deleteImage(image) {
  if (user.user.admin) {
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
  config.options.listDivider = 'similarity';
  const object = window.filtered.find((a) => a.image === decodeURIComponent(image));
  for (const img of window.filtered) img.similarity = 100 - hash.distance(img.phash, object.phash);
  window.filtered = window.filtered
    .filter((a) => a.similarity > 70)
    .sort((a, b) => b.similarity - a.similarity);
  log.debug(t0, `Similar: ${window.filtered.length} images`);
  list.redraw(window.filtered);
  enumerate.enumerate(window.filtered).then(folderHandlers).catch((err) => err);
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
  config.options.listDivider = 'similarity';
  const object = window.filtered.find((a) => a.image === decodeURIComponent(image));
  const descriptor:Float32Array[] = [];
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
    const target:Float32Array[] = [];
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
  list.redraw(window.filtered);
  enumerate.enumerate(window.filtered).then(folderHandlers).catch((err) => err);
  busy();
}

async function similarClasses(image) {
  busy('Searching for<br>similar classes');
  const t0 = performance.now();
  config.options.listDivider = 'similarity';
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
  list.redraw(window.filtered);
  enumerate.enumerate(window.filtered).then(folderHandlers).catch((err) => err);
  busy();
}

// sorts images based on given sort order
let loadTried = false;
async function sortResults(sort) {
  $('#optionslist').toggle(false);
  if (!user.user.user) return;

  // refresh records
  // eslint-disable-next-line no-use-before-define
  await loadGallery(true);

  const t0 = performance.now();
  log.debug(t0, `Sorting: ${sort.replace('navlinebutton fad sort fa-', '')}`);
  if (sort.includes('random')) shuffle(window.filtered);
  list.clearPrevious();
  // sort by
  busy('Sorting images');
  if (sort.includes('alpha-down')) window.filtered = await db.all('name', true, 1, config.options.listItemCount, null, window.share);
  if (sort.includes('alpha-up')) window.filtered = await db.all('name', false, 1, config.options.listItemCount, null, window.share);
  if (sort.includes('numeric-down')) window.filtered = await db.all('date', false, 1, config.options.listItemCount, null, window.share);
  if (sort.includes('numeric-up')) window.filtered = await db.all('date', true, 1, config.options.listItemCount, null, window.share);
  if (sort.includes('amount-down')) window.filtered = await db.all('size', false, 1, config.options.listItemCount, null, window.share);
  if (sort.includes('amount-up')) window.filtered = await db.all('size', true, 1, config.options.listItemCount, null, window.share);
  // if (sort.includes('similarity')) window.filtered = await db.all('similarity', false); // similarity is calculated, not stored in indexdb
  // group by
  if (sort.includes('numeric-down') || sort.includes('numeric-up')) config.options.listDivider = 'month';
  else if (sort.includes('amount-down') || sort.includes('amount-up')) config.options.listDivider = 'size';
  else if (sort.includes('alpha-down') || sort.includes('alpha-up')) config.options.listDivider = 'folder';
  else if (sort.includes('similarity')) config.options.listDivider = 'similarity';
  else config.options.listDivider = '';
  list.redraw(window.filtered);
  $('#splash').toggle(false);
  log.debug(t0, `Cached images: ${window.filtered.length} fetched initial`);
  const t1 = performance.now();
  stats.initial = Math.floor(t1 - t0);
  $('#all').focus();
  busy('Loading remaining<br>images in background');
  if (sort.includes('alpha-down')) window.filtered = window.filtered.concat(await db.all('name', true, config.options.listItemCount + 1, Number.MAX_SAFE_INTEGER, null, window.share));
  if (sort.includes('alpha-up')) window.filtered = window.filtered.concat(await db.all('name', false, config.options.listItemCount + 1, Number.MAX_SAFE_INTEGER, null, window.share));
  if (sort.includes('numeric-down')) window.filtered = window.filtered.concat(await db.all('date', false, config.options.listItemCount + 1, Number.MAX_SAFE_INTEGER, null, window.share));
  if (sort.includes('numeric-up')) window.filtered = window.filtered.concat(await db.all('date', true, config.options.listItemCount + 1, Number.MAX_SAFE_INTEGER, null, window.share));
  if (sort.includes('amount-down')) window.filtered = window.filtered.concat(await db.all('size', false, config.options.listItemCount + 1, Number.MAX_SAFE_INTEGER, null, window.share));
  if (sort.includes('amount-up')) window.filtered = window.filtered.concat(await db.all('size', true, config.options.listItemCount + 1, Number.MAX_SAFE_INTEGER, null, window.share));
  log.debug(t1, `Cached images: ${window.filtered.length} fetched remaining`);
  stats.remaining = Math.floor(window.performance.now() - t1);
  // if (window.filtered.length > 0) log.div('log', true, `Loaded ${window.filtered.length} images from cache`);
  if (window.filtered.length === 0) log.div('log', true, 'Image cache empty');
  if (!loadTried && window.filtered.length === 0) {
    loadTried = true;
    // eslint-disable-next-line no-use-before-define
    await loadGallery(false);
  }
  busy('Enumerating images');
  enumerate.enumerate(window.filtered).then(folderHandlers).catch((err) => err);
  stats.enumerate = Math.floor(window.performance.now() - t1);
  // log.div('log', true, 'Displaying: ', window.filtered.length, ' images');
  list.scroll(window.filtered, null); // just updates images list for future scroll events
  busy();
}

// find duplicate images based on pre-computed sha-256 hash
async function findDuplicates() {
  busy('Searching for<br>duplicate images');

  log.div('log', true, `Analyzing ${window.filtered.length} images for similarity ...`);
  const t0 = performance.now();
  list.clearPrevious();

  const f = '/dist/index/worker.js';
  const worker = new Worker(f);
  worker.addEventListener('message', (msg) => {
    window.filtered = msg.data;
    const t1 = performance.now();
    log.div('log', true, `Found ${window.filtered.length} similar images in ${Math.round(t1 - t0).toLocaleString()} ms`);
    sortResults('similarity');
    busy();
  });
  // const all = await db.all();
  worker.postMessage(window.filtered);
}

// loads images, displays gallery and enumerates sidebar
async function loadGallery(refresh = false) {
  const chunkSize = 200;
  const cached = await db.count();
  if (window.share) return;
  if (!user.user.user) return;
  $('#progress').text('Requesting');
  if (user.user.user.startsWith('share')) {
    log.div('log', true, 'Application access with share credentials and no direct share');
    return;
  }
  const t0 = performance.now();
  if (!refresh) {
    busy('Resetting database');
    log.div('log', true, 'Downloading image cache ...');
    await db.reset();
    if (!window.share) await db.open();
  }
  busy('Loading images<br>in background');
  const updated = new Date().getTime();
  const since = refresh ? config.options.lastUpdated : 0;
  let first;
  try {
    first = await fetch(`/api/record/get?&time=${since}&chunksize=${chunkSize}&page=0`);
  } catch (err) {
    log.debug('Error /api/record/get:', err);
  }
  let totalSize = 0;
  let totalImages = 0;
  let pages = 0;
  let dlSize = 0;
  if (first && first.ok) {
    totalSize = parseFloat(first.headers.get('content-TotalSize') || '');
    totalImages = parseFloat(first.headers.get('content-TotalImages') || '');
    pages = parseInt(first.headers.get('content-Pages') || '0');
    const json0 = await first.json();
    dlSize = JSON.stringify(json0).length;
    if (json0 && json0.length > 0) db.store(json0);
    if (totalImages > 0) enumerate.refresh();
  }
  let perf = 0;
  let images = 0;
  if (pages > 0) {
    const promisesReq:Array<any> = [];
    const promisesData:Array<any> = [];
    let progress = Math.min(100, Math.round(100 * dlSize / totalSize));
    perf = Math.round(dlSize / (performance.now() - t0));
    $('#progress').html(`Downloading ${progress}%:<br>${images} / ${totalImages} images<br>${dlSize.toLocaleString()} / ${totalSize.toLocaleString()} bytes<br>${perf.toLocaleString()} KB/sec`);
    for (let page = 1; page <= pages; page++) {
      const promise = fetch(`/api/record/get?&time=${since}&chunksize=${chunkSize}&page=${page}`);
      promisesReq.push(promise);
      // eslint-disable-next-line no-loop-func, promise/catch-or-return
      promise.then((result) => {
        totalSize = parseFloat(result.headers.get('content-TotalSize') || '');
        totalImages = parseFloat(result.headers.get('content-TotalImages') || '');
        const req = result.json();
        promisesData.push(req);
        // eslint-disable-next-line promise/catch-or-return, promise/no-nesting
        req.then(async (json) => {
          dlSize += JSON.stringify(json).length;
          progress = Math.min(100, Math.round(100 * dlSize / totalSize));
          perf = Math.round(dlSize / (performance.now() - t0));
          const t2 = performance.now();
          images += json.length;
          await db.store(json);
          const t3 = performance.now();
          stats.store += t3 - t2;
          log.debug('Donwloading', `page:${page} progress:${progress}% images:${images} / ${totalImages} bytes:${dlSize.toLocaleString()} / ${totalSize.toLocaleString()} perf:${perf.toLocaleString()} KB/sec`);
          if (progress >= 98) $('#progress').html(`Creating cache<br>images:${totalImages}<br>${totalSize.toLocaleString()} bytes`);
          else $('#progress').html(`Downloading ${progress}%:<br>${images} / ${totalImages} images<br>${dlSize.toLocaleString()} / ${totalSize.toLocaleString()} bytes<br>${perf.toLocaleString()} KB/sec`);
          return true;
        });
        return true;
      });
    }
    await Promise.all(promisesReq);
    await Promise.all(promisesData);
  }
  const t1 = performance.now();

  const dt = config.options.lastUpdated === 0 ? 'start' : new Date(config.options.lastUpdated).toLocaleDateString();
  const current = await db.count();
  const dl = (current - cached) > 0 ? `performance: ${Math.round(dlSize / (t1 - t0)).toLocaleString()} KB/sec ` : '';
  log.div('log', true, `Download cached: ${cached} updated: ${current - cached} images in ${Math.round(t1 - t0).toLocaleString()} ms ${dl}updated since ${dt}`);
  // window.filtered = await db.all();
  config.options.lastUpdated = updated;
  stats.size = dlSize;
  stats.load = Math.round(t1 - t0);
  stats.store = Math.round(stats.store);
  stats.speed = Math.round(dlSize / (t1 - t0 - stats.store));
  $('#progress').text('Almost done');
  // if (!refresh) sortResults(config.options.listSortOrder);
}

// popup on right-click
async function showContextPopup(evt) {
  evt.preventDefault();
}

// resize viewport
function resizeViewport() {
  const viewportScale = Math.min(1, Math.round(100 * window.outerWidth / 800) / 100);
  (document.querySelector('meta[name=viewport]') as HTMLElement).setAttribute('content', `width=device-width, shrink-to-fit=yes, initial-scale=${viewportScale}`);

  if ($('#popup').css('display') !== 'none') details.show(window.filtered);

  const top = $('#navbar').height() || 0;
  const height = window.innerHeight - top;
  $('#popup').css('top', top);
  $('#popup').height(height);
  $('#docs').css('top', top);
  $('#docs').height(height);
  $('#video').css('top', top);
  $('#video').height(height);
  $('#process').css('top', top);
  $('#process').height(height);

  const fontSize = Math.trunc(10 * (1 - viewportScale)) + parseInt(config.options.fontSize);
  $(':root').css('fontSize', `${fontSize}px`);

  ($('#thumbsize')[0] as HTMLDataElement).value = `${config.options.listThumbSize}`;

  (document.getElementById('main') as HTMLElement).style.height = `${window.innerHeight - (document.getElementById('log') as HTMLElement).offsetHeight - (document.getElementById('navbar') as HTMLElement).offsetHeight}px`;
}

// show/hide navigation bar elements
function showNavbar(elem: any | null = null) {
  $('#folderbar').toggle(config.options.listFolders);
  $('.description').toggle(config.options.listDetails);

  $('#btn-close').hide();
  if (elem) {
    elem.toggle('slow');
    if ($('#iframe').is(':visible') || $('#docs').is(':visible')) $('#btn-close').show();
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
}

async function initSharesHandler() {
  if (!user.user.admin) {
    $('#sharestitle').toggle(false);
    return;
  }
  $('#sharestitle').off();
  $('#sharestitle').on('click', async () => {
    const show = $('#share').is(':visible');
    if (!show) {
      enumerate.shares().then((res) => window.shares = res);
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
      const share:any = {};
      share.creator = user.user.user;
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
      enumerate.shares().then((res) => window.shares = res);
    } else {
      const name = $('#share-name').val();
      const key = ($('#share-url')?.val() as string).split('=')[1];
      log.debug(t0, `Share remove: ${name} ${key}`);
      fetch(`/api/share/del?rm=${key}`)
        .then(() => {
          enumerate.shares().then((res) => window.shares = res);
        })
        .catch((err) => err);
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
    const line = config.options.listThumbSize / 2 + 16;
    const page = ($('#results').height() || 0) - config.options.listThumbSize;
    const bottom = $('#results').prop('scrollHeight');
    $('#results').stop();
    switch ((event as any).keyCode) {
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
      case 220: loadGallery(true); break; // key=\; refresh all
      case 222: sortResults(config.options.listSortOrder); break; // key='; remove filters
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
    sortResults(config.options.listSortOrder);
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
  // log.debug('Navigation enabled');

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
    if ((event as any).keyCode === 13) {
      $('#btn-load').click();
      showNavbar();
    }
  });

  // navline user load
  $('#btn-load').on('click', () => {
    showNavbar();
    loadGallery(false);
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
    const loc = '/auth';
    document.cookie = 'connect.sid=null; expires=Thu, 1 Jan 2000 12:00:00 UTC; path=/';
    location.replace(loc);
  });

  // navbar search
  $('#btn-search').on('click', async () => {
    await showNavbar($('#searchbar'));
    $('#search-input').focus();
  });

  // navbar map
  $('#btn-map').on('click', () => {
    map.show(window.filtered, $('btn-map').hasClass('fa-map-marked'));
  });

  // navline search input
  $('#search-input').on('keyup', () => {
    (event as any).preventDefault();
    if ((event as any).keyCode === 191) ($('#search-input')[0] as HTMLDataElement).value = ''; // reset on key=/
    if ((event as any).keyCode === 13) {
      $('#searchbar').hide();
      filterResults(($('#search-input')[0] as HTMLDataElement).value);
    }
  });

  // navline search ok
  $('#btn-searchnow').on('click', () => {
    $('#searchbar').hide();
    filterResults(($('#search-input')[0] as HTMLDataElement).value);
  });

  // navline search cancel
  $('#btn-resetsearch').on('click', () => {
    $('#searchbar').hide();
    ($('#search-input')[0] as HTMLDataElement).value = '';
    sortResults(config.options.listSortOrder);
  });

  // navbar list
  $('#btn-list').on('click', async () => {
    await showNavbar($('#optionslist'));
    const div = document.getElementById('description-label');
    if (div) div.innerHTML = config.options.listDetails ? 'hide description' : 'show description';
  });

  // navline list sidebar
  $('#btn-folder').on('click', () => {
    $('#folderbar').toggle('slow');
    config.options.listFolders = !config.options.listFolders;
  });

  // navline list descriptions
  $('#btn-desc').on('click', () => {
    config.options.listDetails = !config.options.listDetails;
    const div = document.getElementById('description-label');
    if (div) div.innerHTML = config.options.listDetails ? 'hide description' : 'show description';
    $('.description').toggle('slow');
  });

  $('#btn-title').on('click', () => {
    config.options.listTitle = !config.options.listTitle;
    $('.divider').toggle('slow');
  });

  // navline list duplicates
  $('#btn-duplicates').on('click', () => {
    findDuplicates();
  });

  // navline list sort
  $('.sort').on('click', (evt) => {
    config.options.listSortOrder = evt.target.className;
    sortResults(evt.target.className);
  });

  // navline list thumbnail size
  $('#thumbsize').on('input', () => list.resize());

  // navbar slideshow
  $('#btn-slide').on('click', () => {
    details.show(window.filtered[0].image);
    details.slideShow(true);
  });

  // navbar livevideo
  $('#btn-video').on('click', async () => {
    showNavbar($('#iframe'));
    $('#iframe').attr('src', '/video');
  });

  // navbar images number
  $('#btn-number').on('click', async () => {
    const t0 = performance.now();
    sortResults(config.options.listSortOrder);
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
    const top = $('#results').scrollTop() === 0;
    const all = await db.count() - window.filtered.length;
    if (top && all === 0) {
      log.debug(t0, 'Exiting ...');
    } else {
      sortResults(config.options.listSortOrder);
      log.debug(t0, 'Reset image selection');
    }
  }
}

async function animate() {
  $('body').css('background', `radial-gradient(at 50% 100%, ${config.theme.gradient} 0, ${config.theme.background} 100%, ${config.theme.background} 100%)`);
  $(document).on('mousemove', (event) => {
    const mouseXpercentage = Math.round(event.pageX / ($(window).width() || 0) * 100);
    const mouseYpercentage = Math.round(event.pageY / ($(window).height() || 0) * 100);
    $('body').css('background', `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, ${config.theme.gradient} 0, ${config.theme.background} 100%, ${config.theme.background} 100%)`);
  });
}

async function perfDetails() {
  if (window.PerformanceNavigationTiming) {
    const perf = performance.getEntriesByType('navigation')[0];
    stats.latency = Math.round(perf['fetchStart']);
    stats.fetch = Math.round(perf['responseEnd']);
    stats.interactive = Math.round(perf['domInteractive']);
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
  const div = document.getElementById('install');
  if (!div) return;
  if (!matchMedia('(display-mode: standalone)').matches) div.style.display = 'block';
  div.addEventListener('click', () => {
    div.style.display = 'none';
    deferredPrompt.prompt();
    deferredPrompt.userChoice
      .then((res) => log.debug('application install: ', res.outcome))
      .catch((err) => log.debug('application install error: ', err));
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
  await user.get(window.share);
  await showNavbar();
  details.handlers();
  initHotkeys();
  if (!window.share) await db.open();

  // define global functions called from html
  window['details'] = details;
  window['similarImage'] = similarImage;
  window['similarPerson'] = similarPerson;
  window['similarClasses'] = similarClasses;
  window['deleteImage'] = deleteImage;

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
  await sortResults(config.options.listSortOrder);
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
