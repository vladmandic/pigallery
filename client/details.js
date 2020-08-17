/* global ImageViewer, ColorThief */

const moment = require('moment');
const log = require('./log.js');

let viewer;
let thief;

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ');
}

// combine results from multiple model results
function combineResults(object) {
  const res = [];
  if (!object || !(object.length > 0)) return res;
  const found = [];
  const all = object
    .sort((a, b) => b.score - a.score)
    .filter((a) => {
      if (found.includes(a.class)) return false;
      found.push(a.class);
      return true;
    });
  for (const item of all) {
    res.push({ score: Math.round(item.score * 100), name: item.class });
  }
  return res;
}

function getPalette() {
  if (!thief) thief = new ColorThief();
  const img = document.getElementsByClassName('iv-image')[0];
  const color = thief.getColor(img);
  window.dominant = `rgb(${color})`;
  $('#popup').css('background', window.dominant);
  $('#optionsview').css('background', window.dominant);
  const palette = thief.getPalette(img, 15);
  let txt = '<div style="text-align: -webkit-center"><div style="width: 15rem">\n';
  txt += `<span class="palette" style="color: rgb(${color})" title="RGB: ${color}">■</span>\n`;
  for (const col of palette) txt += `<span class="palette" style="color: rgb(${col})" title="RGB: ${col}">■</span>\n`;
  txt += '</div></div>\n';
  return txt;
}

function clearBoxes() {
  const img = document.getElementsByClassName('iv-image')[0];
  const canvas = document.getElementById('popup-canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = `${img.offsetLeft}px`;
  canvas.style.top = `${img.offsetTop}px`;
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// draw boxes for detected objects, faces and face elements
let last;
function drawBoxes(object) {
  if (object) last = object;
  const img = document.getElementsByClassName('iv-image')[0];
  const canvas = document.getElementById('popup-canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = `${img.offsetLeft}px`;
  canvas.style.top = `${img.offsetTop}px`;
  canvas.width = Math.min($('#popup-image').width(), $('.iv-image').width()); // img.width;
  canvas.height = Math.min($('#popup-image').height(), $('.iv-image').height()); // img.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!object) object = last;
  if (!object) return;

  clearBoxes();
  const resizeX = img.width / object.processedSize.width;
  const resizeY = img.height / object.processedSize.height;

  // draw detected objects
  if (window.options.viewBoxes && object.detect) {
    ctx.strokeStyle = 'lightyellow';
    ctx.fillStyle = 'lightyellow';
    ctx.lineWidth = 4;
    for (const obj of object.detect) {
      const x = obj.box[0] * resizeX;
      const y = obj.box[1] * resizeY;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.rect(x, y, obj.box[2] * resizeX, obj.box[3] * resizeY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = 'small-caps 1rem Lato';
      ctx.fillText(`${(100 * obj.score).toFixed(0)}% ${obj.class}`, x + 2, y + 18);
    }
  }

  // draw faces
  if (window.options.viewFaces && object.person) {
    ctx.strokeStyle = 'deepskyblue';
    ctx.fillStyle = 'deepskyblue';
    ctx.lineWidth = 3;
    for (const i in object.person) {
      if (object.person[i].box) {
        // draw box around face
        const x = object.person[i].box.x * resizeX;
        const y = object.person[i].box.y * resizeY;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.rect(x, y, object.person[i].box.width * resizeX, object.person[i].box.height * resizeY);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = 'small-caps 1rem Lato';
        ctx.fillText(`face#${1 + parseInt(i, 10)}`, x + 2, y + 18);

        // draw face points
        ctx.fillStyle = 'lightblue';
        ctx.globalAlpha = 0.5;
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

async function resizeDetailsImage(object) {
  if (object) last = object;
  if (!last) return;
  // wait for image to be loaded silly way as on load event doesn't trigger consistently
  const img = document.getElementsByClassName('iv-image');
  if (!img || !img[0] || !img[0].complete) {
    setTimeout(() => resizeDetailsImage(object), 25);
  } else {
    // move details panel to side or bottom depending on screen aspect ratio
    const ratioScreen = $('#popup').width() / $('#popup').height();
    const ratioImage = last.naturalSize.width / last.naturalSize.height;
    const vertical = ratioImage < (ratioScreen + 0.3);
    $('#popup').css('display', vertical ? 'flex' : 'block');
    // resize panels
    $('.iv-image').css('cursor', 'zoom-in');
    document.getElementById('popup-image').style.width = vertical ? `${100 - window.options.listDetailsWidth}%` : '100%';
    $('#popup-image').width(vertical && window.options.viewDetails ? `${100 - window.options.listDetailsWidth}%` : '100%');
    $('#popup-image').height(!vertical && window.options.viewDetails ? `${100 - window.options.listDetailsWidth}%` : '100%');
    $('#popup-details').width(vertical && window.options.viewDetails ? `${window.options.listDetailsWidth}%` : '100%');
    $('#popup-details').height(!vertical && window.options.viewDetails ? `${window.options.listDetailsWidth}%` : '100%');
    const details = window.options.viewDetails ? 100.0 - window.options.listDetailsWidth : 100;
    const zoomX = $('#popup').width() * (vertical ? details / 100 : 1) / $('.iv-image').width();
    const zoomY = $('#popup').height() * (!vertical ? details / 100 : 1) / $('.iv-image').height();
    const zoom = Math.trunc(viewer._state.zoomValue * Math.min(zoomX, zoomY));
    await viewer.zoom(zoom);
    //  draw detection boxes and faces
    drawBoxes();
  }
}

async function hideNavbar() {
  $('#docs').hide();
  $('#searchbar').hide();
  $('#userbar').hide();
  $('#optionslist').hide();
  $('#optionsview').hide();
}

// show details popup
async function showDetails(img) {
  hideNavbar();
  const t0 = window.performance.now();
  if (!img && last) img = last.image;
  if (!img) return;
  if (window.options.viewRaw) {
    log.debug(t0, `Loading Raw image: ${img}`);
    window.open(img, '_blank');
    return;
  }
  log.debug(t0, `Loading image: ${img}`);
  const object = window.filtered.find((a) => a.image === decodeURI(img));
  if (!object) return;

  log.debug(null, 'Details for object', object);

  // const top = $('#navbar').height() + 6;
  $('#popup').toggle(true);
  $('#optionsview').toggle(true);

  $('#details-desc').removeClass('fa-comment fa-comment-slash');
  $('#details-desc').addClass(window.options.viewDetails ? 'fa-comment' : 'fa-comment-slash');
  $('#details-boxes').removeClass('fa-store fa-store-slash');
  $('#details-boxes').addClass(window.options.viewBoxes ? 'fa-comment' : 'fa-comment-slash');
  $('#details-faces').removeClass('fa-head-side-cough fa-head-side-cough-slash');
  $('#details-faces').addClass(window.options.viewFaces ? 'fa-head-side-cough' : 'fa-head-side-cough-slash');

  // http://ignitersworld.com/lab/imageViewer.html
  if (!viewer) {
    const div = document.getElementById('popup-image');
    viewer = new ImageViewer(div, { zoomValue: 500, maxZoom: 1000, snapView: true, refreshOnResize: true, zoomOnMouseWheel: true });
    window.viewer = viewer;
  }
  await viewer.load(object.thumbnail, img);
  resizeDetailsImage(object);

  // handle pan&zoom redraws
  $('.iv-large-image').on('touchstart mousedown', () => clearBoxes(object));
  $('.iv-large-image').on('touchend mouseup dblclick', () => drawBoxes(object));
  $('.iv-large-image').on('wheel mousewheel', () => setTimeout(() => drawBoxes(object), 200));

  let classified = 'Classified ';
  for (const obj of combineResults(object.classify)) classified += ` | <font color="${window.theme.link}">${obj.score}% ${obj.name}</font>`;

  let detected = 'Detected ';
  for (const obj of combineResults(object.detect)) detected += ` | <font color="${window.theme.link}">${obj.score}% ${obj.name}</font>`;

  let person = '';
  let nsfw = '';
  for (const i in object.person) {
    if (object.person[i].age) {
      person += `Person ${1 + parseInt(i, 10)} | 
          <font color="${window.theme.link}">gender: ${(100 * object.person[i].scoreGender).toFixed(0)}% ${object.person[i].gender}</font> | 
          <font color="${window.theme.link}">age: ${object.person[i].age.toFixed(1)}</font> | 
          <font color="${window.theme.link}">emotion: ${(100 * object.person[i].scoreEmotion).toFixed(0)}% ${object.person[i].emotion}<br></font>`;
    }
    if (object.person[i].class) {
      nsfw += `Class: ${(100 * object.person[i].scoreClass).toFixed(0)}% ${object.person[i].class} `;
    }
    if (object.person.length === 1) person = person.replace('Person 1', 'Person');
  }

  let desc = '<h2>Lexicon</h2><ul>';
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
    if (object.exif.make) exif += `<b>Camera:</b> ${object.exif.make} ${object.exif.model || ''} ${object.exif.lens || ''}<br>`;
    if (object.exif.bytes) exif += `<b>Size:</b> ${(object.pixels / 1000 / 1000).toFixed(1)} MP in ${object.exif.bytes.toLocaleString()} bytes (compression factor ${(object.pixels / object.exif.bytes).toFixed(2)})<br>`;
    if (object.exif.ctime) exif += `<b>CTime:</b> ${moment(object.exif.ctime).format(window.options.dateLong)} <b>MTime:</b> ${moment(object.exif.mtime).format(window.options.dateLong)}<br>`;
    if (object.exif.created) exif += `<b>Created:</b> ${moment(object.exif.created).format(window.options.dateLong)} <b>Modified:</b> ${moment(object.exif.modified).format(window.options.dateLong)}<br>`;
    if (object.processed) exif += `<b>Processed:</b> ${moment(object.processed).format(window.options.dateLong)}<br>`;
    if (object.exif.software) exif += `<b>Software:</b> ${object.exif.software}<br>`;
    if (object.exif.exposure) exif += `<b>Settings:</b> ${object.exif.fov || 0}mm ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec<br>`;
  }
  let location = '';
  if (object.location && object.location.city) {
    location += `
      Location: <font color="${window.theme.link}">${object.location.city}, ${object.location.state} ${object.location.country}, ${object.location.continent} (near ${object.location.near})</font><br>`;
  }
  if (object.exif && object.exif.lat) location += `Coordinates: <a target="_blank" href="https://www.google.com/maps/@${object.exif.lat},${object.exif.lon},15z"> Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)} </a><br>`;

  $('#details-download').off();
  $('#details-download').click(() => window.open(object.image, '_blank'));
  const html = `
      <h2>Image: <font color="${window.theme.link}">${object.image}</font></h2>
      <h2>Image Data</h2>
      <b>Resolution</b>: ${object.naturalSize.width} x ${object.naturalSize.height}<br>
      ${exif}
      <h2>Location</h2>
      ${location}
      <h2>Dominant Palette</h2>
      ${getPalette()}
      <h2>${classified}</h2>
      <h2>${detected}</h2>
      <h2>${person} ${nsfw}</h2>
      ${desc}
      <h2>Tags</h2>
        <i>${JSONtoStr(object.tags)}</i>
      </div>
    `;
  if (window.options.viewDetails) $('#popup-details').html(html);
  $('#popup-details').toggle(window.options.viewDetails);
}

async function showNextDetails(left) {
  if ($('#popup').css('display') === 'none') return;
  clearBoxes();
  const img = $('.iv-image');
  if (!img || img.length < 1) return;
  const url = new URL(img[0].src);
  let id = window.filtered.findIndex((a) => a.image === decodeURI(url.pathname.substr(1)));
  if (id === -1) return;
  id = left ? id - 1 : id + 1;
  if (id < 0) id = window.filtered.length - 1;
  if (id > window.filtered.length - 1) id = 0;
  const target = window.filtered[id];
  showDetails(target.image);
}

// starts slideshow
let slideshowRunning;
async function startSlideshow(start) {
  if (start) {
    showNextDetails(false);
    slideshowRunning = setTimeout(() => startSlideshow(true), window.options.slideDelay);
  } else if (slideshowRunning) {
    clearTimeout(slideshowRunning);
    slideshowRunning = null;
  }
}

function detectSwipe() {
  const swipePos = { sX: 0, sY: 0, eX: 0, eY: 0 };
  // function detectSwipe(el, func, deltaMin = 90)
  const deltaMin = 180;
  // Directions enumeration
  const directions = Object.freeze({ UP: 'up', DOWN: 'down', RIGHT: 'right', LEFT: 'left' });
  const el = document.getElementById('popup');
  el.addEventListener('touchstart', (e) => {
    swipePos.sX = e.touches[0].screenX;
    swipePos.sY = e.touches[0].screenY;
  });
  el.addEventListener('touchmove', (e) => {
    swipePos.eX = e.touches[0].screenX;
    swipePos.eY = e.touches[0].screenY;
  });
  el.addEventListener('touchend', () => {
    const deltaX = swipePos.eX - swipePos.sX;
    const deltaY = swipePos.eY - swipePos.sY;
    // min swipe distance, you could use absolute value rather than square. It just felt better for personnal use
    if (deltaX ** 2 + deltaY ** 2 < deltaMin ** 2) return;
    // direction
    let direction = null;
    if (deltaY === 0 || Math.abs(deltaX / deltaY) > 1) direction = deltaX > 0 ? directions.RIGHT : directions.LEFT;
    else direction = deltaY > 0 ? directions.UP : directions.DOWN;
    // if (direction && typeof func === 'function') func(el, direction);
    if (direction === directions.LEFT) showNextDetails(false);
    if (direction === directions.RIGHT) showNextDetails(true);
  });
}

// navbar details - used when in details view
function initDetailsHandlers() {
  // handle clicks inside details view

  detectSwipe();

  $('#popup').click(() => {
    // if (event.screenX < 20) showNextDetails(true);
    // else if (event.clientX > $('#popup').width() - 20) showNextDetails(false);
    if (!event.target.className.includes('iv-large-image') && !event.target.className.includes('iv-snap-handle') && !event.target.className.includes('iv-snap-view')) {
      clearBoxes();
      $('#popup').toggle('fast');
      $('#optionsview').toggle(false);
    }
  });

  // navbar details previous
  $('#details-previous').click(() => showNextDetails(true));

  // navbar details close
  $('#details-close').click(() => {
    clearBoxes();
    startSlideshow(false);
    $('#popup').toggle('fast');
    $('#optionsview').toggle(false);
  });

  // navbar details next
  $('#details-next').click(() => showNextDetails(false));

  // navbar details show/hide details
  $('#details-desc').click(() => {
    $('#details-desc').toggleClass('fa-comment fa-comment-slash');
    window.options.viewDetails = !window.options.viewDetails;
    $('#popup-details').toggle(window.options.viewDetails);
    resizeDetailsImage();
  });

  // navbar details show/hide detection boxes
  $('#details-boxes').click(() => {
    $('#details-boxes').toggleClass('fa-store fa-store-slash');
    window.options.viewBoxes = !window.options.viewBoxes;
    drawBoxes();
  });

  // navbar details show/hide faces
  $('#details-faces').click(() => {
    $('#details-faces').toggleClass('fa-head-side-cough fa-head-side-cough-slash');
    window.options.viewFaces = !window.options.viewFaces;
    drawBoxes();
  });

  // navbar details download image
  $('#details-raw').click(() => {
    $('#details-raw').toggleClass('fa-video fa-video-slash');
    window.options.viewRaw = !window.options.viewRaw;
  });
}

exports.show = showDetails;
exports.next = showNextDetails;
exports.boxes = drawBoxes;
exports.clear = clearBoxes;
exports.combine = combineResults;
exports.slideshow = startSlideshow;
exports.handlers = initDetailsHandlers;
