/* global moment */

import config from './config.js';
import log from './log.js';

let results = [];
let filtered = [];
const popupConfig = {
  showDetails: true,
  showBoxes: true,
  showFaces: true,
  rawView: false,
};
const listConfig = {
  showDetails: true,
  divider: '',
};

// draw boxes for detected objects, faces and face elements
function drawBoxes(img, object) {
  const canvas = document.getElementById('popup-canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = img.offsetLeft;
  canvas.style.top = img.offsetTop;
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.linewidth = 2;
  ctx.font = '16px Roboto';
  const resizeX = img.width / object.processedSize.width;
  const resizeY = img.height / object.processedSize.height;

  // draw detected objects
  if (popupConfig.showBoxes && object.detect) {
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
  if (popupConfig.showFaces && object.person && object.person.face) {
    // draw box around face
    const x = object.person.face.box.x * resizeX;
    const y = object.person.face.box.y * resizeY;
    ctx.strokeStyle = 'deepskyblue';
    ctx.fillStyle = 'deepskyblue';
    ctx.beginPath();
    ctx.rect(x, y, object.person.face.box.width * resizeX, object.person.face.box.height * resizeY);
    ctx.stroke();
    ctx.fillText('face', x + 2, y + 18);

    // draw face points
    ctx.fillStyle = 'lightblue';
    const pointSize = 2;
    for (const pt of object.person.face.points) {
      ctx.beginPath();
      ctx.arc(pt.x * resizeX, pt.y * resizeY, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }

    /*
    const jaw = object.person.boxes.landmarks.getJawOutline() || [];
    const nose = object.person.boxes.landmarks.getNose() || [];
    const mouth = object.person.boxes.landmarks.getMouth() || [];
    const leftEye = object.person.boxes.landmarks.getLeftEye() || [];
    const rightEye = object.person.boxes.landmarks.getRightEye() || [];
    const leftEyeBrow = object.person.boxes.landmarks.getLeftEyeBrow() || [];
    const rightEyeBrow = object.person.boxes.landmarks.getRightEyeBrow() || [];
    faceDetails = `Points jaw:${jaw.length} mouth:${mouth.length} nose:${nose.length} left-eye:${leftEye.length} right-eye:${rightEye.length} left-eyebrow:${leftEyeBrow.length} right-eyebrow:${rightEyeBrow.length}`;
    */
  }
}

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ');
}

// show details popup
async function showPopup() {
  const img = document.getElementById('popup-image');
  if (popupConfig.rawView) {
    window.open(img.img, '_blank');
    return;
  }
  $('#popup').toggle(true);
  const object = filtered.find((a) => a.image === img.img);
  if (!object) return;

  let classified = 'Classified ';
  if (object.classify) for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let alternative = 'Alternate ';
  if (object.alternative) for (const obj of object.alternative) alternative += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;

  let detected = 'Detected ';
  if (object.detect) for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;

  let person = '';
  if (object.person && object.person.age) {
    person = `Person | 
        Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} | 
        Age: ${object.person.age.toFixed(1)} | 
        Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
  }

  let nsfw = '';
  if (object.person && object.person.class) {
    nsfw = `Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class} `;
  }

  let desc = '<h2>Description:</h2><ul>';
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
    const mp = (img.naturalWidth * img.naturalHeight / 1000000).toFixed(1);
    const complexity = (img.naturalWidth * img.naturalHeight) / object.exif.bytes;
    if (object.exif.make) exif += `Camera: ${object.exif.make} ${object.exif.model || ''} ${object.exif.lens || ''}<br>`;
    if (object.exif.bytes) exif += `Size: ${mp} MP in ${object.exif.bytes.toLocaleString()} bytes with compression factor ${complexity.toFixed(2)}<br>`;
    if (object.exif.created) exif += `Taken: ${moment(1000 * object.exif.created).format('dddd YYYY/MM/DD')} Edited: ${moment(1000 * object.exif.modified).format('dddd YYYY/MM/DD')}<br>`;
    if (object.exif.software) exif += `Software: ${object.exif.software}<br>`;
    if (object.exif.exposure) exif += `Settings: ${object.exif.fov || 0}mm ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec<br>`;
  }
  let location = '';
  if (object.location && object.location.city) location += `Location: ${object.location.city}, ${object.location.state} ${object.location.country}, ${object.location.continent} (near ${object.location.near})<br>`;
  if (object.exif && object.exif.lat) location += `Coordinates: Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)}<br>`;

  const link = `<a class="download fa fa-arrow-alt-circle-down" style="font-size: 32px" href="${object.image}" download></a>`;
  const html = `
      <h2>Image: ${object.image}</h2>${link}
      Image size: ${img.naturalWidth} x ${img.naturalHeight}
        Processed in ${object.perf.total.toFixed(0)} ms<br>
        Classified using ${config.classify ? config.classify.name : 'N/A'} in ${object.perf.classify.toFixed(0)} ms<br>
        Alternative using ${config.alternative ? config.alternative.name : 'N/A'}<br>
        Detected using ${config.detect ? config.detect.name : 'N/A'} in ${object.perf.detect.toFixed(0)} ms<br>
        Person using ${config.person ? config.person.name : 'N/A'} in ${object.perf.person.toFixed(0)} ms<br>
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
      ${JSONtoStr(object.tags)}
      </div>
    `;
  if (popupConfig.showDetails) {
    $('#popup-details').toggle(true);
    $('#popup-image').css('max-width', '80vw');
    $('#popup-details').html(html);
  } else {
    $('#popup-details').toggle(false);
    $('#popup-image').css('max-width', '100vw');
  }
  drawBoxes(img, object);
}

async function showNextDetails(left) {
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
}

// adds dividiers based on sort order
let previous;
function addDividers(object) {
  if (listConfig.divider === 'month') {
    const curr = moment(1000 * object.exif.timestamp).format('MMMM, YYYY');
    const prev = moment(previous ? 1000 * previous.exif.timestamp : 0).format('MMMM, YYYY');
    if (curr !== prev) $('#results').append(`<div class="row divider">${curr}</div>`);
  }
  if (listConfig.divider === 'size') {
    const curr = Math.round(object.pixels / 1000 / 1000);
    const prev = Math.round((previous ? previous.pixels : 1) / 1000 / 1000);
    if (curr !== prev) $('#results').append(`<div class="row divider">Size: ${curr} MP</div>`);
  }
  if (listConfig.divider === 'folder') {
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
  let detected = '';
  if (object.detect && object.detect[0]) {
    detected = 'Detected';
    for (const obj of object.detect) detected += ` | ${obj.class}`;
  }
  let person = '';
  if (object.person && object.person.age) {
    person = `Gender ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} | Age ${object.person.age.toFixed(1)}`;
  }
  let nsfw = '';
  if (object.person && object.person.class) {
    nsfw = `Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class} `;
  }
  let location = '';
  if (object.location && object.location.city) {
    location = 'Location';
    location += ` | ${object.location.city}, ${object.location.state} ${object.location.country} (near ${object.location.near})`;
  }

  const timestamp = moment(1000 * object.exif.timestamp).format('dddd YYYY/MM/DD');
  const link = `<a class="download fa fa-arrow-alt-circle-down" href="${object.image}" download></a>`;
  const divItem = document.createElement('div');
  divItem.className = 'listitem';
  divItem.innerHTML = `
    <div class="col thumbnail" style="min-height: ${config.thumbnail}px; max-height: ${config.thumbnail}px; min-width: ${config.thumbnail}px; max-width: ${config.thumbnail}px">
      <img id="thumb-${object.id}" src="${object.thumbnail}" align="middle" width="${config.thumbnail}px" height="${config.thumbnail}px">
    </div>
    <div id="desc-${object.id}" class="col description">
      <b>${decodeURI(object.image)}</b>${link}<br>
      ${timestamp} | Size ${object.naturalSize.width} x ${object.naturalSize.height}<br>
      ${location}<br>
      ${classified}<br>
      ${detected}<br>
      ${person} ${nsfw}<br>
    </div>
  `;
  $('#results').append(divItem);
  $('.description').toggle(listConfig.showDetails);
  const divThumb = document.getElementById(`thumb-${object.id}`);
  divThumb.img = object.image;
  const img = document.getElementById('popup-image');
  img.addEventListener('load', showPopup);
  divThumb.addEventListener('click', (evt) => {
    img.img = evt.target.img;
    img.src = object.image; // this triggers showDetails via onLoad event(
  });
}

function filterWord(object, word) {
  if (!object) return null;
  const skip = ['in', 'a', 'the', 'of', 'with', 'using', 'wearing', 'and', 'at', 'during'];
  if (skip.includes(word)) return object;
  const res = object.filter((obj) => {
    let ok = false;
    for (const tag of obj.tags) {
      const str = Object.values(tag)[0].toString() || '';
      ok |= str.startsWith(word.toLowerCase());
    }
    return ok;
  });
  return res;
}

function filterResults(words) {
  filtered = results;
  previous = null;
  let foundWords = 0;
  for (const word of words.split(' ')) {
    filtered = filterWord(filtered, word);
    foundWords += (filtered && filtered.length > 0) ? 1 : 0;
  }
  if (filtered && filtered.length > 0) log.result(`Searching for "${words}" found ${foundWords} words in ${filtered.length || 0} results out of ${results.length} matches`);
  else log.result(`Searching for "${words}" found ${foundWords} of ${words.split(' ').length} terms`);

  $('#results').html('');
  $('#number').html(filtered.length);
  for (const obj of filtered) printResult(obj);
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
  previous = null;
  filtered = [];
  for (const obj of results) {
    const items = results.filter((a) => a.hash === obj.hash);
    if (items.length !== 1) filtered.push(...items);
  }
  filtered = [...new Set(filtered)];
  $('#results').html('');
  for (const obj of filtered) printResult(obj);
}

function sortResults(sort) {
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
  if (sort.includes('numeric-down') || sort.includes('numeric-up')) listConfig.divider = 'month';
  else if (sort.includes('amount-down') || sort.includes('amount-up')) listConfig.divider = 'size';
  else if (sort.includes('alpha-down') || sort.includes('alpha-up')) listConfig.divider = 'folder';
  else listConfig.divider = '';
  $('#results').html('');
  for (const obj of filtered) printResult(obj);
}

// calls main detectxion and then print results for all images matching spec
async function loadGallery() {
  log.result('Loading gallery ...');
  const res = await fetch('/get?find=all');
  results = await res.json();
  log.result(`Received ${results.length} images in ${JSON.stringify(results).length.toLocaleString()} bytes`);
  $('#number').html(results.length);
  $('#results').html('');
  for (const id in results) {
    results[id].id = id;
  }
  listConfig.divider = 'month';
  filtered = results.sort((a, b) => (b.exif.timestamp - a.exif.timestamp));
  for (const obj of filtered) {
    printResult(obj);
  }
}

// pre-fetching DOM elements to avoid multiple runtime lookups
function initHandlers() {
  // hide those elements initially
  $('#popup').toggle(false);
  $('#searchbar').toggle(false);
  $('#optionslist').toggle(false);
  $('#optionsview').toggle(false);

  // navbar
  $('#btn-search').click(() => {
    $('#optionslist').toggle(false);
    $('#optionsview').toggle(false);
    $('#searchbar').toggle('fast');
    $('#btn-search').toggleClass('fa-search fa-search-location');
    $('#search-input').focus();
  });

  $('#btn-list').click(() => {
    $('#searchbar').toggle(false);
    $('#optionsview').toggle(false);
    $('#optionslist').toggle('fast');
  });

  $('#btn-view').click(() => {
    $('#searchbar').toggle(false);
    $('#optionslist').toggle(false);
    $('#optionsview').toggle('fast');
  });

  $('#btn-update').click(() => {
    $('#searchbar').toggle(false);
    $('#optionslist').toggle(false);
    $('#optionsview').toggle(false);
    window.open('/process', '_blank');
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
  $('#btn-desc').click(() => {
    listConfig.showDetails = !listConfig.showDetails;
    $('.description').toggle('slow');
    $('#btn-desc').toggleClass('fa-eye fa-eye-slash');
  });

  $('#find-duplicates').click(() => {
    findDuplicates();
  });

  $('.sort').click((evt) => {
    sortResults(evt.target.className);
  });

  // navline-view
  $('#details-desc').click(() => {
    $('#details-desc').toggleClass('fa-comment fa-comment-slash');
    popupConfig.showDetails = !popupConfig.showDetails;
  });

  $('#details-boxes').click(() => {
    $('#details-boxes').toggleClass('fa-store fa-store-slash');
    popupConfig.showBoxes = !popupConfig.showBoxes;
  });

  $('#details-faces').click(() => {
    $('#details-faces').toggleClass('fa-head-side-cough fa-head-side-cough-slash');
    popupConfig.showFaces = !popupConfig.showFaces;
  });

  $('#details-raw').click(() => {
    $('#details-raw').toggleClass('fa-video fa-video-slash');
    popupConfig.rawView = !popupConfig.rawView;
  });

  // handle clicks inside popup
  $('#popup').click(() => {
    if (event.screenX < 50) showNextDetails(true);
    else if (event.screenX > window.innerWidth - 50) showNextDetails(false);
    else $('#popup').toggle('fast');
  });

  // handle keypresses on main
  $('html').keydown(() => {
    const current = $('#results').scrollTop();
    const page = $('#results').height();
    const bottom = $('#results').prop('scrollHeight');
    $('#results').stop();
    switch (event.keyCode) {
      case 33:
      case 36: $('#results').animate({ scrollTop: 0 }, 1000); break; // pgup or home
      case 34:
      case 35: $('#results').animate({ scrollTop: bottom }, 1000); break; // pgdn or end
      case 38: $('#results').animate({ scrollTop: current - page + 36 }, 400); break; // up
      case 40: $('#results').animate({ scrollTop: current + page - 36 }, 400); break; // down
      case 37: showNextDetails(true); break;
      case 39: showNextDetails(false); break;
      case 191: $('#btn-search').click(); break; // key=/
      case 190: $('#btn-sort').click(); break; // key=.
      case 32: $('#btn-desc').click(); break; // key=space
      case 82:
        $('#results').scrollTop(0);
        loadGallery();
        break; // r
      case 27:
        $('#searchbar').toggle(false);
        $('#sortbar').toggle(false);
        $('#sortbar').toggle(false);
        $('#configbar').toggle(false);
        $('#popup').toggle(false);
        break; // escape
      default: // log.result('Unhandled keydown event', event.keyCode);
    }
  });
}

async function main() {
  log.init();
  initHandlers();
  await loadGallery();
}

window.onload = main;
