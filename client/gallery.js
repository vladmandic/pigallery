/* eslint-disable no-underscore-dangle */
/* global moment, marked, Popper, ImageViewer */

import oboe from 'oboe';
import config from './config.js';
import log from './log.js';
import pwa from './pwa-register.js';

const results = [];
let filtered = [];
let folderList = [];
let viewer;
let last;

const options = {
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
  get dateShort() { return localStorage.getItem('dateShort') || 'YYYY/MM/DD'; },
  set dateShort(val) { return localStorage.setItem('dateShort', val); },
  get dateLong() { return localStorage.getItem('dateLong') || 'dddd, MMMM Do, YYYY'; },
  set dateLong(val) { return localStorage.setItem('dateLong', val); },
  get dateDivider() { return localStorage.getItem('dateDivider') || 'MMMM YYYY'; },
  set dateDivider(val) { return localStorage.setItem('dateDivider', val); },
  get fontSize() { return localStorage.getItem('fontSize') || '14px'; },
  set fontSize(val) { return localStorage.setItem('fontSize', val); },
};

// eslint-disable-next-line prefer-rest-params
function gtag() { window.dataLayer.push(arguments); }

function showTip(parent, text) {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.role = 'tooltip';
  tip.className = 'popper';
  tip.innerHTML = text;
  parent.appendChild(tip);
  let popper = Popper.createPopper(parent, tip, { placement: 'left', strategy: 'absolute', modifiers: [{ name: 'offset', options: { offset: [0, 20] } }] });
  setTimeout(() => {
    popper.destroy();
    popper = null;
    parent.removeChild(tip);
  }, 3000);
}

// draw boxes for detected objects, faces and face elements
function drawBoxes(object) {
  if (object) last = object;
  const img = document.getElementsByClassName('iv-image')[0];
  const canvas = document.getElementById('popup-canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = `${img.offsetLeft}px`;
  canvas.style.top = `${img.offsetTop}px`;
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.linewidth = 2;
  ctx.font = '16px Roboto';
  // eslint-disable-next-line no-param-reassign
  if (!object) object = last;

  const resizeX = img.width / object.processedSize.width;
  const resizeY = img.height / object.processedSize.height;

  // draw detected objects
  if (options.viewBoxes && object.detect) {
    ctx.strokeStyle = 'lightyellow';
    ctx.fillStyle = 'lightyellow';
    for (const obj of object.detect) {
      const x = obj.box[0] * resizeX;
      const y = obj.box[1] * resizeY;
      ctx.beginPath();
      ctx.rect(x, y, obj.box[2] * resizeX, obj.box[3] * resizeY);
      ctx.stroke();
      ctx.fillText(`${(100 * obj.score).toFixed(0)}% ${obj.class}`, x + 2, y + 18);
    }
  }

  // draw faces
  if (options.viewFaces && object.person) {
    for (const i in object.person) {
      if (object.person[i].box) {
        // draw box around face
        const x = object.person[i].box.x * resizeX;
        const y = object.person[i].box.y * resizeY;
        ctx.strokeStyle = 'deepskyblue';
        ctx.fillStyle = 'deepskyblue';
        ctx.beginPath();
        ctx.rect(x, y, object.person[i].box.width * resizeX, object.person[i].box.height * resizeY);
        ctx.stroke();
        ctx.fillText(`face#${1 + parseInt(i, 10)}`, x + 2, y + 18);

        // draw face points
        ctx.fillStyle = 'lightblue';
        const pointSize = 2;
        for (const pt of object.person[i].points) {
          ctx.beginPath();
          ctx.arc(pt.x * resizeX, pt.y * resizeY, pointSize, 0, 2 * Math.PI);
          ctx.fill();
        }
        /*
        const jaw = person.boxes.landmarks.getJawOutline() || [];
        const nose = person.boxes.landmarks.getNose() || [];
        const mouth = person.boxes.landmarks.getMouth() || [];
        const leftEye = person.boxes.landmarks.getLeftEye() || [];
        const rightEye = person.boxes.landmarks.getRightEye() || [];
        const leftEyeBrow = person.boxes.landmarks.getLeftEyeBrow() || [];
        const rightEyeBrow = person.boxes.landmarks.getRightEyeBrow() || [];
        faceDetails = `Points jaw:${jaw.length} mouth:${mouth.length} nose:${nose.length} left-eye:${leftEye.length} right-eye:${rightEye.length} left-eyebrow:${leftEyeBrow.length} right-eyebrow:${rightEyeBrow.length}`;
        */
      }
    }
  }
}

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ');
}

function resizeDetailsPanels() {
  // move details panel to side or bottom depending on screen aspect ratio
  if ($('#main').width() > $('#main').height()) {
    $('#popup').css('display', 'flex');
    if (options.viewDetails) {
      $('#popup-image').width('70vw');
      $('#popup-details').width('30vw');
    } else {
      $('#popup-image').width('100vw');
      $('#popup-details').width('0vw');
    }
    $('#popup-image').height('94vh'); // leave room for navbar
    $('#popup-details').height('94vh');
  } else {
    $('#popup').css('display', 'block');
    $('#popup-image').width('100vw');
    if (options.viewDetails) $('#popup-image').height('64vh');
    else $('#popup-image').height('100vh');
    $('#popup-details').width('100vw');
    $('#popup-details').height('30vh'); // leave room for navbar
  }
}

function resizeDetailsImage(object) {
  // wait for image to be loaded silly way as on load event doesn't trigger consistently
  const img = document.getElementsByClassName('iv-image');
  if (!img || !img[0] || !img[0].complete) {
    setTimeout(() => resizeDetailsImage(object), 25);
  } else {
    // move details panel to side or bottom depending on screen aspect ratio
    if ($('#main').width() > $('#main').height()) {
      $('#popup').css('display', 'flex');
      if (options.viewDetails) {
        $('#popup-image').width('70vw');
        $('#popup-details').width('30vw');
      } else {
        $('#popup-image').width('100vw');
        $('#popup-details').width('0vw');
      }
      $('#popup-image').height('94vh'); // leave room for navbar
      $('#popup-details').height('94vh');
    } else {
      $('#popup').css('display', 'block');
      $('#popup-image').width('100vw');
      if (options.viewDetails) $('#popup-image').height('64vh');
      else $('#popup-image').height('100vh');
      $('#popup-details').width('100vw');
      $('#popup-details').height('30vh'); // leave room for navbar
    }
    // zoom to fill usable screen area
    const zoomX = $('.iv-image-view').width() / $('.iv-image').width();
    const zoomY = $('.iv-image-view').height() / $('.iv-image').height();
    viewer.zoom(100 * Math.min(zoomX, zoomY));

    // move image to top left corner
    const offsetY = $('.iv-image').css('top');
    const offsetX = $('.iv-image').css('left');
    $('.iv-image').css('margin-top', `-${offsetY}`);
    $('.iv-image').css('margin-left', `-${offsetX}`);
    $('#popup-image').css('cursor', 'zoom-in');

    // move details panel to side or bottom depending on screen aspect ratio
    if ($('#main').width() > $('#main').height()) $('#popup-details').width(options.viewDetails ? $('#main').width() - $('.iv-image').width() : 0);
    else $('#popup-details').height(options.viewDetails ? $('#main').height() - $('.iv-image').height() : 0);
    // draw detection boxes and faces
    setTimeout(() => drawBoxes(object), 100);
  }
}

// show details popup
async function showDetails(thumb, img) {
  $('#popup-image').css('cursor', 'wait');
  if (options.viewRaw) {
    log.result(`Loading Raw image: ${img}`);
    window.open(img, '_blank');
    return;
  }
  $('body').css('cursor', 'wait');
  log.result(`Loading image: ${img}`);

  $('#popup').toggle(true);
  $('#optionsview').toggle(true);

  if (!viewer) {
    const div = document.getElementById('popup-image');
    viewer = new ImageViewer(div, { zoomValue: 100, maxZoom: 1000, snapView: true, refreshOnResize: true, zoomOnMouseWheel: true });
  }
  // http://ignitersworld.com/lab/imageViewer.html
  // viewer._events.imageLoad = imageLoad();
  viewer.load(thumb, img);

  const object = filtered.find((a) => a.image === img);
  if (!object) return;
  resizeDetailsPanels();
  resizeDetailsImage(object);

  // handle pan&zoom redraws
  $('.iv-large-image').click(() => drawBoxes());
  $('.iv-large-image').on('wheel', () => drawBoxes());

  let classified = 'Classified ';
  if (object.classify) for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let alternative = 'Alternate ';
  if (object.alternative) for (const obj of object.alternative) alternative += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;

  let detected = 'Detected ';
  if (object.detect) for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;

  let person = '';
  let nsfw = '';
  for (const i in object.person) {
    if (object.person[i].age) {
      person += `Person ${1 + parseInt(i, 10)} | 
          Gender: ${(100 * object.person[i].scoreGender).toFixed(0)}% ${object.person[i].gender} | 
          Age: ${object.person[i].age.toFixed(1)} | 
          Emotion: ${(100 * object.person[i].scoreEmotion).toFixed(0)}% ${object.person[i].emotion}<br>`;
    }
    if (object.person[i].class) {
      nsfw += `Class: ${(100 * object.person[i].scoreClass).toFixed(0)}% ${object.person[i].class} `;
    }
    if (object.person.length === 1) person = person.replace('Person 1', 'Person');
  }

  let desc = '<h2>Lexicon:</h2><ul>';
  if (object.descriptions) {
    for (const description of object.descriptions) {
      for (const lines of description) {
        desc += `<li><b>${lines.name}</b>: <i>${lines.desc}</i></li>`;
      }
      desc += '<br>';
    }
  }
  desc += '</ul>';

  let exif = '';
  if (object.exif) {
    const mp = (object.naturalSize.width * object.naturalSize.height / 1000000).toFixed(1);
    const complexity = mp / object.exif.bytes;
    if (object.exif.make) exif += `Camera: ${object.exif.make} ${object.exif.model || ''} ${object.exif.lens || ''}<br>`;
    if (object.exif.bytes) exif += `Size: ${mp} MP in ${object.exif.bytes.toLocaleString()} bytes with compression factor ${complexity.toFixed(2)}<br>`;
    if (object.exif.created) exif += `Taken: ${moment(1000 * object.exif.created).format(options.dateLong)} Edited: ${moment(1000 * object.exif.modified).format(options.dateLong)}<br>`;
    if (object.exif.software) exif += `Software: ${object.exif.software}<br>`;
    if (object.exif.exposure) exif += `Settings: ${object.exif.fov || 0}mm ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec<br>`;
  }
  let location = '';
  if (object.location && object.location.city) location += `Location: ${object.location.city}, ${object.location.state} ${object.location.country}, ${object.location.continent} (near ${object.location.near})<br>`;
  if (object.exif && object.exif.lat) location += `Coordinates: Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)}<br>`;

  $('#details-download').off();
  $('#details-download').click(() => window.open(object.image, '_blank'));
  // const btnDownload = `<a class="download fa fa-arrow-alt-circle-down" style="font-size: 32px" href="${object.image}" download></a>`;
  const html = `
      <h2>Image: ${object.image}</h2>
      Image size: ${object.naturalSize.width} x ${object.naturalSize.height}
      <h2>Image Data</h2>
      ${exif}
      <h2>Location</h2>
      ${location}
      <h2>${classified}</h2>
      <h2>${alternative}</h2>
      <h2>${detected}</h2>
      <h2>${person} ${nsfw}</h2>
      ${desc}
      <h2>Tags</h2>
      <h2>Processing Details</h2>
        Total time ${object.perf.total.toFixed(0)} ms<br>
        Processed on ${moment(object.processed).format(options.dateLong)} in ${object.perf.load.toFixed(0)} ms<br>
        Classified using ${config.classify ? config.classify.name : 'N/A'} in ${object.perf.classify.toFixed(0)} ms<br>
        Alternative using ${config.alternative ? config.alternative.name : 'N/A'}<br>
        Detected using ${config.detect ? config.detect.name : 'N/A'} in ${object.perf.detect.toFixed(0)} ms<br>
        Person using ${config.person ? config.person.name : 'N/A'} in ${object.perf.person.toFixed(0)} ms<br>
      <i>${JSONtoStr(object.tags)}</i>
      </div>
    `;
  if (options.viewDetails) $('#popup-details').html(html);
  $('#popup-details').toggle(options.viewDetails);
  $('body').css('cursor', 'pointer');
}

async function showNextDetails(left) {
  const img = $('.iv-image');
  if (!img || img.length < 1) return;
  const url = new URL(img[0].src);
  const id = filtered.findIndex((a) => a.image === decodeURI(url.pathname.substr(1)));
  if (id === -1) return;
  let target = filtered[id].image;
  if (left === true && id > 0 && filtered[id - 1]) target = filtered[id - 1].image;
  else if (left === false && id <= filtered.length && filtered[id + 1]) target = filtered[id + 1].image;
  showDetails(target, target);
  /*
  const img = document.getElementById('popup-image');
  const id = filtered.findIndex((a) => a.image === img.img);
  if (id === -1) return;
  if (left === true && id > 0 && filtered[id - 1]) {
    img.img = filtered[id - 1].image;
    img.src = filtered[id - 1].image;
  } else if (left === false && id <= filtered.length && filtered[id + 1]) {
    img.img = filtered[id + 1].image;
    img.src = filtered[id + 1].image;
  }
  */
}

// adds dividiers based on sort order
let previous;
function addDividers(object) {
  if (options.listDivider === 'month') {
    const curr = moment(1000 * object.exif.timestamp).format(options.dateDivider);
    const prev = moment(previous ? 1000 * previous.exif.timestamp : 0).format(options.dateDivider);
    if (curr !== prev) $('#results').append(`<div class="row divider">${curr}</div>`);
  }
  if (options.listDivider === 'size') {
    const curr = Math.round(object.pixels / 1000 / 1000);
    const prev = Math.round((previous ? previous.pixels : 1) / 1000 / 1000);
    if (curr !== prev) $('#results').append(`<div class="row divider">Size: ${curr} MP</div>`);
  }
  if (options.listDivider === 'folder') {
    const curr = object.image.substr(0, object.image.lastIndexOf('/'));
    const prev = previous ? previous.image.substr(0, previous.image.lastIndexOf('/')) : 'none';
    if (curr !== prev) $('#results').append(`<div class="row divider">${curr}</div>`);
  }
}

// print results strip with thumbnail for a given object
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

  const timestamp = moment(1000 * object.exif.timestamp).format(options.dateShort);
  const link = `<a class="download fa fa-arrow-alt-circle-down" href="${object.image}" download></a>`;
  const divItem = document.createElement('div');
  divItem.className = 'listitem';

  const root = window.user && window.user.root ? window.user.root : 'media/';
  divItem.innerHTML = `
    <div class="col thumbnail">
      <img class="thumbnail" id="thumb-${object.id}" src="${object.thumbnail}" align="middle" width=${options.listThumbSize}px height=${options.listThumbSize}px>
    </div>
    <div id="desc-${object.id}" class="col description">
      <p class="listtitle">${decodeURI(object.image).replace(root, '')}</p>${link}<br>
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
  divThumb.addEventListener('click', (evt) => showDetails(divThumb.src, evt.target.img));
}

function resizeResults() {
  const thumbSize = parseInt($('#thumbsize')[0].value, 10);
  if (thumbSize !== options.listThumbSize) {
    options.listThumbSize = thumbSize;
    $('#thumblabel').text(`Size: ${options.listThumbSize}px`);
    $('#thumbsize')[0].value = options.listThumbSize;
    $('.thumbnail').width(options.listThumbSize);
    $('.thumbnail').height(options.listThumbSize);
    // $('.listitem').css('min-height', `${Math.max(144, 16 + options.listThumbSize)}px`);
    // $('.listitem').css('max-height', '144px');
    $('.listitem').css('min-height', `${16 + options.listThumbSize}px`);
    $('.listitem').css('max-height', `${16 + options.listThumbSize}px`);
  }
}

async function enumerateFolders(input) {
  $('#folders').html('');
  if (input) {
    const path = input.substr(0, input.lastIndexOf('/'));
    const folders = path.split('/').filter((a) => a !== '');
    if (!folderList.find((a) => a.path === path)) folderList.push({ path, folders });
  } else {
    folderList = [];
    for (const item of filtered) {
      const path = item.image.substr(0, item.image.lastIndexOf('/'));
      const folders = path.split('/').filter((a) => a !== '');
      if (!folderList.find((a) => a.path === path)) folderList.push({ path, folders });
    }
  }
  for (let i = 0; i < 10; i++) {
    for (const item of folderList) {
      if (item.folders[i]) {
        const folder = item.folders[i];
        const parent = item.folders[i > 0 ? i - 1 : 0];
        let path = '';
        for (let j = 0; j <= i; j++) path += `${item.folders[j]}/`;
        const root = window.user && window.user.root ? window.user.root : 'media/';
        const name = folder === root.replace(/\//g, '') ? 'All' : folder;
        const html = `
          <li id="dir-${folder}">
            <span tag="${path}" style="padding-left: ${i * 16}px" class="folder">&nbsp
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

  // $('#folders').html(html);
  $('.folder').click((evt) => {
    $('body').css('cursor', 'wait');
    const path = $(evt.target).attr('tag');
    log.result(`Showing path: ${path}`);
    const root = window.user && window.user.root ? window.user.root : 'media/';
    if (path === root) filtered = results;
    else filtered = results.filter((a) => a.image.startsWith(path));
    // eslint-disable-next-line no-use-before-define
    redrawResults(false);
  });
}

async function redrawResults(generateFolders = true) {
  $('#number').html(filtered.length);
  $('#results').html('');
  if (generateFolders) enumerateFolders();
  for await (const obj of filtered) printResult(obj);
  $('.description').toggle(options.listDetails);
  await resizeResults();
  $('body').css('cursor', 'pointer');
}

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

function filterResults(words) {
  $('body').css('cursor', 'wait');
  filtered = results;
  previous = null;
  let foundWords = 0;
  for (const word of words.split(' ')) {
    filtered = filterWord(filtered, word);
    foundWords += (filtered && filtered.length > 0) ? 1 : 0;
  }
  if (filtered && filtered.length > 0) log.result(`Searching for "${words}" found ${foundWords} words in ${filtered.length || 0} results out of ${results.length} matches`);
  else log.result(`Searching for "${words}" found ${foundWords} of ${words.split(' ').length} terms`);
  redrawResults();
}

// Fisher-Yates (aka Knuth) Shuffle
function shuffle(array) {
  let currentIndex = array.length;
  let temporaryValue;
  let randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    // eslint-disable-next-line no-param-reassign
    array[currentIndex] = array[randomIndex];
    // eslint-disable-next-line no-param-reassign
    array[randomIndex] = temporaryValue;
  }
  return array;
}

function findDuplicates() {
  $('body').css('cursor', 'wait');
  previous = null;
  let duplicates = [];
  for (const obj of results) {
    const items = results.filter((a) => a.hash === obj.hash);
    if (items.length !== 1) duplicates.push(...items);
  }
  duplicates = [...new Set(duplicates)];
  if (filtered.length === duplicates.length) filtered = results;
  else {
    filtered = [...new Set(duplicates)];
    log.result(`Duplicates: ${filtered.length}`);
  }
  redrawResults();
}

function sortResults(sort) {
  $('body').css('cursor', 'wait');
  log.result(`Sorting: ${sort}`);
  if (!filtered || filtered.length === 0) filtered = results;
  if (sort.includes('random')) shuffle(filtered);
  previous = null;
  // sort by
  if (sort.includes('alpha-down')) filtered.sort((a, b) => (a.image > b.image ? 1 : -1));
  if (sort.includes('alpha-up')) filtered.sort((a, b) => (a.image < b.image ? 1 : -1));
  if (sort.includes('numeric-down')) filtered.sort((a, b) => (b.exif.timestamp - a.exif.timestamp));
  if (sort.includes('numeric-up')) filtered.sort((a, b) => (a.exif.timestamp - b.exif.timestamp));
  if (sort.includes('amount-down')) filtered.sort((a, b) => (b.pixels - a.pixels));
  if (sort.includes('amount-up')) filtered.sort((a, b) => (a.pixels - b.pixels));
  // how to group
  if (sort.includes('numeric-down') || sort.includes('numeric-up')) options.listDivider = 'month';
  else if (sort.includes('amount-down') || sort.includes('amount-up')) options.listDivider = 'size';
  else if (sort.includes('alpha-down') || sort.includes('alpha-up')) options.listDivider = 'folder';
  else options.listDivider = '';
  $('#optionslist').toggle(false);
  redrawResults();
}

// calls main detectxion and then print results for all images matching spec
async function loadGallery(limit) {
  $('body').css('cursor', 'wait');
  const t0 = window.performance.now();
  log.result('Loading gallery ...');
  results.length = 0;
  oboe(`/api/get?limit=${limit}&find=all`)
    .node('{image}', (image) => {
      // eslint-disable-next-line no-param-reassign
      image.id = results.length + 1;
      results.push(image);
      $('#number').text(results.length);
      printResult(image);
      enumerateFolders(image.image);
    })
    .done((things) => {
      const t1 = window.performance.now();
      const size = JSON.stringify(results).length;
      log.result(`Received ${things.length} images in ${Math.round(t1 - t0).toLocaleString()} ms ${size.toLocaleString()} bytes (${Math.round(size / (t1 - t0)).toLocaleString()} KB/sec)`);
      filtered = results;
      resizeResults();
      sortResults(options.listSortOrder);
    });
}

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
  $('body').css('fontSize', options.fontSize);
  $('#folderbar').toggle(options.listFolders);
  $('.description').toggle(options.listDetails);
  $('#thumbsize')[0].value = options.listThumbSize;
}

function showNavbar(elem) {
  if (elem) {
    elem.toggle('slow', () => {
      if (elem.css('display') === 'none') $('#results').css('margin-top', 0);
      else $('#results').css('margin-top', `${elem.height()}px`);
    });
  } else {
    $('#results').css('margin-top', 0);
  }
  // hide the rest
  // eslint-disable-next-line no-param-reassign
  elem = elem || $('#main');
  if (elem && elem[0] !== $('#popup')[0]) $('#popup').toggle(false);
  if (elem && elem[0] !== $('#docs')[0]) $('#docs').toggle(false);
  if (elem && elem[0] !== $('#searchbar')[0]) $('#searchbar').toggle(false);
  if (elem && elem[0] !== $('#userbar')[0]) $('#userbar').toggle(false);
  if (elem && elem[0] !== $('#optionslist')[0]) $('#optionslist').toggle(false);
  if (elem && elem[0] !== $('#optionsview')[0]) $('#optionsview').toggle(false);
}

// handle keypresses on main
async function initHotkeys() {
  $('html').keydown(() => {
    const current = $('#results').scrollTop();
    const line = options.listThumbSize + 16;
    const page = $('#results').height() - options.listThumbSize;
    const bottom = $('#results').prop('scrollHeight');
    $('#results').stop();
    switch (event.keyCode) {
      case 38: $('#results').animate({ scrollTop: current - line }, 400); break; // key=up: scroll line up
      case 40: $('#results').animate({ scrollTop: current + line }, 400); break; // key=down; scroll line down
      case 33: $('#results').animate({ scrollTop: current - page }, 400); break; // key=pgup; scroll page up
      case 34: $('#results').animate({ scrollTop: current + page }, 400); break; // key=pgdn; scroll page down
      case 36: $('#results').animate({ scrollTop: 0 }, 1000); break; // key=home; scroll to top
      case 35: $('#results').animate({ scrollTop: bottom }, 1000); break; // key=end; scroll to bottom
      case 37: showNextDetails(true); break; // key=left; previous image in details view
      case 39: showNextDetails(false); break; // key=right; next image in details view
      case 191: $('#btn-search').click(); break; // key=/; open search input
      case 190: $('#btn-sort').click(); break; // key=.; open sort options
      case 188: $('#btn-desc').click(); break; // key=,; show/hide list descriptions
      case 220: loadGallery(); break; // key=\; refresh all
      case 27:
        $('#popup').toggle(false);
        $('#searchbar').toggle(false);
        $('#optionslist').toggle(false);
        $('#optionsview').toggle(false);
        $('#popup').toggle(false);
        // filterResults('');
        break; // key=esc; close all
      default: // log.result('Unhandled keydown event', event.keyCode);
    }
  });
}

// pre-fetching DOM elements to avoid multiple runtime lookups
function initHandlers() {
  // navbar
  $('#btn-user').click(() => {
    showNavbar($('#userbar'));
    $('#imagenum')[0].value = options.listLimit;
    $('#imagenum')[0].focus();
  });

  $('#btn-load').click((evt) => {
    options.listLimit = parseInt($('#imagenum')[0].value, 10);
    showTip(evt.target, `Loading maximum of ${options.listLimit} latest images`);
    loadGallery(options.listLimit);
  });

  $('#imagenum').keyup(() => {
    if (event.keyCode === 13) {
      $('#btn-load').click();
      showNavbar();
    }
  });

  // navline-userbar
  $('#btn-logout').click(() => {
    showNavbar();
    $.post('/client/auth.html');
    if ($('#btn-user').hasClass('fa-user-slash')) window.location = '/client/auth.html';
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    window.location.reload(false);
  });

  $('#btn-search').click(() => {
    showNavbar($('#searchbar'));
    $('#btn-search').toggleClass('fa-search fa-search-location');
    $('#search-input').focus();
  });

  $('#btn-list').click(() => {
    showNavbar($('#optionslist'));
  });

  $('#btn-view').click(() => {
    showNavbar($('#optionsview'));
  });

  $('#btn-doc').click(async () => {
    showNavbar($('#docs'));
    $('#docs').click(() => $('#docs').toggle('fast'));
    const res = await fetch('/README.md');
    const md = await res.text();
    if (md) $('#docs').html(marked(md));
  });

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

  // starts live video detection in a separate window
  $('#btn-video').click(() => {
    log.result('Starting Live Video interface ...');
    window.open('/video', '_blank');
  });

  // navline-search
  $('#search-input').keyup(() => {
    event.preventDefault();
    if (event.keyCode === 191) $('#search-input')[0].value = ''; // reset on key=/
    if (event.keyCode === 13) filterResults($('#search-input')[0].value);
  });

  $('#btn-searchnow').click(() => {
    filterResults($('#search-input')[0].value);
  });

  $('#btn-resetsearch').click(() => {
    $('#search-input')[0].value = '';
    filterResults('');
  });

  // navline-list
  $('#btn-folder').click(() => {
    $('#folderbar').toggle('slow');
    $('#btn-folder').toggleClass('fa-folder fa-folder-open');
    options.listFolders = !options.listFolders;
  });

  $('#btn-desc').click(() => {
    options.listDetails = !options.listDetails;
    $('.description').toggle('slow');
    $('#btn-desc').toggleClass('fa-comment fa-comment-slash');
  });

  $('#btn-duplicates').click(() => {
    $('#btn-duplicates').toggleClass('fa-eye fa-eye-slash');
    findDuplicates();
  });

  $('.sort').click((evt) => {
    options.listSortOrder = evt.target.className;
    sortResults(evt.target.className);
  });

  $('#thumbsize').on('input', () => {
    resizeResults();
  });

  // navline-view
  $('#details-close').click(() => {
    drawBoxes(null);
    $('#popup').toggle('fast');
    $('#optionsview').toggle(false);
  });

  $('#details-previous').click(() => {
    showNextDetails(true);
  });

  $('#details-next').click(() => {
    showNextDetails(false);
  });

  $('#details-desc').click(() => {
    $('#details-desc').toggleClass('fa-comment fa-comment-slash');
    options.viewDetails = !options.viewDetails;
    $('#popup-details').toggle(options.viewDetails);
  });

  $('#details-boxes').click(() => {
    $('#details-boxes').toggleClass('fa-store fa-store-slash');
    options.viewBoxes = !options.viewBoxes;
    // const hidden = options.viewBoxes ? 'visible' : 'hidden';
    // $('#popup-canvas').css('visibility', hidden);
    drawBoxes();
  });

  $('#details-faces').click(() => {
    $('#details-faces').toggleClass('fa-head-side-cough fa-head-side-cough-slash');
    options.viewFaces = !options.viewFaces;
    drawBoxes();
  });

  $('#details-raw').click(() => {
    $('#details-raw').toggleClass('fa-video fa-video-slash');
    options.viewRaw = !options.viewRaw;
  });

  // handle clicks inside popup
  $('#popup').click(() => {
    if (event.screenX < 50) showNextDetails(true);
    else if (event.clientX > $('#popup').width() - 50) showNextDetails(false);
    else if (!event.target.className.includes('iv-large-image')) {
      drawBoxes(null);
      $('#popup').toggle('fast');
      $('#optionsview').toggle(false);
    }
  });
}

async function main() {
  // google analytics
  gtag('js', new Date());
  gtag('config', 'UA-155273-2', { page_path: `${location.pathname}` });
  gtag('set', { user_id: `${window.user}` }); // Set the user ID using signed-in user_id.

  // Register PWA
  if (config.registerPWA) pwa.register('/client/pwa-serviceworker.js');

  await initUser();
  await initHandlers();
  await initHotkeys();
  await showNavbar();
  await loadGallery(options.listLimit);
}

window.onload = main;
