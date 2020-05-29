/* global ImageViewer */

import moment from 'moment';
import log from './log.js';
import config from './config.js';

let viewer;
let last;

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ');
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
  if (!object) return;

  const resizeX = img.width / object.processedSize.width;
  const resizeY = img.height / object.processedSize.height;

  // draw detected objects
  if (window.options.viewBoxes && object.detect) {
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
  if (window.options.viewFaces && object.person) {
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

async function resizeDetailsImage(object) {
  // wait for image to be loaded silly way as on load event doesn't trigger consistently
  const img = document.getElementsByClassName('iv-image');
  const width = $('#popup').width();
  const height = $('#popup').height();
  if (!img || !img[0] || !img[0].complete) {
    setTimeout(() => resizeDetailsImage(object), 25);
  } else {
    // move details panel to side or bottom depending on screen aspect ratio
    // use 70% or 100% depending if details text is enabled
    if (width > height) {
      $('#popup').css('display', 'flex');
      if (window.options.viewDetails) {
        $('#popup-details').width(window.options.listDetailsWidth * width);
        $('#popup-image').width((1 - window.options.listDetailsWidth) * width);
      } else {
        $('#popup-details').width('0');
        $('#popup-image').width(width);
      }
      $('#popup-image').height(height);
      $('#popup-details').height(height);
    } else {
      $('#popup').css('display', 'block');
      $('#popup-details').width(width);
      $('#popup-details').height(window.options.listDetailsWidth * height);
      $('#popup-image').width(width);
      if (window.options.viewDetails) $('#popup-image').height((1 - window.options.listDetailsWidth) * height);
      else $('#popup-image').height(height);
    }

    // zoom to fill usable screen area
    const zoomX = $('.iv-image-view').width() / $('.iv-image').width();
    const zoomY = $('.iv-image-view').height() / $('.iv-image').height();
    await viewer.zoom(100 * Math.min(zoomX, zoomY));

    // move image to top left corner
    const offsetY = $('.iv-image').css('top');
    const offsetX = $('.iv-image').css('left');
    $('.iv-image').css('margin-top', `-${offsetY}`);
    $('.iv-image').css('margin-left', `-${offsetX}`);
    $('#popup-image').css('cursor', 'zoom-in');

    // draw detection boxes and faces
    drawBoxes(object);
  }
}

// show details popup
async function showDetails(thumb, img) {
  $('#popup-image').css('cursor', 'wait');
  if (window.options.viewRaw) {
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

  const object = window.filtered.find((a) => a.image === img);
  if (!object) return;

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
    if (object.exif.make) exif += `<b>Camera:</b> ${object.exif.make} ${object.exif.model || ''} ${object.exif.lens || ''}<br>`;
    if (object.exif.bytes) exif += `<b>Size:</b> ${(object.pixels / 1000 / 1000).toFixed(1)} MP in ${object.exif.bytes.toLocaleString()} bytes (compression factor ${(object.pixels / object.exif.bytes).toFixed(2)})<br>`;
    if (object.exif.created) exif += `<b>Taken:</b> ${moment(object.exif.created).format(window.options.dateLong)} <b>Edited:</b> ${moment(object.exif.modified).format(window.options.dateLong)}<br>`;
    if (object.exif.software) exif += `<b>Software:</b> ${object.exif.software}<br>`;
    if (object.exif.exposure) exif += `<b>Settings:</b> ${object.exif.fov || 0}mm ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec<br>`;
  }
  let location = '';
  if (object.location && object.location.city) location += `Location: ${object.location.city}, ${object.location.state} ${object.location.country}, ${object.location.continent} (near ${object.location.near})<br>`;
  if (object.exif && object.exif.lat) location += `Coordinates: Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)}<br>`;

  $('#details-download').off();
  $('#details-download').click(() => window.open(object.image, '_blank'));
  // const btnDownload = `<a class="download fa fa-arrow-alt-circle-down" style="font-size: 32px" href="${object.image}" download></a>`;
  const html = `
      <h2>Image: ${object.image}</h2>
      <b>Image size</b>: ${object.naturalSize.width} x ${object.naturalSize.height}
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
        Processed on ${moment(object.processed).format(window.options.dateLong)} in ${object.perf.load.toFixed(0)} ms<br>
        Classified using ${config.classify ? config.classify.name : 'N/A'} in ${object.perf.classify.toFixed(0)} ms<br>
        Alternative using ${config.alternative ? config.alternative.name : 'N/A'}<br>
        Detected using ${config.detect ? config.detect.name : 'N/A'} in ${object.perf.detect.toFixed(0)} ms<br>
        Person using ${config.person ? config.person.name : 'N/A'} in ${object.perf.person.toFixed(0)} ms<br>
      <i>${JSONtoStr(object.tags)}</i>
      </div>
    `;
  if (window.options.viewDetails) $('#popup-details').html(html);
  $('#popup-details').toggle(window.options.viewDetails);
  $('body').css('cursor', 'pointer');
}

async function showNextDetails(left) {
  const img = $('.iv-image');
  if (!img || img.length < 1) return;
  const url = new URL(img[0].src);
  let id = window.filtered.findIndex((a) => a.image === decodeURI(url.pathname.substr(1)));
  if (id === -1) return;
  id = left ? id - 1 : id + 1;
  if (id < 0) id = window.filtered.length - 1;
  if (id > window.filtered.length - 1) id = 0;
  const target = window.filtered[id];
  showDetails(target.thumbnail, target.image);
}

exports.show = showDetails;
exports.next = showNextDetails;
exports.boxes = drawBoxes;
