import config from './config.js';
import log from './log.js';

let results = [];
const div = {};

// pre-fetching DOM elements to avoid multiple runtime lookups
function initDivs() {
  div.Result = document.getElementById('result');
  div.Popup = document.getElementById('popup');
  div.PopupImage = document.getElementById('popup-image');
  div.PopupDetails = document.getElementById('popup-details');
  div.Found = document.getElementById('found');
  div.Toggle = document.getElementById('toggle');
  // eslint-disable-next-line no-use-before-define
  div.Toggle.addEventListener('click', (evt) => toggleDetails(evt));
  div.Filter = document.getElementById('filter');
  div.Filter.addEventListener('keyup', (event) => {
    event.preventDefault();
    // eslint-disable-next-line no-use-before-define
    if (event.keyCode === 13) filterResults(div.Filter.value);
  });
  div.canvas = document.getElementById('popup-canvas');
}

function toggleDetails() {
  if (div.Toggle.style.background === 'lightcoral') {
    div.Toggle.style.background = 'lightgreen';
    for (const item of document.getElementsByClassName('desc')) {
      item.style.display = 'inline  ';
    }
  } else {
    div.Toggle.style.background = 'lightcoral';
    for (const item of document.getElementsByClassName('desc')) {
      item.style.display = 'none';
    }
  }
}
// draw boxes for detected objects, faces and face elements
function drawBoxes(img, object) {
  div.canvas.style.position = 'absolute';
  div.canvas.style.left = img.offsetLeft;
  div.canvas.style.top = img.offsetTop;
  div.canvas.width = img.width;
  div.canvas.height = img.height;
  const ctx = div.canvas.getContext('2d');
  ctx.linewidth = 2;
  ctx.font = '16px Roboto';
  const resizeX = img.width / object.processedSize.width;
  const resizeY = img.height / object.processedSize.height;

  // draw detected objects
  if (object.detect) {
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
  if (object.person && object.person.face) {
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

// show details popup
async function showDetails() {
  const object = results[div.PopupImage.resid];
  if (!object) return;
  div.Popup.style.display = 'flex';

  let classified = 'Classified ';
  if (object.classify) for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;

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
    const mp = (div.PopupImage.naturalWidth * div.PopupImage.naturalHeight / 1000000).toFixed(1);
    const complexity = (div.PopupImage.naturalWidth * div.PopupImage.naturalHeight) / object.exif.bytes;
    if (object.exif.make) exif += `Camera: ${object.exif.make} ${object.exif.model || ''} ${object.exif.lens || ''}<br>`;
    if (object.exif.bytes) exif += `Size: ${mp} MP in ${object.exif.bytes.toLocaleString()} bytes with compression factor ${complexity.toFixed(2)}<br>`;
    if (object.exif.created) exif += `Taken: ${new Date(1000 * object.exif.created).toLocaleString()} Edited: ${new Date(1000 * object.exif.modified).toLocaleString()}<br>`;
    if (object.exif.software) exif += `Software: ${object.exif.software}<br>`;
    if (object.exif.exposure) exif += `Settings: ${object.exif.fov || 0}mm ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec<br>`;
  }
  let location = '';
  if (object.location && object.location.city) location += `Location: ${object.location.city}, ${object.location.country}, ${object.location.continent} (near ${object.location.near})<br>`;
  if (object.exif && object.exif.lat) location += `Coordinates: Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)}<br>`;

  div.PopupDetails.innerHTML = `
      <h2>Image: ${object.image}</h2>
      Image size: ${div.PopupImage.naturalWidth} x ${div.PopupImage.naturalHeight}
        Processed in ${object.perf.total.toFixed(0)} ms<br>
        Classified using ${config.classify ? config.classify.name : 'N/A'} in ${object.perf.classify.toFixed(0)} ms<br>
        Detected using ${config.detect ? config.detect.name : 'N/A'} in ${object.perf.detect.toFixed(0)} ms<br>
        Person using ${config.person ? config.person.name : 'N/A'} in ${object.perf.person.toFixed(0)} ms<br>
      <h2>Image Data</h2>
      ${exif}
      <h2>Location</h2>
      ${location}
      <h2>${classified}</h2>
      <h2>${detected}</h2>
      <h2>${person} ${nsfw}</h2>
      ${desc}
      </div>
    `;

  // const faceDetails = drawBoxes(div.PopupImage, object) || '';
  drawBoxes(div.PopupImage, object);

  div.Popup.onclick = () => { div.Popup.style.display = 'none'; };
}

// print results strip with thumbnail for a given object
async function printResult(object) {
  let classified = '';
  if (object.classify && object.classify[0]) {
    classified = 'Classified';
    for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  }
  let detected = '';
  if (object.detect && object.detect[0]) {
    detected = 'Detected';
    for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  }
  let person = '';
  if (object.person && object.person.age) {
    person = `Person | 
      Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} 
      Age: ${object.person.age.toFixed(1)} 
      Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
  }
  let nsfw = '';
  if (object.person && object.person.class) {
    nsfw = `Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class} `;
  }
  let location = '';
  if (object.location && object.location.city) {
    location = 'Location';
    location += ` | ${object.location.city}, ${object.location.country}, ${object.location.continent} (near ${object.location.near})`;
  }
  let camera = '';
  if (object.exif.make) {
    camera = 'Camera';
    camera += `: ${object.exif.make} ${object.exif.model || ''}`;
  }

  const divItem = document.createElement('div');
  divItem.class = 'col';
  divItem.style = 'display: flex';
  divItem.innerHTML = `
    <div class="col" style="max-height: ${config.thumbnail}px; min-width: ${config.thumbnail}px; max-width: ${config.thumbnail}px; padding: 0">
      <img id="thumb-${object.id}" src="${object.thumbnail}" align="middle" width="${config.thumbnail}px" height="${config.thumbnail}px">
    </div>
    <div id="desc-${object.id}" class="col desc" style="height: ${config.thumbnail}px; min-width: 564px; max-width: 564px; padding: 4px">
      <b>${decodeURI(object.image)}</b><br>
      Image: ${object.naturalSize.width}x${object.naturalSize.height} ${camera}<br>
      ${location}<br>
      ${classified}<br>
      ${detected}<br>
      ${person} ${nsfw}<br>
    </div>
  `;
  div.Result.appendChild(divItem);
  document.getElementById(`thumb-${object.id}`).resid = object.id;
  document.getElementById(`desc-${object.id}`).resid = object.id;
  divItem.addEventListener('click', (evt) => {
    div.PopupImage.resid = evt.target.resid;
    div.PopupImage.src = object.image; // this triggers showDetails via onLoad event
  });
  div.PopupImage.addEventListener('load', showDetails); // don't call showDetails directly to ensure image is loaded
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
  log.active('Searching ...');
  let found = results;
  let foundWords = 0;
  for (const word of words.split(' ')) {
    found = filterWord(found, word);
    foundWords += (found && found.length > 0) ? 1 : 0;
  }
  log.result(`Searching for "${words}" found ${foundWords} words in ${found.length || 0} results out of ${results.length} matches`);
  if (found && found.length > 0) div.Found.innerText = `Found ${found.length} results`;
  else div.Found.innerText = `Found ${foundWords} of ${words.split(' ').length} words`;
  div.Result.innerHTML = '';
  for (const obj of found) {
    printResult(obj);
  }
  log.active('Idle ...');
}

// calls main detectxion and then print results for all images matching spec
async function loadGallery() {
  log.result('Loading gallery ...');
  log.active('Loading gallery ...');
  const res = await fetch('/get?find=all');
  results = await res.json();
  log.result(`Received ${results.length} images in ${JSON.stringify(results).length} bytes`);
  for (const id in results) {
    results[id].id = id;
    log.active(`Printing: ${results[id].image}`);
    printResult(results[id]);
  }
  log.active('Idle ...');
}

async function main() {
  initDivs();
  log.init();
  log.active('Starting ...');
  await loadGallery();
}

window.onload = main;
