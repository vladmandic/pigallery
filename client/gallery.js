/* global Popper */

// const oboe = require('oboe');
const moment = require('moment');
const marked = require('marked');
const log = require('./log.js');
const config = require('./config.js').default;
const details = require('./details.js');
const map = require('./map.js');
const db = require('./indexdb.js');
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

async function time(fn, arg) {
  if (window.debug) {
    const t0 = window.performance.now();
    await fn(arg);
    const t1 = window.performance.now();
    log.result(`Timed ${fn.name}: ${Math.round(t1 - t0).toLocaleString()} ms`);
  } else {
    fn(arg);
  }
}

function showTip(parent, text) {
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
  }, 3000);
}

// adds dividiers based on sort order
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
    location = 'Location';
    location += ` | ${object.location.city}, ${object.location.state} ${object.location.country} (near ${object.location.near})`;
  }

  const timestamp = object.exif.created ? moment(object.exif.created).format(window.options.dateShort) : 'Date unknown';
  const link = `<a class="download fa fa-arrow-alt-circle-down" href="${object.image}" download></a>`;

  const root = window.user && window.user.root ? window.user.root : 'media/';
  const html = `
    <div class="listitem" style="min-height: ${16 + window.options.listThumbSize}px; max-height: ${16 + window.options.listThumbSize}px">
      <div class="col thumbnail">
        <img class="thumbnail" id="thumb-${object.id}" img="${object.image}" src="${object.thumbnail}"
        align="middle" width=${window.options.listThumbSize}px height=${window.options.listThumbSize}px
        onclick="details.show('${object.image}');">
      </div>
      <div id="desc-${object.id}" class="col description" style="display: ${window.options.listDetails ? 'block' : 'hidden'}>
        <p class="listtitle">${decodeURI(object.image).replace(root, '')}</p>${link}
        ${timestamp} | Size ${object.naturalSize.width} x ${object.naturalSize.height}<br>
        ${location}<br>
        ${classified}<br>
        ${detected}<br>
        ${person}<br>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.className = 'listitem';
  div.innerHTML = html;
  return div;
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

// extracts all locations from loaded images and builds sidebar menu
async function enumerateLocations() {
  $('#locations').html('');
  const locationsList = [];
  let unknown = 0;
  for (const item of window.filtered) {
    if (item.location && item.location.near) {
      const loc = `${item.location.near}, ${item.location.state || item.location.country}`;
      const here = locationsList.find((a) => (a.loc === loc));
      if (!here) locationsList.push({ loc, count: 1 });
      else here.count += 1;
    } else {
      unknown += 1;
    }
  }
  locationsList.sort((a, b) => (a.loc > b.loc ? 1 : -1));
  if (unknown > 0) locationsList.unshift({ loc: 'Unknown', count: unknown });
  let html = '';
  for (const item of locationsList) {
    html += `
      <li id="loc-${item.loc}">
        <span tag="${item.loc}" type="location" style="padding-left: 16px" class="folder">&nbsp
          <i tag="${item.loc}" class="fas fa-chevron-circle-right">&nbsp</i>${item.loc} (${item.count})
        </span>
      </li>
    `;
  }
  $('#locations').append(html);
}

// exctract top classe from classification & detection and builds sidebar menu
async function enumerateClasses() {
  $('#classes').html('');
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
    html += `
      <li id="loc-${item.tag}">
        <span tag="${item.tag}" type="class" style="padding-left: 16px" class="folder">&nbsp
          <i tag="${item.tag}" class="fas fa-chevron-circle-right">&nbsp</i>${item.tag} (${item.count})
        </span>
      </li>
    `;
  }
  $('#classes').append(html);
}

// builds folder list from all loaded images and builds sidebar menu
// can be used with entire image list or per-object
let folderList = [];
async function enumerateFolders(input) {
  $('#folders').html('');
  if (input) {
    const path = input.substr(0, input.lastIndexOf('/'));
    const folders = path.split('/').filter((a) => a !== '');
    if (!folderList.find((a) => a.path === path)) {
      folderList.push({ path, folders });
    }
  } else {
    folderList = [];
    for (const item of window.filtered) {
      const path = item.image.substr(0, item.image.lastIndexOf('/'));
      const folders = path.split('/').filter((a) => a !== '');
      if (!folderList.find((a) => a.path === path)) {
        folderList.push({ path, folders });
      }
    }
  }
  folderList = folderList.sort((a, b) => (a.path > b.path ? 1 : -1));
  const root = window.user && window.user.root ? window.user.root : 'media/';
  for (let i = 0; i < 10; i++) {
    for (const item of folderList) {
      if (item.folders[i]) {
        const folder = item.folders[i].replace(/[^a-zA-Z]/g, '');
        const parent = item.folders[i > 0 ? i - 1 : 0].replace(/[^a-zA-Z]/g, '');
        let path = '';
        for (let j = 0; j <= i; j++) path += `${item.folders[j]}/`;
        const name = folder === root.replace(/\//g, '') ? 'All' : item.folders[i];
        const html = `
          <li id="dir-${folder}"">
            <span tag="${path}" type="folder" style="padding-left: ${i * 16}px" class="folder">&nbsp
              <i tag="${path}" class="fas fa-chevron-circle-right">&nbsp</i>${name}
            </span>
          </li>
        `;
        let parentElem = $(`#dir-${parent}`);
        if (parentElem.length === 0) parentElem = $('#folders');
        const currentElem = $(`[tag="${path}"]`);
        if (currentElem.length === 0) parentElem.append(html);
      }
    }
  }
}

// handles all clicks on sidebar menu (folders, locations, classes)
async function folderHandlers() {
  $('.folder').off();
  $('.folder').click(async (evt) => {
    if (!window.filtered || (window.filtered.length === 0)) return;
    busy(true);
    const path = $(evt.target).attr('tag');
    switch (evt.target.getAttribute('type')) {
      case 'folder':
        if (window.debug) log.result(`Selected path: ${path}`);
        const root = window.user && window.user.root ? window.user.root : 'media/';
        if (path !== root) window.filtered = window.filtered.filter((a) => a.image.startsWith(path));
        else window.filtered = db.all('date', false);
        break;
      case 'location':
        if (window.debug) log.result(`Selected location: ${path}`);
        if (path !== 'Unknown') window.filtered = window.filtered.filter((a) => path.startsWith(a.location.near));
        else window.filtered = window.filtered.filter((a) => (!a.location || !a.location.near));
        break;
      case 'class':
        window.filtered = window.filtered.filter((a) => {
          const found = a.tags.find((b) => (Object.values(b)[0].toString().startsWith(path)));
          return found;
        });
        if (window.debug) log.result(`Selected class: ${path}`);
        break;
      default:
    }
    // eslint-disable-next-line no-use-before-define
    time(redrawResults);
    // eslint-disable-next-line no-use-before-define
    time(enumerateResults);
    busy(false);
  });
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
    const t1 = window.performance.now();
    if (window.debug) log.result(`Timed scrollResults: ${Math.round(t1 - t0).toLocaleString()} ms added: ${count} current: ${current} total: ${window.filtered.length}`);
  }
  document.getElementById('number').innerText = `${(parseInt(current - 1, 10) + 1)}/${window.filtered.length}`;
}

async function enumerateResults() {
  time(enumerateFolders);
  time(enumerateLocations);
  time(enumerateClasses);
  time(folderHandlers);
}

// redraws gallery view and rebuilds sidebar menu
async function redrawResults() {
  window.location = `#${new Date().getTime()}`;
  busy(true);
  const t0 = window.performance.now();
  const res = document.getElementById('results');
  res.innerHTML = '';
  /*
  const num = document.getElementById('number');
  for (const i in window.filtered) {
    setTimeout(() => {
      const divider = addDividers(window.filtered[i]);
      const item = printResult(window.filtered[i]);
      if (divider) res.appendChild(divider);
      res.appendChild(item);
      num.innerText = (parseInt(i, 10) + 1);
    }, i);
  }
  */
  current = 0;
  $('#results').off('scroll');
  $('#results').scroll(() => scrollResults());
  time(scrollResults);
  const t1 = window.performance.now();
  if (window.debug) log.result(`Timed loop printResults: ${Math.round(t1 - t0).toLocaleString()} ms`);
  // window.location = `#${moment().format('MMDDHHmmss')}`;
  busy(false);
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
  for (const word of words.split(' ')) {
    window.filtered = filterWord(word.toLowerCase());
    foundWords += (window.filtered && window.filtered.length > 0) ? 1 : 0;
  }
  if (window.debug) {
    if (window.filtered && window.filtered.length > 0) log.result(`Searching for "${words}" found ${foundWords} words in ${window.filtered.length || 0} results out of ${await db.count()} matches`);
    else log.result(`Searching for "${words}" found ${foundWords} of ${words.split(' ').length} terms`);
  }
  time(enumerateResults);
  time(redrawResults);
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

// sorts images based on given sort order
let loadTried = false;
async function sortResults(sort) {
  $('#optionslist').toggle(false);
  busy(true);
  if (window.debug) log.result(`Sorting: ${sort.replace('navlinebutton fas sort fa-', '')}`);
  const t0 = window.performance.now();
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
  const t1 = window.performance.now();
  time(redrawResults);
  const t2 = window.performance.now();
  if (window.debug) log.result(`Cached images: ${window.filtered.length} fetched initial in ${Math.round(t1 - t0).toLocaleString()} ms displayed in ${Math.round(t2 - t1).toLocaleString()} ms`);
  $('#all').focus();
  if (sort.includes('alpha-down')) window.filtered = window.filtered.concat(await db.all('name', true, window.options.listItemCount + 1));
  if (sort.includes('alpha-up')) window.filtered = window.filtered.concat(await db.all('name', false, window.options.listItemCount + 1));
  if (sort.includes('numeric-down')) window.filtered = window.filtered.concat(await db.all('date', false, window.options.listItemCount + 1));
  if (sort.includes('numeric-up')) window.filtered = window.filtered.concat(await db.all('date', true, window.options.listItemCount + 1));
  if (sort.includes('amount-down')) window.filtered = window.filtered.concat(await db.all('size', false, window.options.listItemCount + 1));
  if (sort.includes('amount-up')) window.filtered = window.filtered.concat(await db.all('size', true, window.options.listItemCount + 1));
  const t3 = window.performance.now();
  if (window.debug) log.result(`Cached images: ${window.filtered.length} fetched remaining in ${Math.round(t3 - t1).toLocaleString()} ms`);
  if (window.filtered.length > 0) log.result(`Retrieved ${window.filtered.length} images from cache`);
  else log.result('Image cache empty');
  if (!loadTried && window.filtered.length === 0) {
    loadTried = true;
    // eslint-disable-next-line no-use-before-define
    await loadGallery(window.options.listLimit);
  }
  time(enumerateResults);
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
async function loadGallery(limit) {
  if (!window.user.user) return;
  busy(true);
  const t0 = window.performance.now();
  log.result('Downloading image cache ...');
  await db.reset();
  await db.open();
  if (window.options.liveLoad) {
    /*
    let count = 0;
    oboe({ url: `/api/get?limit=${limit}&find=all`, cached: true, withCredentials: false })
      .node('{image}', (image) => {
        db.put(image);
        $('#number').text(count++);
        $('#results').append(printResult(image));
        enumerateFolders(image.image);
        // time: 15sec load, 10sec print, 3sec enumerate
      })
      .done(async () => {
        const t1 = window.performance.now();
        if (window.debug) {
          const size = JSON.stringify(await db.all()).length;
          log.result(`Received ${await db.count()} images: ${Math.round(t1 - t0).toLocaleString()} ms ${size.toLocaleString()} bytes ${Math.round(size / (t1 - t0)).toLocaleString()} KB/sec`);
        } else {
          log.result(`Received ${await db.count()} images in ${Math.round(t1 - t0).toLocaleString()} ms`);
        }
        window.filtered = await db.all();
        time(sortResults, window.options.listSortOrder);
      });
      */
  } else {
    const res = await fetch(`/api/get?limit=${limit}&find=all`);
    let json = [];
    if (res && res.ok) json = await res.json();
    const t1 = window.performance.now();
    await db.store(json);
    const t2 = window.performance.now();
    if (window.debug) {
      const size = JSON.stringify(await db.all()).length;
      log.result(`Downloaded cache: ${json.length} ${Math.round(t1 - t0).toLocaleString()} ms stored ${await db.count()} images in ${Math.round(t2 - t1).toLocaleString()} ms ${size.toLocaleString()} bytes ${Math.round(size / (t1 - t0)).toLocaleString()} KB/sec`);
    } else {
      log.result(`Downloaded cache: ${await db.count()} images in ${Math.round(t1 - t0).toLocaleString()} ms stored in ${Math.round(t2 - t1).toLocaleString()} ms`);
    }
    window.filtered = await db.all();
    time(sortResults, window.options.listSortOrder);
  }
  busy(false);
}

// popup on right-click
async function showContextPopup(evt) {
  evt.preventDefault();
  showTip(evt.target, `displaying ${window.filtered.length} of ${await db.count()} images`);
}

// called on startup to get logged in user details from server
async function initUser() {
  const res = await fetch('/api/user');
  if (res.ok) window.user = await res.json();
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
    $.post('/client/auth.html');
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
    if (window.debug) log.result('Starting slide show ...');
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
    if (window.debug) log.result('Reset filtered results');
    sortResults(window.options.listSortOrder);
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

  resizeViewport();
  initListHandlers();
  initSidebarHandlers();
  initDetailsHandlers();
  initHotkeys();
  showNavbar();
  await initUser();
  await db.open();
  window.details = details;
  time(sortResults, window.options.listSortOrder);
}

window.onhashchange = async (evt) => {
  if (window.debug) log.result('OnHashChange', evt.newURL);
  const target = parseInt(evt.newURL.substr(evt.newURL.indexOf('#') + 1), 10);
  const source = parseInt(evt.oldURL.substr(evt.oldURL.indexOf('#') + 1), 10);
  if (source > target) {
    const top = parseInt($('#all').scrollTop(), 10) === 0;
    const all = await db.count() - window.filtered.length;
    if (top && all === 0) {
      if (window.debug) log.result('Exiting ...');
    } else {
      if (window.debug) log.result('Reset image selection');
      sortResults(window.options.listSortOrder);
    }
  }
};

window.onpopstate = (evt) => {
  if (window.debug) log.result('OnPopState', evt.target.location.href);
};

window.onload = main;

exports.draw = sortResults;
exports.redraw = redrawResults;
exports.load = loadGallery;
