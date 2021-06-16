import $ from 'jquery';
import moment from 'moment';
import * as log from '../shared/log';
import ColorThief from '../../assets/color-thief.umd';
import ImageViewer from './iv-viewer';
import * as config from '../shared/config';
import * as names from './names';

let viewer;
let thief;

let minScore = 0.0;

let images:Array<any> = [];

export function update(list) {
  images = list;
}

function isTextSelected(input: HTMLTextAreaElement | null = null) {
  const selectedText = document.getSelection()?.toString();
  if (selectedText && selectedText.length !== 0) {
    if (input) {
      input.focus();
      input.setSelectionRange(input.selectionStart, input.selectionEnd);
    }
    return true;
  }
  if (input && input.value.substring(input.selectionStart, input.selectionEnd).length !== 0) {
    input.focus();
    input.setSelectionRange(input.selectionStart, input.selectionEnd);
    return true;
  }
  return false;
}

function point(ctx, x, y, z = null) {
  const defaultColor = 'lightblue';
  const defaultSize = 2;
  ctx.fillStyle = z ? `rgba(${127.5 + (255 * (z || 0))}, ${127.5 - (255 * (z || 0))}, 255, 0.3)` : defaultColor;
  ctx.beginPath();
  ctx.arc(x, y, defaultSize, 0, 2 * Math.PI);
  ctx.fill();
}

function rect(ctx, x, y, width, height, radius = 5, lineWidth = 2, strokeStyle: string | null = null, fillStyle: string | null = null, alpha = 1, title: string | null = null) {
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
  const res:Array<{ score: number, name: string }> = [];
  if (!object || !(object.length > 0)) return res;
  const found:Array<string> = [];
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
  let palette = thief.getPalette(img, 16);
  if (!palette) return '';

  palette = palette.sort((i, j) => (i[0] + i[1] + i[2]) - (j[0] + j[1] + j[2]));
  $('#popup').css('background', `radial-gradient(at 50% 100%, rgb(${palette[1]}) 0, rgb(${palette[2]}) 100%, rgb(${palette[2]}) 100%)`);
  $('#popup').off('mousemove');
  $('#popup').on('mousemove', (event) => {
    const mouseXpercentage = Math.round(event.pageX / ($(window).width() || 0) * 100);
    const mouseYpercentage = Math.round(event.pageY / ($(window).height() || 0) * 100);
    if ($('#popup').css('display') !== 'none') {
      $('#popup').css('background', `radial-gradient(at ${mouseXpercentage}% ${mouseYpercentage}%, rgb(${palette[1]}) 0, rgb(${palette[2]}) 100%, rgb(${palette[2]}) 100%)`);
    }
  });

  let txt = '';
  for (const col of palette) txt += `<span class="palette" style="color: rgb(${col})" title="RGB: ${col}">■</span>\n`;
  return txt;
}

export function clear() {
  const canvas = document.getElementById('popup-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// draw boxes for detected objects, faces and face elements
let last;
export function drawBoxes(object: any | null = null) {
  const img = document.getElementsByClassName('iv-image')[0] as HTMLImageElement;
  const canvas = document.getElementById('popup-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  clear();
  canvas.style.left = `${img.offsetLeft}px`;
  canvas.style.top = `${img.offsetTop}px`;
  canvas.style.width = `${img.width}px`;
  canvas.style.height = `${img.height}px`;
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');

  if (object && object.image) last = object;
  else object = last;
  if (!object) return;

  (document.getElementById('detected-label') as HTMLElement).innerHTML = config.options.viewBoxes ? 'hide detected' : 'show detected';
  (document.getElementById('faces-label') as HTMLElement).innerHTML = config.options.viewFaces ? 'hide faces' : 'show faces';

  // move details panel to side or bottom depending on screen aspect ratio
  const ratioScreen = ($('#popup').width() || 0) / ($('#popup').height() || 0);
  const ratioImage = object.naturalSize.width / object.naturalSize.height;
  const imageMargin = (($('#popup').width() || 0) - ($('#popup-canvas').width() || 0)) / ($('#popup').width() || 0);
  let vertical = ratioImage < ratioScreen;
  if (vertical && imageMargin < 0.2) vertical = false; // move details to bottom if margin on the right is too small
  $('#popup').css('display', vertical ? 'flex' : 'block');

  const resizeX = img.width / object.processedSize.width;
  const resizeY = img.height / object.processedSize.height;

  // draw detected objects
  if (config.options.viewBoxes && object.detect) {
    for (const obj of object.detect) {
      if (obj.box && obj.score > minScore) {
        const x = (obj.box?.x || obj.box[0]) * resizeX;
        const y = (obj.box?.y || obj.box[1]) * resizeY;
        let width = (obj.box.width || obj.box[2]) * resizeX;
        let height = (obj.box.height || obj.box[3]) * resizeY;
        if (x + width > canvas.clientWidth) width = canvas.clientWidth - x;
        if (y + height > canvas.clientHeight) height = canvas.clientHeight - y;
        rect(ctx, x, y, width, height, 10, 4, 'lightyellow', null, 0.4, obj.class);
      }
    }
  }

  // draw faces
  if (config.options.viewFaces && object.person) {
    for (const person of object.person) {
      if (person.boxRaw && ((person.score || person.confidence) > minScore)) {
        // draw box around face
        const x = person.boxRaw[0] * resizeX * object.processedSize.width;
        const y = person.boxRaw[1] * resizeY * object.processedSize.height;
        let width = person.boxRaw[2] * resizeX * object.processedSize.width;
        let height = person.boxRaw[3] * resizeY * object.processedSize.height;
        if (x + width > canvas.width) width = canvas.width - x;
        if (y + height > canvas.height) height = canvas.height - y;
        const name = person.names && person.names.length > 0 ? person.names[0] : '';
        rect(ctx, x, y, width, height, 10, 3, 'deepskyblue', null, 0.6, `${name} ${person.gender} ${(person.age || 0).toFixed(1)}y`);
      }
      if (person.meshRaw && ((person.score || person.confidence) > minScore)) {
        for (const pt of person.meshRaw) {
          point(ctx, pt[0] * resizeX * object.processedSize.width, pt[1] * resizeY * object.processedSize.height, pt[2]);
        }
      }
    }
  }
}

export function drawDescription(object) {
  let filtered:Array<any> = [];
  const classifiedArr:Array<string> = [];
  filtered = object.classify.filter((a) => a.score > minScore);
  for (const obj of combine(filtered)) classifiedArr.push(`${obj.score}% <b>${obj.name}</b>`);
  const classified = classifiedArr.join(' | ');

  const detectedArr:Array<string> = [];
  filtered = object.detect.filter((a) => a.score > minScore);
  for (const obj of combine(filtered)) detectedArr.push(`${obj.score}% <b>${obj.name}</b>`);
  const detected = detectedArr.join(' | ');

  let nsfw = '';
  let person = '';
  filtered = object.person && object.person.length > 0 ? object.person.filter((a) => (a.score || a.confidence) > minScore) : [];
  for (const i in filtered) {
    person += `Person ${1 + parseInt(i)}: `;
    if (filtered[i].names && filtered[i].names.length > 0) person += `names: ${filtered[i].names.join(' ')} | `;
    if (filtered[i].score || filtered[i].confidence) person += `${(100 * (filtered[i].score || filtered[i].confidence)).toFixed(0)}% | `;
    if (filtered[i].genderScore > 0 && filtered[i].gender !== '') person += `gender: ${(100 * filtered[i].genderScore).toFixed(0)}% ${filtered[i].gender} | `;
    if (filtered[i].age > 0) person += `age: ${filtered[i].age.toFixed(1)} | `;
    if (filtered[i].emotionScore > 0 && filtered[i].emotion !== '') person += `emotion: ${(100 * filtered[i].emotionScore).toFixed(0)}% ${filtered[i].emotion}<br>`;
    if (filtered[i].class) nsfw += `Class: ${(100 * filtered[i].scoreClass).toFixed(0)}% ${filtered[i].class} `;
    if (filtered.length === 1) person = person.replace('Person 1', 'Person');
  }

  let desc = '<ul>';
  if (object.descriptions) {
    for (const description of object.descriptions) {
      for (const lines of description) {
        desc += `<li><b>${lines.name}</b>: <i>${lines.desc}</i></li>`;
      }
      if (description !== object.descriptions[object.descriptions.length - 1]) desc += '<br>';
    }
  }
  desc += '</ul>';

  let exif = `<b>Resolution</b>: ${object.naturalSize.width} x ${object.naturalSize.height}<br>`;
  if (object.exif) {
    if (object.exif.make) exif += `<b>Camera:</b> ${object.exif.make} ${object.exif.model || ''} ${object.exif.lens || ''}<br>`;
    if (object.exif.bytes) exif += `<b>Size:</b> ${(object.pixels / 1000 / 1000).toFixed(1)} MP in ${object.exif.bytes.toLocaleString()} bytes (compression factor ${(object.pixels / object.exif.bytes).toFixed(2)})<br>`;
    if (object.exif.ctime) exif += `<b>CTime:</b> ${moment(object.exif.ctime).format(config.options.dateLong)} <b>MTime:</b> ${moment(object.exif.mtime).format(config.options.dateLong)}<br>`;
    if (object.exif.created) exif += `<b>Created:</b> ${moment(object.exif.created).format(config.options.dateLong)} <b>Modified:</b> ${moment(object.exif.modified).format(config.options.dateLong)}<br>`;
    if (object.processed) exif += `<b>Processed:</b> ${moment(object.processed).format(config.options.dateLong)}<br>`;
    if (object.exif.software) exif += `<b>Software:</b> ${object.exif.software}<br>`;
    if (object.exif.exposure) exif += `<b>Settings:</b> ${object.exif.fov || 0}mm ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec<br>`;
  }

  let location = '';
  if (object.location && object.location.city) {
    location = `<b>${object.location.city}, ${object.location.state} ${object.location.country}, ${object.location.continent} (near ${object.location.near})</b><br>`;
  }
  if (object.exif && object.exif.lat) {
    location += `Coordinates: <a target="_blank" href="https://www.google.com/maps/@${object.exif.lat},${object.exif.lon},15z"> Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)} </a><br>`;
  }

  let conditions = object.tags.filter((a) => (a.conditions)).map((a) => a.conditions);
  if (conditions && conditions.length > 0) conditions = `<b>Conditions: ${conditions.join(', ')}</b>`;

  $('#details-download').off();
  $('#details-download').on('click', () => open(object.image, '_blank'));
  const html = `
      <table>
        <tr>
          <td><i class="descicon fad fa-camera"></i></td>
          <td><b>Image: ${object.image}</b><br>${exif}</td>
        </tr>
        <tr>
          <td><i class="descicon fad fa-location-circle"></i></td>
          <td>${location} ${conditions}</td>
        </tr>
        <tr>
          <td></td>
          <td>
            <label class="btntext" for="minscore">score filter &nbsp</label>
            <input type="range" style="height: 0.6rem;" class="thumbsize" name="minscore" id="minscore" min="0" max="1" step="0.05" value="${minScore}">
            &nbsp ${100 * minScore}%
          </td>
        </tr>
        <tr>
          <td><i class="descicon fad fa-image"></i></td>
          <td>${classified}</td>
        </tr>
        <tr>
          <td><i class="descicon fad fa-images"></i></td>
          <td>${detected}</td>
        </tr>
        <tr>
          <td><i class="descicon fad fa-user-friends"></i></td>
          <td>${person} ${nsfw}</td>
        </tr>
        <tr>
          <td><i class="descicon fad fa-palette"></i></td>
          <td>${getPalette()}</td>
        </tr>
        <tr>
          <td><i class="descicon fad fa-closed-captioning"></i></td>
          <td>${desc}</td>
        </tr>
        <tr>
          <td><i class="fad fa-tags"></i></td>
          <td><i>${log.str(object.tags)}</i></td>
        </tr>
      </table>
    `;
  $('#popup-details').html(html);
  $('#popup-details').show();
  // score filter handler
  $('#minscore').off('input');
  $('#minscore').on('input', () => {
    if (last) {
      minScore = parseFloat(($('#minscore')[0] as HTMLDataElement).value);
      log.debug('Filtering display by score:', minScore);
      drawBoxes(last);
      drawDescription(last);
    }
  });
  (document.getElementById('popup-details') as HTMLElement).scrollTop = 0;
}

async function resizeDetailsImage(object: any | null = null) {
  // wait for image to be loaded silly way as on load event doesn't trigger consistently
  const img = document.getElementsByClassName('iv-image')[0] as HTMLImageElement;
  if (!img || !img.complete) {
    setTimeout(() => resizeDetailsImage(object), 25);
  } else {
    $('.iv-image').css('cursor', 'zoom-in');
    // draw detection boxes and faces
    await viewer.zoom(100);
    await drawBoxes(object);
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
  $('#popup-details').html('');
  hideNavbar();
  const t0 = performance.now();
  if (!img && last) img = last.image;
  if (!img) return;
  if (config.options.viewRaw) {
    log.debug(t0, `Loading Raw image: ${img}`);
    open(img, '_blank');
    return;
  }
  // log.debug(t0, `Loading image: ${img}`);
  const object = images.find((a) => a.image === decodeURIComponent(img));
  if (!object) {
    log.debug(t0, `Could not find image: ${decodeURIComponent(img)}`);
    return;
  }

  log.debug('Displaying:', object);

  $('#popup').toggle(true);
  $('#optionsview').toggle(true);

  const el = document.getElementById('popup-image');
  if (!viewer) viewer = new ImageViewer(el, { zoomValue: 100, minZoom: 50, maxZoom: 500, zoomStep: 3, zoomSensitivity: 100, snapView: true, zoomWheel: true });
  viewer.load(object.thumbnail, img);
  await resizeDetailsImage(object);
  drawDescription(object);

  // handle pan&zoom redraws
  if (el && !(el as any).bound) {
    el.addEventListener('touchstart', clear, { passive: true });
    el.addEventListener('mousedown', clear, { passive: true });
    el.addEventListener('touchend', drawBoxes, { passive: true });
    el.addEventListener('mouseup', drawBoxes, { passive: true });
    el.addEventListener('dblclick', drawBoxes, { passive: true });
    el.addEventListener('wheel', drawBoxes, { passive: true });
    (el as any).bound = true;
  }
}

export async function next(left) {
  if ($('#popup').css('display') === 'none') return;
  clear();
  const img = $('.iv-image');
  if (!img || img.length < 1) return;
  const url = new URL((img[0] as HTMLImageElement).src);
  let id = images.findIndex((a) => a.image === decodeURIComponent(url.pathname.substr(1)));
  if (id === -1) return;
  id = left ? id - 1 : id + 1;
  if (id < 0) id = images.length - 1;
  if (id > images.length - 1) id = 0;
  const target = images[id];
  show(target.image);
}

// starts slideshow
let slideshowRunning;
export async function slideShow(start) {
  if (start) {
    next(false);
    slideshowRunning = setTimeout(() => slideShow(true), config.options.slideDelay);
  } else if (slideshowRunning) {
    clearTimeout(slideshowRunning);
    slideshowRunning = null;
  }
}

function detectSwipe() {
  const swipePos = { sX: 0, sY: 0, eX: 0, eY: 0 };
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
    let direction: null | string = null;
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

  $('#popup').off('click');
  $('#popup').on('click', (e) => {
    if (!isTextSelected() && !e.target.className.startsWith('iv-') && !e.target.className.startsWith('thumb')) {
      clear();
      $('#popup').toggle('fast');
      $('#optionsview').toggle(false);
    }
  });

  // navbar details previous
  $('#details-previous').off('click');
  $('#details-previous').on('click', () => next(true));

  // navbar details close
  $('#details-close').off('click');
  $('#details-close').on('click', () => {
    clear();
    slideShow(false);
    $('#popup').toggle('fast');
    $('#optionsview').toggle(false);
  });

  // navbar details next
  $('#details-next').off('click');
  $('#details-next').on('click', () => next(false));

  // navbar details show/hide details
  $('#details-desc').off('click');
  $('#details-desc').on('click', () => {
    config.options.viewDetails = !config.options.viewDetails;
    $('#popup-details').toggle(config.options.viewDetails);
    resizeDetailsImage();
  });

  // navbar details show/hide detection boxes
  $('#details-boxes').off('click');
  $('#details-boxes').on('click', () => {
    config.options.viewBoxes = !config.options.viewBoxes;
    drawBoxes();
  });

  // navbar details show/hide faces
  $('#details-faces').off('click');
  $('#details-faces').on('click', () => {
    config.options.viewFaces = !config.options.viewFaces;
    drawBoxes();
  });

  // navbar details name people
  $('#details-names').off('click');
  $('#details-names').on('click', () => {
    names.show(last);
  });

  // navbar details download image
  $('#details-raw').off('click');
  $('#details-raw').on('click', () => {
    config.options.viewRaw = !config.options.viewRaw;
  });
}
