// import * as nsfwjs from 'nsfwjs';
// import yolo from './modelYolo.js';
import * as faceapi from 'face-api.js';
import config from './config.js';
import log from './log.js';
import * as ml from './processImage.js';

const results = [];
const div = {};

// pre-fetching DOM elements to avoid multiple runtime lookups
function initDivs() {
  div.Result = document.getElementById('result');
  div.Popup = document.getElementById('popup');
  div.PopupImage = document.getElementById('popup-image');
  div.PopupDetails = document.getElementById('popup-details');
  div.canvas = document.getElementById('popup-canvas');
}

// draw boxes for detected objects, faces and face elements
function drawBoxes(img, object) {
  div.canvas.style.position = 'absolute';
  div.canvas.style.left = img.offsetLeft;
  div.canvas.style.top = img.offsetTop;
  div.canvas.width = img.width;
  div.canvas.height = img.height;

  // draw faces
  let faceDetails;
  if (object.person && object.person.detections) {
    const displaySize = { width: div.canvas.width, height: div.canvas.height };
    faceapi.matchDimensions(div.canvas, displaySize);
    const resized = faceapi.resizeResults(object.person.detections.detection, displaySize);
    new faceapi.draw.DrawBox(resized.detection.box, { boxColor: 'lightskyblue' }).draw(div.canvas);
    new faceapi.draw.DrawFaceLandmarks(resized.landmarks, { lineColor: 'skyblue', pointColor: 'deepskyblue' }).draw(div.canvas);
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

  // draw detected objects
  const ctx = div.canvas.getContext('2d');
  ctx.strokeStyle = 'lightyellow';
  ctx.linewidth = 2;
  if (object.detect) {
    for (const obj of object.detect) {
      ctx.beginPath();
      const x = obj.box[0] * img.width / object.processedSize.width;
      const y = obj.box[1] * img.height / object.processedSize.height;
      const width = obj.box[2] * img.width / object.processedSize.width;
      const height = obj.box[3] * img.height / object.processedSize.height;
      ctx.rect(x, y, width, height);
      ctx.stroke();
      ctx.fillStyle = 'lightyellow';
      ctx.font = '16px Roboto';
      ctx.fillText(`${(100 * obj.score).toFixed(0)}% ${obj.class}`, x + 2, y + 18);
    }
  }
  return faceDetails;
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
  let location = '';
  if (object.exif) {
    const mp = (div.PopupImage.naturalWidth * div.PopupImage.naturalHeight / 1000000).toFixed(1);
    const complexity = (div.PopupImage.naturalWidth * div.PopupImage.naturalHeight) / object.exif.bytes;
    if (object.exif.make) exif += `Camera: ${object.exif.make} ${object.exif.model || ''} ${object.exif.lens || ''}<br>`;
    if (object.exif.bytes) exif += `Size: ${mp} MP in ${object.exif.bytes.toLocaleString()} bytes with compression factor ${complexity.toFixed(2)}<br>`;
    if (object.exif.created) exif += `Taken: ${new Date(1000 * object.exif.created).toLocaleString()} Edited: ${new Date(1000 * object.exif.modified).toLocaleString()}<br>`;
    if (object.exif.software) exif += `Software: ${object.exif.software}<br>`;
    if (object.exif.exposure) exif += `Settings: ${object.exif.fov || 0}mm ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec<br>`;
    if (object.exif.city) location += `Location: ${object.exif.city}, ${object.exif.country}, ${object.exif.continent} (near ${object.exif.near})<br>`;
    if (object.exif.lat) location += `Coordinates: Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)}<br>`;
  }

  div.PopupDetails.innerHTML = `
      <h2>Image: ${object.image}</h2>
      Image size: ${div.PopupImage.naturalWidth} x ${div.PopupImage.naturalHeight}
        Processed in ${object.perf.total.toFixed(0)} ms<br>
        Metadata extracted in ${object.exif ? object.perf.exif.toFixed(0) : 0} ms<br>
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
      <h2>Tags</h2>${ml.JSONtoStr(object.tags)}<br>
      </div>
    `;

  // const faceDetails = drawBoxes(div.PopupImage, object) || '';
  drawBoxes(div.PopupImage, object);

  div.Popup.onclick = () => { div.Popup.style.display = 'none'; };
}

// print results strip with thumbnail for a given object
async function printResult(object) {
  let classified = '';
  if (object.classify) for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let detected = '';
  if (object.detect) for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let person = '';
  let nsfw = '';
  if (object.person && object.person.age) {
    person = `Person in ${object.perf.person.toFixed(0)}ms | 
      Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} 
      Age: ${object.person.age.toFixed(1)} 
      Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
  }
  if (object.person && object.person.class) {
    nsfw = `Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class} `;
  }
  const divItem = document.createElement('div');
  divItem.class = 'col';
  divItem.style = 'display: flex';
  divItem.innerHTML = `
    <div class="col" style="max-height: ${config.thumbnail}px; min-width: ${config.thumbnail}px; max-width: ${config.thumbnail}px; padding: 0">
      <img id="thumb-${object.id}" src="${object.thumbnail}" align="middle" width="${config.thumbnail}px" height="${config.thumbnail}px">
    </div>
    <div id="desc-${object.id}" class="col" style="height: ${config.thumbnail}px; min-width: 572px; max-width: 572px; padding: 4px">
      Image ${decodeURI(object.image)} processed in ${object.perf.total.toFixed(0)}ms 
      src:${object.naturalSize.width}x${object.naturalSize.height} tgt:${object.processedSize.width}x${object.processedSize.height}<br>
      Metadata in ${(object.perf.wordnet + object.perf.exif).toFixed(0)}ms<br>
      Classified in ${object.perf.classify.toFixed(0)}ms ${classified}<br>
      Detected in ${object.perf.detect.toFixed(0)}ms ${detected}<br>
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

// prepare stats
function statSummary() {
  const stats = { loadTime: 0, exif: 0, exifTime: 0, classify: 0, classifyTime: 0, detect: 0, detectTime: 0, person: 0, personTime: 0, wordnet: 0, wordnetTime: 0 };
  for (const item of results) {
    stats.loadTime += item.perf.load;
    stats.exif += item.exif ? 1 : 0;
    stats.exifTime += item.perf.exif;
    stats.classify += item.classify ? 1 : 0;
    stats.classifyTime += item.perf.classify;
    stats.detect += item.detect ? 1 : 0;
    stats.detectTime += item.perf.detect;
    stats.person += item.person ? 1 : 0;
    stats.personTime += item.perf.person;
    stats.wordnet += item.descriptions ? 1 : 0;
    stats.wordnetTime += item.perf.wordnet;
  }
  stats.loadAvg = stats.loadTime / results.length;
  stats.exifAvg = stats.exif === 0 ? 0 : (stats.exifTime / stats.exif);
  stats.classifyAvg = stats.classify === 0 ? 0 : (stats.classifyTime / stats.classify);
  stats.detectAvg = stats.detect === 0 ? 0 : (stats.detectTime / stats.detect);
  stats.personAvg = stats.person === 0 ? 0 : (stats.personTime / stats.person);
  stats.wordnetAvg = stats.wordnet === 0 ? 0 : (stats.wordnetTime / stats.wordnet);
  return stats;
}

// calls main detectxion and then print results for all images matching spec
async function loadGallery(spec) {
  log.active(`Fetching list for "${spec.folder}" matching "${spec.match}"`);
  const res = await fetch(`/list?folder=${encodeURI(spec.folder)}&match=${encodeURI(spec.match)}`);
  const dir = await res.json();
  log.result(`Queued: ${dir.files.length} images for processing ...`);
  const t0 = window.performance.now();
  const promises = [];
  for (const f of dir.files) {
    const url = `${spec.folder}/${f}`;
    promises.push(ml.process(url).then((obj) => {
      results.push(obj);
      log.active(`Printing: ${url}`);
      printResult(obj, url);
    }));
    if (promises.length >= config.batchProcessing) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  if (promises.length > 0) await Promise.all(promises);
  const t1 = window.performance.now();
  log.result(`Finished processed ${dir.files.length} images from "${spec.folder}" matching "${spec.match}": total: ${(t1 - t0).toLocaleString()}ms average: ${((t1 - t0) / dir.files.length).toLocaleString()}ms / image`);
  log.result('Statistics:');
  const s = statSummary();
  log.result(`  Results: ${results.length} in ${JSON.stringify(results).length} total bytes ${(JSON.stringify(results).length / results.length).toFixed(0)} average bytes`);
  log.result(`  Prepare Image: ${results.length} images in ${s.loadTime.toFixed(0)} ms average ${s.loadAvg.toFixed(2)} ms`);
  log.result(`  Classification: ${s.classify} images in ${s.classifyTime.toFixed(0)} ms average ${s.classifyAvg.toFixed(2)} ms`);
  log.result(`  Detection: ${s.detect} images in ${s.detectTime.toFixed(0)} ms average ${s.detectAvg.toFixed(2)} ms`);
  log.result(`  Person Analysis: ${s.person} images in ${s.personTime.toFixed(0)} ms average ${s.personAvg.toFixed(2)} ms`);
  log.result(`  Metadata Extraction: ${s.exif} images in ${s.exifTime.toFixed(0)} ms average ${s.exifAvg.toFixed(2)} ms`);
  log.result(`  Definition Loopkup: ${s.wordnet} images in ${s.wordnetTime.toFixed(0)} ms average ${s.wordnetAvg.toFixed(2)} ms`);
  log.active('Idle...');
}

// initial complex image is used to trigger all models thus warming them up
async function warmupModels() {
  log.result('Models warming up ...');
  const t0 = window.performance.now();
  const obj = await ml.process('media/warmup.jpg');
  results.push(obj);
  log.active(`Printing: ${name}`);
  printResult(obj);
  const t1 = window.performance.now();
  log.result(`Models warmed up in ${(t1 - t0).toFixed(0)}ms`);
}

async function main() {
  initDivs();
  log.init();
  log.active('Starting ...');
  await ml.load();
  await warmupModels();

  await loadGallery({ folder: 'media', match: 'objects' });
  // await loadGallery({ folder: 'media', match: 'people' });
  // await loadGallery({ folder: 'media', match: 'large' });
}

window.onload = main;
