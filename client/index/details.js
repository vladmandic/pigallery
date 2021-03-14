// @ts-nocheck

import $ from 'jquery';
import moment from 'moment';
import * as log from '../shared/log';
import ColorThief from '../../assets/color-thief.umd';
import ImageViewer from './iv-viewer';

let viewer;
let thief;

function roundRect(ctx, x, y, width, height, radius = 5, lineWidth = 2, strokeStyle = null, fillStyle = null, alpha = 1, title = null) {
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.fillStyle = strokeStyle;
    ctx.stroke();
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  if (title) {
    ctx.font = 'small-caps 1rem Lato';
    ctx.fillStyle = 'black';
    ctx.fillText(title, x + 3, y + 16);
    ctx.fillStyle = strokeStyle;
    ctx.fillText(title, x + 4, y + 16);
  }
}

// combine results from multiple model results
export function combine(object) {
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
  const palette = thief.getPalette(img, 15);
  window.dominant = [`rgb(${color})`, `rgb(${palette[0]})`];
  $('#popup').css('background', `radial-gradient(at 50% 50%, ${window.dominant[1] || window.theme.gradient} 0, ${window.dominant[0] || window.theme.background} 100%, ${window.dominant[0] || window.theme.background} 100%)`);
  $('#optionsview').css('background', window.dominant[0]);
  let txt = '<div style="text-align: -webkit-center"><div style="width: 15rem">\n';
  txt += `<span class="palette" style="color: rgb(${color})" title="RGB: ${color}">■</span>\n`;
  for (const col of palette) txt += `<span class="palette" style="color: rgb(${col})" title="RGB: ${col}">■</span>\n`;
  txt += '</div></div>\n';
  return txt;
}

export function clear() {
  const canvas = document.getElementById('popup-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// draw boxes for detected objects, faces and face elements
let last;
export function drawBoxes(object) {
  if (object) last = object;
  const img = document.getElementsByClassName('iv-image')[0];
  const canvas = document.getElementById('popup-canvas');
  if (!canvas) return;
  canvas.style.left = `${img.offsetLeft}px`;
  canvas.style.top = `${img.offsetTop}px`;
  canvas.style.width = `${img.width}px`;
  canvas.style.height = `${img.height}px`;
  canvas.width = img.width;
  canvas.height = img.height;

  // move details panel to side or bottom depending on screen aspect ratio
  const ratioScreen = $('#popup').width() / $('#popup').height();
  const ratioImage = last.naturalSize.width / last.naturalSize.height;
  const vertical = ratioImage < ratioScreen;
  $('#popup').css('display', vertical ? 'flex' : 'block');
  if (vertical) $('#popup-details').height(`${document.getElementById('popup')?.clientHeight}px`);
  else $('#popup-details').height(`${document.getElementById('popup').clientHeight - document.getElementById('popup-canvas').clientHeight}px`);
  // canvas.style.width = `${canvas.width}px`;
  // canvas.style.height = `${canvas.height}px`;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!object) object = last;
  if (!object) return;

  clear();
  const resizeX = img.width / object.processedSize.width;
  const resizeY = img.height / object.processedSize.height;

  // draw detected objects
  if (window.options.viewBoxes && object.detect) {
    for (const obj of object.detect) {
      if (!obj.box) continue;
      const x = (obj.box?.x || obj.box[0]) * resizeX;
      const y = (obj.box?.y || obj.box[1]) * resizeY;
      let width = (obj.box.width || obj.box[2]) * resizeX;
      let height = (obj.box.height || obj.box[3]) * resizeY;
      if (x + width > canvas.clientWidth) width = canvas.clientWidth - x;
      if (y + height > canvas.clientHeight) height = canvas.clientHeight - y;
      roundRect(ctx, x, y, width, height, 10, 4, 'lightyellow', null, 0.4, obj.class);
    }
  }

  // draw faces
  if (window.options.viewFaces && object.person) {
    for (const i in object.person) {
      if (object.person[i].box) {
        // draw box around face
        const x = object.person[i].box[0] * resizeX;
        const y = object.person[i].box[1] * resizeY;
        let width = object.person[i].box[2] * resizeX;
        let height = object.person[i].box[3] * resizeY;
        if (x + width > canvas.width) width = canvas.width - x;
        if (y + height > canvas.height) height = canvas.height - y;
        roundRect(ctx, x, y, width, height, 10, 3, 'deepskyblue', null, 0.6, `${object.person[i].gender} ${object.person[i].age.toFixed(1)}y`);
        // draw face points
        /*
        ctx.fillStyle = 'lightblue';
        ctx.globalAlpha = 0.5;
        const pointSize = 2;
        for (const pt of object.person[i].points) {
          ctx.beginPath();
          ctx.arc(pt.x * resizeX, pt.y * resizeY, pointSize, 0, 2 * Math.PI);
          ctx.fill();
        }
        */
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
  const img = document.getElementsByClassName('iv-image')[0];
  if (!img || !img.complete) {
    setTimeout(() => resizeDetailsImage(object), 25);
  } else {
    // resize panels
    $('.iv-image').css('cursor', 'zoom-in');
    // const details = window.options.viewDetails ? 100.0 - window.options.listDetailsWidth : 100;
    // const zoomX = document.getElementById('popup').clientWidth * (vertical ? details / 100 : 1) / img.clientWidth;
    // const zoomY = document.getElementById('popup').clientHeight * (!vertical ? details / 100 : 1) / img.clientHeight;
    // const zoom = Math.trunc(viewer.state.zoomValue * Math.min(zoomX, zoomY));
    // draw detection boxes and faces
    await viewer.zoom(100);
    await drawBoxes();
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
export async function show(img) {
  hideNavbar();
  const t0 = performance.now();
  if (!img && last) img = last.image;
  if (!img) return;
  if (window.options.viewRaw) {
    log.debug(t0, `Loading Raw image: ${img}`);
    window.open(img, '_blank');
    return;
  }
  log.debug(t0, `Loading image: ${img}`);
  const object = window.filtered.find((a) => a.image === decodeURIComponent(img));
  if (!object) {
    log.debug(t0, `Could not find image: ${decodeURIComponent(img)}`);
    return;
  }

  log.debug('Details for object:', object);

  // const top = $('#navbar').height() + 6;
  $('#popup').toggle(true);
  $('#optionsview').toggle(true);

  $('#details-desc').removeClass('fa-comment fa-comment-slash');
  $('#details-desc').addClass(window.options.viewDetails ? 'fa-comment' : 'fa-comment-slash');
  $('#details-boxes').removeClass('fa-store fa-store-slash');
  $('#details-boxes').addClass(window.options.viewBoxes ? 'fa-store' : 'fa-store-slash');
  $('#details-faces').removeClass('fa-head-side-cough fa-head-side-cough-slash');
  $('#details-faces').addClass(window.options.viewFaces ? 'fa-head-side-cough' : 'fa-head-side-cough-slash');

  const el = document.getElementById('popup-image');
  if (!viewer) viewer = new ImageViewer(el, { zoomValue: 100, minZoom: 10, maxZoom: 1000, snapView: true, refreshOnResize: true, zoomOnMouseWheel: true });
  await viewer.load(object.thumbnail, img);
  resizeDetailsImage(object);

  // handle pan&zoom redraws
  if (el) {
    el.addEventListener('touchstart', () => clear(), { passive: true });
    el.addEventListener('mousedown', () => clear(), { passive: true });
    el.addEventListener('touchend', () => drawBoxes(object), { passive: true });
    el.addEventListener('mouseup', () => drawBoxes(object), { passive: true });
    el.addEventListener('dblclick', () => setTimeout(() => drawBoxes(object), 200), { passive: true });
    el.addEventListener('wheel', () => setTimeout(() => drawBoxes(object), 200), { passive: true });
    el.addEventListener('mousewheel', () => setTimeout(() => drawBoxes(object), 200), { passive: true });
  }

  let classified = 'Classified ';
  for (const obj of combine(object.classify)) classified += ` | <font color="${window.theme.link}">${obj.score}% ${obj.name}</font>`;

  let detected = 'Detected ';
  for (const obj of combine(object.detect)) detected += ` | <font color="${window.theme.link}">${obj.score}% ${obj.name}</font>`;

  let person = '';
  let nsfw = '';
  for (const i in object.person) {
    person += `Person ${1 + parseInt(i)} | `;
    if (object.person[i].genderScore > 0 && object.person[i].gender !== '') person += `<font color="${window.theme.link}">gender: ${(100 * object.person[i].genderScore).toFixed(0)}% ${object.person[i].gender}</font> | `;
    if (object.person[i].age > 0) person += `<font color="${window.theme.link}">age: ${object.person[i].age.toFixed(1)}</font> | `;
    if (object.person[i].emotionScore > 0 && object.person[i].emotion !== '') person += `<font color="${window.theme.link}">emotion: ${(100 * object.person[i].emotionScore).toFixed(0)}% ${object.person[i].emotion}<br></font>`;
    if (object.person[i].class) nsfw += `Class: ${(100 * object.person[i].scoreClass).toFixed(0)}% ${object.person[i].class} `;
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
      <font color="${window.theme.link}">${object.location.city}, ${object.location.state} ${object.location.country}, ${object.location.continent} (near ${object.location.near})</font><br>`;
  }
  if (object.exif && object.exif.lat) location += `Coordinates: <a target="_blank" href="https://www.google.com/maps/@${object.exif.lat},${object.exif.lon},15z"> Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)} </a><br>`;

  const conditions = object.tags.filter((a) => (a.conditions)).map((a) => a.conditions);

  $('#details-download').off();
  $('#details-download').click(() => window.open(object.image, '_blank'));
  const html = `
      <h2>Image: <font color="${window.theme.link}">${object.image}</font></h2>
      <h2>Image Data</h2>
      <b>Resolution</b>: ${object.naturalSize.width} x ${object.naturalSize.height}<br>
      ${exif}
      <h2>Location</h2>
      ${location}
      <h2>Conditions: ${conditions?.join(', ')}</h2>
      <h2>${classified}</h2>
      <h2>${detected}</h2>
      <h2>${person} ${nsfw}</h2>
      <h2>Dominant Palette</h2>
      ${getPalette()}
      ${desc}
      <h2>Tags</h2>
        <i>${log.str(object.tags)}</i>
      </div>
    `;
  if (window.options.viewDetails) $('#popup-details').html(html);
  document.getElementById('popup-details').scrollTop = 0;
  $('#popup-details').toggle(window.options.viewDetails);
}

export async function next(left) {
  if ($('#popup').css('display') === 'none') return;
  clear();
  const img = $('.iv-image');
  if (!img || img.length < 1) return;
  const url = new URL(img[0].src);
  let id = window.filtered.findIndex((a) => a.image === decodeURIComponent(url.pathname.substr(1)));
  if (id === -1) return;
  id = left ? id - 1 : id + 1;
  if (id < 0) id = window.filtered.length - 1;
  if (id > window.filtered.length - 1) id = 0;
  const target = window.filtered[id];
  show(target.image);
}

// starts slideshow
let slideshowRunning;
export async function slideShow(start) {
  if (start) {
    next(false);
    slideshowRunning = setTimeout(() => slideShow(true), window.options.slideDelay);
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
  if (!el) return;
  el.addEventListener('touchstart', (e) => {
    swipePos.sX = e.touches[0].screenX;
    swipePos.sY = e.touches[0].screenY;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    swipePos.eX = e.touches[0].screenX;
    swipePos.eY = e.touches[0].screenY;
  }, { passive: true });
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
    if (direction === directions.LEFT) next(false);
    if (direction === directions.RIGHT) next(true);
  }, { passive: true });
}

// navbar details - used when in details view
export function handlers() {
  // handle clicks inside details view

  detectSwipe();

  $('#popup').on('click', (e) => {
    // if (event.screenX < 20) showNextDetails(true);
    // else if (event.clientX > $('#popup').width() - 20) showNextDetails(false);
    if (!e.target.className.startsWith('iv-')) {
      clear();
      $('#popup').toggle('fast');
      $('#optionsview').toggle(false);
    }
  });

  // navbar details previous
  $('#details-previous').on('click', () => next(true));

  // navbar details close
  $('#details-close').on('click', () => {
    clear();
    slideShow(false);
    $('#popup').toggle('fast');
    $('#optionsview').toggle(false);
  });

  // navbar details next
  $('#details-next').on('click', () => next(false));

  // navbar details show/hide details
  $('#details-desc').on('click', () => {
    $('#details-desc').toggleClass('fa-comment fa-comment-slash');
    window.options.viewDetails = !window.options.viewDetails;
    $('#popup-details').toggle(window.options.viewDetails);
    resizeDetailsImage();
  });

  // navbar details show/hide detection boxes
  $('#details-boxes').on('click', () => {
    $('#details-boxes').toggleClass('fa-store fa-store-slash');
    window.options.viewBoxes = !window.options.viewBoxes;
    drawBoxes();
  });

  // navbar details show/hide faces
  $('#details-faces').on('click', () => {
    $('#details-faces').toggleClass('fa-head-side-cough fa-head-side-cough-slash');
    window.options.viewFaces = !window.options.viewFaces;
    drawBoxes();
  });

  // navbar details download image
  $('#details-raw').on('click', () => {
    $('#details-raw').toggleClass('fa-video fa-video-slash');
    window.options.viewRaw = !window.options.viewRaw;
  });
}
