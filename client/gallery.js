const oboe = require('oboe');
const moment = require('moment');
const marked = require('marked');
const { createPopper } = require('@popperjs/core');
const log = require('./log.js');
const config = require('./config.js').default;
const hash = require('./blockhash.js');
const details = require('./details.js');
const pwa = require('./pwa-register.js');

// global variables
window.results = [];
window.window.filtered = [];

// user configurable options, stored in browsers local storage
window.options = {
  get listFolders() { return localStorage.getItem('listFolders') ? localStorage.getItem('listFolders') === 'true' : true; },
  set listFolders(val) { return localStorage.setItem('listFolders', val); },
  get listDetails() { return localStorage.getItem('listDetails') ? localStorage.getItem('listDetails') === 'true' : true; },
  set listDetails(val) { return localStorage.setItem('listDetails', val); },
  get listDivider() { return localStorage.getItem('listDivider') || 'month'; },
  set listDivider(val) { return localStorage.setItem('listDivider', val); },
  get listSortOrder() { return localStorage.getItem('listSortOrder') || 'numeric-down'; },
  set listSortOrder(val) { return localStorage.setItem('listSortOrder', val); },
  get listThumbSize() { return parseInt(localStorage.getItem('listThumbSize') || 165, 10); },
  set listThumbSize(val) { return localStorage.setItem('listThumbSize', val); },
  get listLimit() { return parseInt(localStorage.getItem('listLimit') || 100, 10); },
  set listLimit(val) { return localStorage.setItem('listLimit', val); },
  get viewDetails() { return localStorage.getItem('viewDetails') ? localStorage.getItem('viewDetails') === 'true' : true; },
  set viewDetails(val) { return localStorage.setItem('viewDetails', val); },
  get viewBoxes() { return localStorage.getItem('viewBoxes') ? localStorage.getItem('viewBoxes') === 'true' : true; },
  set viewBoxes(val) { return localStorage.setItem('viewBoxes', val); },
  get viewFaces() { return localStorage.getItem('viewFaces') ? localStorage.getItem('viewFaces') === 'true' : true; },
  set viewFaces(val) { return localStorage.setItem('viewFaces', val); },
  get viewRaw() { return localStorage.getItem('viewRaw') ? localStorage.getItem('viewRaw') === 'true' : false; },
  set viewRaw(val) { return localStorage.setItem('viewRaw', val); },
  get liveLoad() { return localStorage.getItem('liveLoad') ? localStorage.getItem('liveLoad') === 'true' : false; },
  set liveLoad(val) { return localStorage.setItem('liveLoad', val); },
  get dateShort() { return localStorage.getItem('dateShort') || 'YYYY/MM/DD'; },
  set dateShort(val) { return localStorage.setItem('dateShort', val); },
  get dateLong() { return localStorage.getItem('dateLong') || 'dddd, MMMM Do, YYYY'; },
  set dateLong(val) { return localStorage.setItem('dateLong', val); },
  get dateDivider() { return localStorage.getItem('dateDivider') || 'MMMM YYYY'; },
  set dateDivider(val) { return localStorage.setItem('dateDivider', val); },
  get fontSize() { return localStorage.getItem('fontSize') || '14px'; },
  set fontSize(val) { return localStorage.setItem('fontSize', val); },
  get slideDelay() { return parseInt(localStorage.getItem('slidedelay') || 2500, 10); },
  set slideDelay(val) { return localStorage.setItem('slidedelay', val); },
  get topClasses() { return parseInt(localStorage.getItem('slidedelay') || 25, 10); },
  set topClasses(val) { return localStorage.setItem('slidedelay', val); },
  get listDetailsWidth() { return parseFloat(localStorage.getItem('listDetailsWidth') || 0.25); },
  set listDetailsWidth(val) { return localStorage.setItem('listDetailsWidth', val); },
};

// google analytics
// eslint-disable-next-line prefer-rest-params
function gtag() { window.dataLayer.push(arguments); }

function showTip(parent, text) {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.role = 'tooltip';
  tip.className = 'popper';
  tip.innerHTML = text;
  parent.appendChild(tip);
  let popup = createPopper(parent, tip, { placement: 'left', strategy: 'absolute', modifiers: [{ name: 'offset', options: { offset: [0, 20] } }] });
  setTimeout(() => {
    popup.destroy();
    popup = null;
    parent.removeChild(tip);
  }, 3000);
}

// adds dividiers based on sort order
let previous;
function addDividers(object) {
  if (window.options.listDivider === 'simmilarity' && object.simmilarity) {
    const curr = `${100 - object.simmilarity}%`;
    const prev = previous ? `${100 - previous.simmilarity}%` : 'none';
    if (curr !== prev) $('#results').append(`<div class="row divider">${curr}</div>`);
  }
  if (window.options.listDivider === 'month') {
    const curr = moment(object.exif.timestamp).format(window.options.dateDivider);
    const prev = moment(previous ? previous.exif.timestamp : 0).format(window.options.dateDivider);
    if (curr !== prev) $('#results').append(`<div class="row divider">${curr}</div>`);
  }
  if (window.options.listDivider === 'size') {
    const curr = Math.round(object.pixels / 1000 / 1000);
    const prev = Math.round((previous ? previous.pixels : 1) / 1000 / 1000);
    if (curr !== prev) $('#results').append(`<div class="row divider">Size: ${curr} MP</div>`);
  }
  if (window.options.listDivider === 'folder') {
    const curr = object.image.substr(0, object.image.lastIndexOf('/'));
    const prev = previous ? previous.image.substr(0, previous.image.lastIndexOf('/')) : 'none';
    if (curr !== prev) $('#results').append(`<div class="row divider">${curr}</div>`);
  }
}

// print results element with thumbnail and description for a given object
async function printResult(object) {
  addDividers(object);
  previous = object;
  let classified = '';
  let all = [...object.classify || [], ...object.alternative || []];
  if (all.length > 0) {
    classified = 'Classified';
    all = all.sort((a, b) => b.score - a.score).map((a) => a.class);
    all = [...new Set(all)];
    for (const item of all) {
      classified += ` | ${item}`;
    }
  }
  let person = '';
  let nsfw = '';
  if (object.person && object.person[0]) person = 'People';
  for (const i in object.person) {
    person += ` | ${object.person[i].gender} ${object.person[i].age.toFixed(0)}`;
    if (object.person[i].class) {
      nsfw += `Class: ${object.person[i].class} `;
    }
  }
  let detected = '';
  let personCount = 0;
  if (object.detect && object.detect[0]) {
    detected = 'Detected';
    for (const obj of object.detect) {
      if (obj.class !== 'person') detected += ` | ${obj.class}`;
      else personCount++;
    }
    personCount = Math.max(personCount, object.person ? object.person.length : 0);
    if (personCount === 1) detected += ' | person';
    else if (personCount > 1) detected += ` | ${personCount} persons`;
  }
  let location = '';
  if (object.location && object.location.city) {
    location = 'Location';
    location += ` | ${object.location.city}, ${object.location.state} ${object.location.country} (near ${object.location.near})`;
  }

  const timestamp = moment(object.exif.timestamp).format(window.options.dateShort);
  const link = `<a class="download fa fa-arrow-alt-circle-down" href="${object.image}" download></a>`;
  const divItem = document.createElement('div');
  divItem.className = 'listitem';

  const root = window.user && window.user.root ? window.user.root : 'media/';
  divItem.innerHTML = `
    <div class="col thumbnail">
      <img class="thumbnail" id="thumb-${object.id}" src="${object.thumbnail}" align="middle" width=${window.options.listThumbSize}px height=${window.options.listThumbSize}px>
    </div>
    <div id="desc-${object.id}" class="col description">
      <p class="listtitle">${decodeURI(object.image).replace(root, '')}</p>${link}
      ${timestamp} | Size ${object.naturalSize.width} x ${object.naturalSize.height}<br>
      ${location}<br>
      ${classified}<br>
      ${detected}<br>
      ${person} ${nsfw}<br>
    </div>
  `;
  $('#results').append(divItem);
  const divThumb = document.getElementById(`thumb-${object.id}`);
  divThumb.img = object.image;
  divThumb.addEventListener('click', (evt) => {
    details.show(divThumb.src, evt.target.img);
  });
}

// resize gallery view depending on user configuration
function resizeResults() {
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
    const loc = `${item.location.near}, ${item.location.state || item.location.country}`;
    if (item.location && item.location.near) {
      const here = locationsList.find((a) => (a.loc === loc));
      if (!here) {
        locationsList.push({ loc, count: 1 });
      } else {
        here.count += 1;
      }
    } else {
      unknown += 1;
    }
  }
  locationsList.sort((a, b) => (a.loc > b.loc ? 1 : -1));
  locationsList.unshift({ loc: 'Unknown', count: unknown });
  for (const item of locationsList) {
    const html = `
      <li id="loc-${item.loc}">
        <span tag="${item.loc}" type="location" style="padding-left: 16px" class="folder">&nbsp
          <i tag="${item.loc}" class="fas fa-chevron-circle-right">&nbsp</i>${item.loc} (${item.count})
        </span>
      </li>
    `;
    $('#locations').append(html);
  }
}

// builds folder list from all loaded images and builds sidebar menu
// can be used with entire image list or per-object
let folderList = [];
async function enumerateFolders(input) {
  $('#folders').html('');
  if (input) {
    const path = input.substr(0, input.lastIndexOf('/'));
    const folders = path.split('/').filter((a) => a !== '');
    if (!folderList.find((a) => a.path === path)) folderList.push({ path, folders });
  } else {
    folderList = [];
    for (const item of window.filtered) {
      const path = item.image.substr(0, item.image.lastIndexOf('/'));
      const folders = path.split('/').filter((a) => a !== '');
      if (!folderList.find((a) => a.path === path)) folderList.push({ path, folders });
    }
  }
  for (let i = 0; i < 10; i++) {
    for (const item of folderList) {
      if (item.folders[i]) {
        const folder = item.folders[i].replace(/[^a-zA-Z]/g, '');
        const parent = item.folders[i > 0 ? i - 1 : 0].replace(/[^a-zA-Z]/g, '');
        let path = '';
        for (let j = 0; j <= i; j++) path += `${item.folders[j]}/`;
        const root = window.user && window.user.root ? window.user.root : 'media/';
        const name = folder === root.replace(/\//g, '') ? 'All' : item.folders[i];
        const html = `
          <li id="dir-${folder}">
            <span tag="${path}" type="folder" style="padding-left: ${i * 16}px" class="folder">&nbsp
              <i tag="${path}" class="fas fa-chevron-circle-right">&nbsp</i>${name}
            </span>
          </li>
        `;
        let parentElem = $(`#dir-${parent}`);
        if (parentElem.length === 0) parentElem = $('#folders');
        const currentElem = $(`#dir-${folder}`);
        if (currentElem.length === 0) parentElem.append(html);
      }
    }
  }
}

// exctract top classe from classification & detection and builds sidebar menu
async function enumerateClasses() {
  $('#classes').html('');
  const classesList = [];
  for (const item of window.filtered) {
    for (const tag of item.tags) {
      const key = Object.keys(tag)[0];
      const val = Object.values(tag)[0].toString().split(',')[0];
      if (['name', 'ext', 'size', 'property', 'city', 'state', 'country', 'continent', 'near', 'year', 'created', 'edited'].includes(key)) continue;
      const found = classesList.find((a) => a.tag === val);
      if (found) found.count += 1;
      else classesList.push({ tag: val, count: 1 });
    }
  }
  classesList.sort((a, b) => b.count - a.count);
  classesList.length = Math.min(window.options.topClasses, classesList.length);
  for (const item of classesList) {
    const html = `
      <li id="loc-${item.tag}">
        <span tag="${item.tag}" type="class" style="padding-left: 16px" class="folder">&nbsp
          <i tag="${item.tag}" class="fas fa-chevron-circle-right">&nbsp</i>${item.tag} (${item.count})
        </span>
      </li>
    `;
    $('#classes').append(html);
  }
}

// handles all clicks on sidebar menu (folders, locations, classes)
async function folderHandlers() {
  $('.folder').off();
  $('.folder').click((evt) => {
    const path = $(evt.target).attr('tag');
    switch (evt.target.getAttribute('type')) {
      case 'folder':
        $('body').css('cursor', 'wait');
        log.result(`Showing path: ${path}`);
        const root = window.user && window.user.root ? window.user.root : 'media/';
        if (path === root) window.filtered = window.results;
        else window.filtered = window.results.filter((a) => a.image.startsWith(path));
        break;
      case 'location':
        log.result(`Showing location: ${path}`);
        if (path !== 'Unknown') window.filtered = window.results.filter((a) => path.startsWith(a.location.near));
        else window.filtered = window.results.filter((a) => (!a.location || !a.location.near));
        break;
      case 'class':
        window.filtered = window.results.filter((a) => {
          let found = false;
          for (const tag of a.tags) {
            if (path === Object.values(tag)[0].toString()) found = true;
          }
          return found;
        });
        log.result(`Showing class: ${path}`);
        break;
      default:
    }
    // eslint-disable-next-line no-use-before-define
    redrawResults(false);
  });
}

// starts slideshow
let slideshowRunning = false;
async function startSlideshow() {
  if (!slideshowRunning) return;
  details.next(false);
  setTimeout(() => {
    startSlideshow();
  }, window.options.slideDelay);
}

// redraws gallery view and rebuilds sidebar menu
async function redrawResults(generateFolders = true) {
  $('#number').html(window.filtered.length);
  $('#results').html('');
  if (generateFolders) {
    enumerateFolders();
    enumerateLocations();
    enumerateClasses();
    folderHandlers();
  }
  for await (const obj of window.filtered) printResult(obj);
  $('.description').toggle(window.options.listDetails);
  await resizeResults();
  $('body').css('cursor', 'pointer');
}

// used by filterresults
function filterWord(object, word) {
  if (!object) return null;
  const skip = ['in', 'a', 'the', 'of', 'with', 'using', 'wearing', 'and', 'at', 'during', 'on'];
  if (skip.includes(word)) return object;
  const res = object.filter((obj) => {
    let ok = false;
    for (const tag of obj.tags) {
      const str = Object.values(tag) && Object.values(tag)[0] ? Object.values(tag)[0].toString() : '';
      ok |= str.startsWith(word.toLowerCase());
    }
    return ok;
  });
  return res;
}

// filters images based on search strings
function filterResults(words) {
  $('body').css('cursor', 'wait');
  window.filtered = window.results;
  previous = null;
  let foundWords = 0;
  for (const word of words.split(' ')) {
    window.filtered = filterWord(window.filtered, word);
    foundWords += (window.filtered && window.filtered.length > 0) ? 1 : 0;
  }
  if (window.filtered && window.filtered.length > 0) log.result(`Searching for "${words}" found ${foundWords} words in ${window.filtered.length || 0} results out of ${window.results.length} matches`);
  else log.result(`Searching for "${words}" found ${foundWords} of ${words.split(' ').length} terms`);
  redrawResults();
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
function sortResults(sort) {
  $('body').css('cursor', 'wait');
  log.result(`Sorting: ${sort}`);
  if (!window.filtered || window.filtered.length === 0) window.filtered = window.results;
  if (sort.includes('random')) shuffle(window.filtered);
  previous = null;
  // sort by
  if (sort.includes('alpha-down')) window.filtered.sort((a, b) => (a.image > b.image ? 1 : -1));
  if (sort.includes('alpha-up')) window.filtered.sort((a, b) => (a.image < b.image ? 1 : -1));
  if (sort.includes('numeric-down')) window.filtered.sort((a, b) => (b.exif.timestamp - a.exif.timestamp));
  if (sort.includes('numeric-up')) window.filtered.sort((a, b) => (a.exif.timestamp - b.exif.timestamp));
  if (sort.includes('amount-down')) window.filtered.sort((a, b) => (b.pixels - a.pixels));
  if (sort.includes('amount-up')) window.filtered.sort((a, b) => (a.pixels - b.pixels));
  if (sort.includes('simmilarity')) window.filtered.sort((a, b) => (a.simmilarity - b.simmilarity));
  // group by
  if (sort.includes('numeric-down') || sort.includes('numeric-up')) window.options.listDivider = 'month';
  else if (sort.includes('amount-down') || sort.includes('amount-up')) window.options.listDivider = 'size';
  else if (sort.includes('alpha-down') || sort.includes('alpha-up')) window.options.listDivider = 'folder';
  else if (sort.includes('simmilarity')) window.options.listDivider = 'simmilarity';
  else window.options.listDivider = '';
  $('#optionslist').toggle(false);
  redrawResults();
}

// find duplicate images based on pre-computed sha-256 hash
async function findDuplicates() {
  $('body').css('cursor', 'wait');
  const t0 = window.performance.now();
  previous = null;
  let duplicates = [];
  let duplicate;
  const length = window.results.length - 1;
  for (let i = 0; i < length + 1; i++) {
    const a = window.results[i];
    duplicate = false;
    for (let j = i + 1; j < length; j++) {
      const b = window.results[j];
      const distance = (a.hash === b.hash) ? 0 : (hash.distance(a.phash, b.phash) + 1);
      if (distance < 35) {
        a.simmilarity = distance;
        b.simmilarity = distance;
        duplicate = true;
        duplicates.push(b);
      }
      if (duplicate) duplicates.push(a);
    }
  }
  duplicates = [...new Set(duplicates)];
  if (window.filtered.length === duplicates.length) window.filtered = window.results;
  else window.filtered = duplicates;
  const t1 = window.performance.now();
  log.result(`Found ${window.filtered.length} simmilar images in ${Math.round(t1 - t0).toLocaleString()} ms`);
  sortResults('simmilarity');
}

// loads imagesm, displays gallery and enumerates sidebar
async function loadGallery(limit) {
  $('body').css('cursor', 'wait');
  const t0 = window.performance.now();
  log.result('Loading gallery ...');
  window.results.length = 0;
  if (window.options.liveLoad) {
    oboe({ url: `/api/get?limit=${limit}&find=all`, cached: true, withCredentials: false })
      .node('{image}', (image) => {
        image.id = window.results.length + 1;
        window.results.push(image);
        $('#number').text(window.results.length);
        printResult(image);
        enumerateFolders(image.image);
      // time: 15sec load, 10sec print, 3sec enumerate
      })
      .done((things) => {
        const t1 = window.performance.now();
        const size = JSON.stringify(window.results).length;
        log.result(`Received ${things.length} images: ${Math.round(t1 - t0).toLocaleString()} ms ${size.toLocaleString()} bytes ${Math.round(size / (t1 - t0)).toLocaleString()} KB/sec (live parse)`);
        window.filtered = window.results;
        resizeResults();
        sortResults(window.options.listSortOrder);
      });
  } else {
    const res = await fetch(`/api/get?limit=${limit}&find=all`);
    if (res) window.results = await res.json();
    for (let i = 0; i < window.results.length; i++) {
      window.results[i].id = i;
    }
    const t1 = window.performance.now();
    const size = JSON.stringify(window.results).length;
    log.result(`Received ${window.results.length} images: ${Math.round(t1 - t0).toLocaleString()} ms ${size.toLocaleString()} bytes ${Math.round(size / (t1 - t0)).toLocaleString()} KB/sec (bulk load)`);
    window.filtered = window.results;
    resizeResults();
    sortResults(window.options.listSortOrder);
  }
}

// popup on right-click
async function showContextPopup(evt) {
  evt.preventDefault();
  showTip(evt.target, `displaying ${window.filtered.length} of ${window.results.length} images`);
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
    const current = $('#results').scrollTop();
    const line = window.options.listThumbSize + 16;
    const page = $('#results').height() - window.options.listThumbSize;
    const bottom = $('#results').prop('scrollHeight');
    $('#results').stop();
    switch (event.keyCode) {
      case 38: $('#results').animate({ scrollTop: current - line }, 400); break; // key=up: scroll line up
      case 40: $('#results').animate({ scrollTop: current + line }, 400); break; // key=down; scroll line down
      case 33: $('#results').animate({ scrollTop: current - page }, 400); break; // key=pgup; scroll page up
      case 34: $('#results').animate({ scrollTop: current + page }, 400); break; // key=pgdn; scroll page down
      case 36: $('#results').animate({ scrollTop: 0 }, 1000); break; // key=home; scroll to top
      case 35: $('#results').animate({ scrollTop: bottom }, 1000); break; // key=end; scroll to bottom
      case 37: details.next(true); break; // key=left; previous image in details view
      case 39: details.next(false); break; // key=right; next image in details view
      case 191: $('#btn-search').click(); break; // key=/; open search input
      case 190: $('#btn-sort').click(); break; // key=.; open sort options
      case 188: $('#btn-desc').click(); break; // key=,; show/hide list descriptions
      case 220: loadGallery(); break; // key=\; refresh all
      case 27: // key=esc; close all
        $('#popup').toggle(false);
        $('#searchbar').toggle(false);
        $('#optionslist').toggle(false);
        $('#optionsview').toggle(false);
        $('#popup').toggle(false);
        slideshowRunning = false;
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
    slideshowRunning = false;
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
  $('#folderstitle').click(() => $('#folders').toggle('slow'));
  $('#locationstitle').click(() => $('#locations').toggle('slow'));
  $('#classestitle').click(() => $('#classes').toggle('slow'));
  $('#locations').toggle(false);
  $('#classes').toggle(false);
  $(window).resize(() => resizeViewport());
}

// initializes all mouse handlers for main menu in list view
function initListHandlers() {
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
    showNavbar($('#docs'));
    $('#docs').click(() => $('#docs').toggle('fast'));
    const res = await fetch('/README.md');
    const md = await res.text();
    if (md) $('#docs').html(marked(md));
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
    filterResults('');
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
    log.result('Starting slide show ...');
    slideshowRunning = true;
    details.show(window.filtered[0].image, window.filtered[0].image);
    setTimeout(startSlideshow, window.options.slideDelay);
  });

  // navbar livevideo
  // starts live video detection in a separate window
  $('#btn-video').click(() => {
    log.result('Starting Live Video interface ...');
    window.open('/video', '_blank');
  });

  // navbar images number
  $('#btn-number').click(() => {
    log.result('Reset filtered results');
    window.filtered = window.results;
    redrawResults();
  });
}

async function main() {
  // google analytics
  gtag('js', new Date());
  gtag('config', 'UA-155273-2', { page_path: `${location.pathname}` });
  gtag('set', { user_id: `${window.user}` }); // Set the user ID using signed-in user_id.

  // Register PWA
  if (config.registerPWA) pwa.register('/client/pwa-serviceworker.js');

  await resizeViewport();
  await initUser();
  await initListHandlers();
  await initSidebarHandlers();
  await initDetailsHandlers();
  await initHotkeys();
  await showNavbar();
  await loadGallery(window.options.listLimit);
}

window.onload = main;
