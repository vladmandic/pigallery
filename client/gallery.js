/* global Popper */

// const oboe = require('oboe');
const moment = require('moment');
const marked = require('marked');
const faceapi = require('face-api.js');
const log = require('./log.js');
const config = require('./config.js').default;
const details = require('./details.js');
const map = require('./map.js');
const db = require('./indexdb.js');
const hash = require('./blockhash.js');
const pwa = require('./pwa-register.js');

// global variables
window.filtered = [];

function busy(working) {
  $('body').css('cursor', working ? 'wait' : 'default');
  $('main').css('cursor', working ? 'wait' : 'default');
  $('#btn-number').css('color', working ? 'lightcoral' : 'lightyellow');
  $('#btn-number').toggleClass('fa-images fa-clock');
  $('#number').css('color', working ? 'gray' : 'lightyellow');
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

// adds dividiers to list view based on sort order
let previous;
function addDividers(object) {
  let divider;
  if (window.options.listDivider === 'simmilarity' && object.simmilarity) {
    const curr = `${100 - object.simmilarity}%`;
    const prev = previous ? `${100 - previous.simmilarity}%` : 'none';
    if (curr !== prev) divider = curr;
  }
  if (window.options.listDivider === 'month') {
    const curr = (object && object.exif.created && (object.exif.created !== 0)) ? moment(object.exif.created).format(window.options.dateDivider) : 'Date unknown';
    const prev = (previous && previous.exif.created && (previous.exif.created !== 0)) ? moment(previous.exif.created).format(window.options.dateDivider) : 'Date unknown';
    if (curr !== prev) divider = curr;
  }
  if (window.options.listDivider === 'size') {
    const curr = Math.round(object.pixels / 1000 / 1000);
    const prev = Math.round((previous ? previous.pixels : 1) / 1000 / 1000);
    if (curr !== prev) divider = curr;
  }
  if (window.options.listDivider === 'folder') {
    const curr = object.image.substr(0, object.image.lastIndexOf('/'));
    const prev = previous ? previous.image.substr(0, previous.image.lastIndexOf('/')) : 'none';
    if (curr !== prev) divider = curr;
  }
  let div;
  if (divider) {
    div = document.createElement('div');
    div.className = 'row divider';
    div.innerText = divider;
  }
  return div;
}

// print results element with thumbnail and description for a given object
function printResult(object) {
  previous = object;

  let classified = 'Classified';
  for (const item of details.combine(object.classify)) {
    classified += ` | ${item.score}% ${item.name}`;
  }

  let detected = 'Detected';
  let personCount = 0;
  for (const item of details.combine(object.detect)) {
    if (item.name !== 'person') detected += ` | ${item.score}% ${item.name}`;
    else personCount++;
  }
  personCount = Math.max(personCount, object.person ? object.person.length : 0);
  if (personCount === 1) detected += ' | person';
  else if (personCount > 1) detected += ` | ${personCount} persons`;

  let person = '';
  if (object.person && object.person[0]) {
    person = 'People';
    for (const i of object.person) {
      person += ` | ${i.gender} ${i.age.toFixed(0)}`;
    }
  }

  let location = '';
  if (object.location && object.location.city) {
    location = `Location | ${object.location.city}, ${object.location.state} ${object.location.country} (near ${object.location.near})`;
  }

  const camera = (object.exif && object.exif.make) ? `Camera | ${object.exif.make || ''} ${object.exif.model || ''} ${object.exif.lens || ''}` : '';
  const settings = (object.exif && object.exif.iso) ? `Settings | ${object.exif.fov ? object.exif.fov + 'mm' : ''} ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec` : '';
  const timestamp = object.exif.created ? moment(object.exif.created).format(window.options.dateShort) : 'Date unknown';
  const root = window.user && window.user.root ? window.user.root : 'media/';

  const thumb = document.createElement('div');
  thumb.className = 'col thumbnail';
  thumb.id = object.id;
  thumb.innerHTML = `
    <img class="thumbnail" id="thumb-${object.id}" img="${object.image}" src="${object.thumbnail}" onclick="details.show('${escape(object.image)}');"
    align="middle" width=${window.options.listThumbSize}px height=${window.options.listThumbSize}px>
    <p class="btn-tiny fa fa-play-circle" onclick="details.show('${escape(object.image)}');" title="View image details" style="right: 84px"></p>
    <a class="btn-tiny fa fa-arrow-alt-circle-down" href="${object.image}" download title="Download image" style="right: 56px"></a>
    <p class="btn-tiny fa fa-adjust" onclick="simmilarImage('${escape(object.image)}');" title="Find simmilar images" style="right: 28px"></p>
    <p class="btn-tiny fa fa-user-circle" onclick="simmilarPerson('${escape(object.image)}');" title="Find simmilar people" style="right: 0px"></p>
  `;

  const desc = document.createElement('div');
  desc.className = 'col description';
  desc.id = object.id;
  desc.style = `display: ${window.options.listDetails ? 'block' : 'hidden'}`;
  desc.innerHTML = `
    <p class="listtitle">${decodeURI(object.image).replace(root, '')}</p>
    ${timestamp} | Size ${object.naturalSize.width} x ${object.naturalSize.height}<br>
    ${location}<br>
    ${classified}<br>
    ${detected}<br>
    ${person}<br>
    ${camera}<br>
    ${settings}<br>
  `;

  const div = document.createElement('div');
  div.className = 'listitem';
  div.style = `min-height: ${16 + window.options.listThumbSize}px; max-height: ${16 + window.options.listThumbSize}px`;
  div.appendChild(thumb);
  div.appendChild(desc);
  return div;
}

// adds items to gallery view on scroll event - infinite scroll
let current = 0;
async function scrollResults() {
  const scrollHeight = $('#results').prop('scrollHeight');
  const bottom = $('#results').scrollTop() + $('#all').height();
  if (((bottom + 16) >= scrollHeight) && (current < window.filtered.length)) {
    const t0 = window.performance.now();
    const res = document.getElementById('results');
    const count = Math.min(window.options.listItemCount, window.filtered.length - current);
    let i = current;
    while (i < (current + count)) {
      const divider = addDividers(window.filtered[i]);
      const item = printResult(window.filtered[i]);
      if (divider) res.appendChild(divider);
      res.appendChild(item);
      i++;
    }
    current = i;
    log.debug(t0, `Results scroll: added: ${count} current: ${current} total: ${window.filtered.length}`);
  }
  document.getElementById('number').innerText = `${(parseInt(current - 1, 10) + 1)}/${window.filtered.length || 0}`;
  $('.listitem').mouseenter((evt) => $(evt.target).find('.btn-tiny').toggle(true));
  $('.listitem').mouseleave((evt) => $(evt.target).find('.btn-tiny').toggle(false));
  $('.description').click((evt) => $(evt.target).parent().find('.btn-tiny').toggle());
}

// redraws gallery view and rebuilds sidebar menu
async function redrawResults() {
  window.location = `#${new Date().getTime()}`;
  busy(true);
  const t0 = window.performance.now();
  const res = document.getElementById('results');
  res.innerHTML = '';
  current = 0;
  $('#results').off('scroll');
  $('#results').scroll(() => scrollResults());
  scrollResults();
  log.debug(t0, 'Redraw results complete');
  busy(false);
}

// resize gallery view depending on user configuration
async function resizeResults() {
  const thumbSize = parseInt($('#thumbsize')[0].value, 10);
  if (thumbSize !== window.options.listThumbSize) {
    window.options.listThumbSize = thumbSize;
    $('#thumblabel').text(`Size: ${window.options.listThumbSize}px`);
    $('#thumbsize')[0].value = window.options.listThumbSize;
    $('.thumbnail').width(window.options.listThumbSize);
    $('.thumbnail').height(window.options.listThumbSize);
    $('.listitem').css('min-height', `${16 + window.options.listThumbSize}px`);
    $('.listitem').css('max-height', `${16 + window.options.listThumbSize}px`);
  }
}

// exctract top classe from classification & detection and builds sidebar menu
async function enumerateClasses() {
  $('#classes').html('');
  if (!Array.isArray(window.filtered)) window.filtered = [];
  const classesList = [];
  for (const item of window.filtered) {
    for (const tag of item.tags) {
      if (Object.keys(tag).length === 0) continue;
      const key = Object.keys(tag)[0];
      if (['name', 'ext', 'size', 'property', 'city', 'state', 'country', 'continent', 'near', 'year', 'created', 'edited'].includes(key)) continue;
      const val = Object.values(tag)[0].toString().split(',')[0];
      const found = classesList.find((a) => a.tag === val);
      if (found) found.count += 1;
      else classesList.push({ tag: val, count: 1 });
    }
  }
  classesList.sort((a, b) => b.count - a.count);
  classesList.length = Math.min(window.options.topClasses, classesList.length);
  let html = '';
  for (const item of classesList) {
    const tag = item.tag.split(/ |-|,/)[0];
    html += `<li><span tag="${escape(tag)}" type="class" style="padding-left: 16px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${tag} (${item.count})</span></li>`;
  }
  $('#classes').append(html);
  // eslint-disable-next-line no-use-before-define
  folderHandlers();
}

// extracts all locations from loaded images and builds sidebar menu
async function enumerateLocations() {
  $('#locations').html('');
  if (!Array.isArray(window.filtered)) window.filtered = [];
  let countries = [];
  for (const item of window.filtered) {
    if (item.location.country && !countries.includes(item.location.country)) countries.push(item.location.country);
  }
  countries = countries.sort((a, b) => (a > b ? 1 : -1));
  let i = 1;
  for (const country of countries) {
    const items = window.filtered.filter((a) => a.location.country === country);
    let places = [];
    for (const item of items) {
      const state = item.location.state ? `, ${item.location.state}` : '';
      if (!places.find((a) => a.name === `${item.location.near}${state}`)) places.push({ name: `${item.location.near}${state}`, sort: `${state}${item.location.near}` });
    }
    let children = '';
    places = places.sort((a, b) => (a.sort > b.sort ? 1 : -1));
    for (const place of places) {
      children += `<li><span tag="${escape(place.name)}" type="location" style="padding-left: 32px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${place.name}</span></li>`;
    }
    const html = `<li id="loc-${i}"><span tag="${escape(country)}" type="location" style="padding-left: 16px" class="folder"><i class="collapsible fas fa-chevron-circle-right">&nbsp</i>${country} (${items.length})</span></li>`;
    $('#locations').append(html);
    $(`#loc-${i}`).append(children);
    i++;
  }
}

// builds folder list from all loaded images and builds sidebar menu, can be used with entire image list or per-object
async function enumerateFolders() {
  $('#folders').html('');
  const root = window.user && window.user.root ? window.user.root : 'media/';
  const depth = root.split('/').length - 1;
  if (!Array.isArray(window.filtered)) window.filtered = [];

  let list = [];
  for (const item of window.filtered) {
    const path = item.image.substr(0, item.image.lastIndexOf('/'));
    const folders = path.split('/').filter((a) => a !== '');
    const existing = list.find((a) => a.path === path);
    if (!existing) list.push({ path, folders, count: 1 });
    else existing.count += 1;
  }
  list = list.sort((a, b) => (a.path > b.path ? 1 : -1));
  for (let i = depth; i < 10; i++) {
    for (const item of list) {
      if (item.folders[i]) {
        let pathId = '';
        for (let j = depth; j <= i; j++) pathId += escape(item.folders[j]);
        let parentId = '';
        for (let j = depth; j < i; j++) parentId += escape(item.folders[j]);
        if (!document.getElementById(`dir-${pathId}`)) {
          const div = document.createElement('li');
          div.id = `dir-${pathId}`;
          let path = '';
          for (let j = 0; j <= i; j++) path += `${escape(item.folders[j])}/`;
          const count = i === item.folders.length - 1 ? `(${item.count})` : '';
          div.innerHTML = `<span tag="${path}" type="folder" style="padding-left: ${i * 16}px" class="folder"><i class="collapsible fas fa-chevron-circle-right">&nbsp</i>${item.folders[i]} ${count}</span>`;
          if (i === depth) document.getElementById('folders').appendChild(div);
          else document.getElementById(`dir-${parentId}`).appendChild(div);
        }
      }
    }
  }
}

// handles all clicks on sidebar menu (folders, locations, classes)
async function folderHandlers() {
  $('.collapsible').off();
  $('.collapsible').click(async (evt) => {
    $(evt.target).toggleClass('fa-chevron-circle-down fa-chevron-circle-right');
    $(evt.target).parent().parent().find('li')
      .toggle('slow');
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
        enumerateClasses();
        break;
      case 'location':
        log.debug(t0, `Selected location: ${path}`);
        if (window.filtered.length < await db.count()) {
          window.filtered = await db.all();
          window.options.listSortOrder = 'numeric-down';
        }
        if (path !== 'Unknown') window.filtered = window.filtered.filter((a) => (path.startsWith(escape(a.location.near)) || path.startsWith(escape(a.location.country))));
        else window.filtered = window.filtered.filter((a) => (!a.location || !a.location.near));
        enumerateClasses();
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
        if (window.filtered.length < await db.count()) {
          window.filtered = await db.all();
          window.options.listSortOrder = 'numeric-down';
        }
        enumerateClasses();
        break;
      default:
    }
    redrawResults();
    // enumerateResults();
    busy(false);
  });
}

async function enumerateShares() {
  window.shares = [];
  const shares = await fetch('/api/shares');
  if (shares.ok) window.shares = await shares.json();
  if (!window.shares || (window.shares.length < 1)) return;
  let html = '';
  for (const share of window.shares) {
    html += `<li><span tag="${share.key}" type="share" style="padding-left: 16px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${share.name}</span></li>`;
  }
  $('#shares').html(html);
  $('#shares').find('li').toggle('slow');
  log.debug(null, `Enumerated shares: ${window.shares.length}`);
}

async function enumerateResults() {
  await enumerateFolders();
  await enumerateLocations();
  await enumerateShares();
  await enumerateClasses();
  // reinit of folderHandlers() is called from enumerateClasses();
}

// starts slideshow
let slideshowRunning;
async function startSlideshow(start) {
  if (start) {
    details.next(false);
    slideshowRunning = setTimeout(() => startSlideshow(true), window.options.slideDelay);
  } else if (slideshowRunning) {
    clearTimeout(slideshowRunning);
    slideshowRunning = null;
  }
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
  previous = null;
  let foundWords = 0;
  const t0 = window.performance.now();
  const size = window.filtered.length;
  for (const word of words.split(' ')) {
    window.filtered = filterWord(word.toLowerCase());
    foundWords += (window.filtered && window.filtered.length > 0) ? 1 : 0;
  }
  if (window.filtered && window.filtered.length > 0) log.debug(t0, `Searching for "${words}" found ${foundWords} words in ${window.filtered.length || 0} matches out of ${size} images`);
  else log.debug(t0, `Searching for "${words}" found ${foundWords} of ${words.split(' ').length} terms`);
  enumerateResults();
  redrawResults();
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
  redrawResults();
  enumerateResults();
  scrollResults();
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
  redrawResults();
  enumerateResults();
  scrollResults();
  busy(false);
}

// sorts images based on given sort order
let loadTried = false;
async function sortResults(sort) {
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
  previous = null;
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
  redrawResults();
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
  enumerateResults();
  scrollResults();
  busy(false);
}

// find duplicate images based on pre-computed sha-256 hash
async function findDuplicates() {
  busy(true);

  log.result('Analyzing images for simmilarity ...');
  const t0 = window.performance.now();
  previous = null;

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

// loads imagesm, displays gallery and enumerates sidebar
async function loadGallery(limit, refresh = false) {
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
  if (res && res.ok) json = await res.json();
  const t1 = window.performance.now();
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
  if (!refresh) sortResults(window.options.listSortOrder);
  busy(false);
}

// popup on right-click
async function showContextPopup(evt) {
  evt.preventDefault();
  showTip(evt.target, `displaying ${window.filtered.length} of ${await db.count()} images`);
}

// called on startup to get logged in user details from server
async function initUser() {
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
    log.result(`Logged in: ${window.user.user} root:${window.user.root} admin:${window.user.admin}`);
    if (!window.user.admin) $('#btn-update').css('color', 'gray');
  } else {
    window.location = '/client/auth.html';
  }
  $('body').css('fontSize', window.options.fontSize);
  $('#folderbar').toggle(window.options.listFolders);
  $('.description').toggle(window.options.listDetails);
  $('#thumbsize')[0].value = window.options.listThumbSize;
  $('body').contextmenu((evt) => showContextPopup(evt));
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
    $('#btn-shareadd').removeClass('fa-minus-square').addClass('fa-plus-square');
    $('#share').toggle('slow');
    $('#share-name').focus();
    $('#shares').find('li').toggle('slow');
    $('#share-name').val('');
    $('#share-url').val('');
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
        .done((res) => {
          $('#share-url').val(`${window.location.origin}?share=${res.key}`);
        })
        .fail(() => {
          $('#share-url').val('error creating share');
        });
      enumerateShares();
    } else {
      const name = $('#share-name').val();
      const key = $('#share-url').val().split('=')[1];
      log.debug(t0, `Share remove: ${name} ${key}`);
      fetch(`/api/share?rm=${key}`).then(() => enumerateShares());
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
        startSlideshow(false);
        break;
      default: // log.result('Unhandled keydown event', event.keyCode);
    }
  });
}

// navbar details - used when in details view
function initDetailsHandlers() {
  // handle clicks inside details view
  $('#popup').click(() => {
    if (event.screenX < 50) details.next(true);
    else if (event.clientX > $('#popup').width() - 50) details.next(false);
    else if (!event.target.className.includes('iv-large-image')) {
      details.clear();
      $('#popup').toggle('fast');
      $('#optionsview').toggle(false);
    }
  });

  // navbar details previous
  $('#details-previous').click(() => details.next(true));

  // navbar details close
  $('#details-close').click(() => {
    details.clear();
    startSlideshow(false);
    $('#popup').toggle('fast');
    $('#optionsview').toggle(false);
  });

  // navbar details next
  $('#details-next').click(() => details.next(false));

  // navbar details show/hide details
  $('#details-desc').click(() => {
    $('#details-desc').toggleClass('fa-comment fa-comment-slash');
    window.options.viewDetails = !window.options.viewDetails;
    $('#popup-details').toggle(window.options.viewDetails);
  });

  // navbar details show/hide detection boxes
  $('#details-boxes').click(() => {
    $('#details-boxes').toggleClass('fa-store fa-store-slash');
    window.options.viewBoxes = !window.options.viewBoxes;
    details.boxes();
  });

  // navbar details show/hide faces
  $('#details-faces').click(() => {
    $('#details-faces').toggleClass('fa-head-side-cough fa-head-side-cough-slash');
    window.options.viewFaces = !window.options.viewFaces;
    details.boxes();
  });

  // navbar details download image
  $('#details-raw').click(() => {
    $('#details-raw').toggleClass('fa-video fa-video-slash');
    window.options.viewRaw = !window.options.viewRaw;
  });
}

function initSidebarHandlers() {
  $('#resettitle').click(() => sortResults(window.options.listSortOrder));
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

  $('#btn-changelog').click(async () => {
    await showNavbar($('#docs'));
    // $('#docs').click(() => $('#docs').toggle('fast'));
    if ($('#docs').css('display') !== 'none') {
      const res = await fetch('/CHANGELOG.md');
      const md = await res.text();
      if (md) $('#docs').html(marked(md));
    }
  });

  // navline user logout
  $('#btn-logout').click(() => {
    showNavbar();
    $.post('/api/auth');
    if ($('#btn-user').hasClass('fa-user-slash')) window.location = '/client/auth.html';
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    window.location.reload(false);
  });

  // navbar search
  $('#btn-search').click(() => {
    showNavbar($('#searchbar'));
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
  $('#btn-list').click(() => showNavbar($('#optionslist')));

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
  $('#thumbsize').on('input', () => resizeResults());

  // navbar slideshow
  $('#btn-slide').click(() => {
    details.show(window.filtered[0].image);
    startSlideshow(true);
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

  $('#btn-number').mouseover(async (evt) => {
    showTip(evt.target, `Currently displaying: ${(parseInt(current - 1, 10) + 1)}<br><br>Total images: ${window.filtered.length}`);
  });
}

async function main() {
  // google analytics
  // eslint-disable-next-line prefer-rest-params
  // function gtag() { window.dataLayer.push(arguments); }
  // gtag('js', new Date());
  // gtag('config', 'UA-155273-2', { page_path: `${location.pathname}` });
  // gtag('set', { user_id: `${window.user}` }); // Set the user ID using signed-in user_id.

  // Register PWA
  if (config.registerPWA) pwa.register('/client/pwa-serviceworker.js');
  window.share = (window.location.search && window.location.search.startsWith('?share=')) ? window.location.search.split('=')[1] : null;

  resizeViewport();
  await initUser();
  initListHandlers();
  initSidebarHandlers();
  initDetailsHandlers();
  initHotkeys();
  showNavbar();
  await db.open();
  initSharesHandler();
  window.details = details;
  window.simmilarImage = simmilarImage;
  window.simmilarPerson = simmilarPerson;
  if (window.share) log.debug(null, `Direct link to share: ${window.share}`);
  await sortResults(window.options.listSortOrder);
  $('.collapsible').parent().parent().find('li').toggle(false);
}

window.onhashchange = async (evt) => {
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
};

window.onpopstate = (evt) => {
  const t0 = window.performance.now();
  log.debug(t0, `URL Pop state: ${evt.target.location.href}`);
};

window.onload = main;

exports.draw = sortResults;
exports.redraw = redrawResults;
exports.load = loadGallery;
