/* global tf, log, models, canvases, perf, params, results, extracted, detected */

window.tf = require('@tensorflow/tfjs/dist/tf.es2017.js');
const draw = require('./draw.js');
const gesture = require('./gesture.js');
const fx = require('../../assets/webgl-image-filter.js');
const run = require('./run.js');

let fxFilter = null;

// using window globals for debugging purposes
window.perf = { Frame: 0 }; // global performance counters
window.models = []; // global list of all loaded modeles
window.canvases = []; // global list of all per-model canvases
window.extracted = [];
window.detected = [];
const fps = [];

function getCameraImage(video) {
  const t0 = performance.now();
  let matrix = video.style.transform.match(/[+-]?\d+(\.\d+)?/g);
  if (!matrix || matrix.length !== 6) matrix = [1.0, 1.0, 0, 0];
  else matrix = matrix.map((a) => parseFloat(a));

  const width = ((params.resolution && params.resolution.width > 0) ? params.resolution.width : video.videoWidth);
  const height = ((params.resolution && params.resolution.height > 0) ? params.resolution.height : video.videoHeight);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0 - matrix[4] / matrix[0], 0 - matrix[5] / matrix[3], video.videoWidth / matrix[0], video.videoHeight / matrix[3], 0, 0, canvas.width, canvas.height);

  if (!fxFilter) fxFilter = new fx.Canvas();
  else fxFilter.reset();
  fxFilter.addFilter('brightness', params.imageBrightness);
  fxFilter.addFilter('contrast', params.imageContrast);
  fxFilter.addFilter('sharpen', params.imageSharpness);
  fxFilter.addFilter('blur', params.imageBlur);
  fxFilter.addFilter('saturation', params.imageSaturation);
  fxFilter.addFilter('hue', params.imageHue);
  const filtered = fxFilter.apply(canvas);

  if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(canvas, 0, 0, canvas.width, canvas.height, { title: 'original' }));
  if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(filtered, 0, 0, filtered.width, filtered.height, { title: 'filtered' }));
  const t1 = performance.now();
  perf.Image = Math.trunc(t1 - t0);
  return filtered;
}

async function drawOverlay(image, video) {
  if (!canvases.process) {
    canvases.process = document.createElement('canvas', { desynchronized: true });
    canvases.process.id = 'canvas-process';
    canvases.process.width = video.offsetWidth;
    canvases.process.height = video.offsetHeight;
    canvases.process.style.position = 'absolute';
    canvases.process.style.top = 0;
    canvases.process.style.filter = 'opacity(0.5) grayscale(1)';
    document.getElementById('drawcanvas').appendChild(canvases.process);
  }
  canvases.process.getContext('2d').drawImage(image, 0, 0, canvases.process.width, canvases.process.height);
}

async function clearAll() {
  for (const canvas of Object.values(canvases)) {
    log.debug('Clear canvas', canvas);
    draw.clear(canvas);
  }
}

async function main() {
  const video = document.getElementById('videocanvas');
  if (video.paused || video.ended) {
    log.div('log', true, `Video status: paused:${video.paused} ended:${video.ended} ready:${video.readyState}`);
    return;
  }
  if (video.readyState > 2) {
    const t0 = performance.now();
    const promises = [];
    detected.length = 0;
    perf.Canvas = 0;

    const image = getCameraImage(video);

    if (perf.Frame === 0) {
      tf.setBackend('webgl');
      tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true);
      await tf.ready();
      await tf.enableProdMode();
      log.div('log', true, `Using TensorFlow/JS: ${tf.version_core} Backend: ${tf.getBackend().toUpperCase()}`);
      fps.length = 0;
    }

    if (document.getElementById('menu-overlay').checked) await drawOverlay(image, video);
    else draw.clear(canvases.process);

    if (document.getElementById('model-imagenet').checked) {
      if (params.async) promises.push(run.imagenet(image, video));
      else promises.push(await run.imagenet(image, video));
    } else draw.clear(canvases.imagenet);

    if (document.getElementById('model-deepdetect').checked) {
      if (params.async) promises.push(run.deepdetect(image, video));
      else promises.push(await run.deepdetect(image, video));
    } else draw.clear(canvases.deepdetect);

    if (document.getElementById('model-cocossd').checked) {
      if (params.async) promises.push(run.cocossd(image, video));
      else promises.push(await run.cocossd(image, video));
    } else draw.clear(canvases.cocossd);

    if (document.getElementById('model-nsfw').checked) {
      if (params.async) promises.push(run.nsfw(image, video));
      else promises.push(await run.nsfw(image, video));
    } else draw.clear(canvases.nsfw);

    if (document.getElementById('model-food').checked) {
      if (params.async) promises.push(run.food(image, video));
      else promises.push(await run.food(image, video));
    } else draw.clear(canvases.food);

    if (document.getElementById('model-plants').checked) {
      if (params.async) promises.push(run.plants(image, video));
      else promises.push(await run.plants(image, video));
    } else draw.clear(canvases.plants);

    if (document.getElementById('model-birds').checked) {
      if (params.async) promises.push(run.birds(image, video));
      else promises.push(await run.birds(image, video));
    } else draw.clear(canvases.birds);

    if (document.getElementById('model-insects').checked) {
      if (params.async) promises.push(run.insects(image, video));
      else promises.push(await run.insects(image, video));
    } else draw.clear(canvases.insects);

    if (document.getElementById('model-facemesh').checked) {
      if (params.async) promises.push(run.facemesh(image, video));
      else promises.push(await run.facemesh(image, video));
    } else draw.clear(canvases.facemesh);

    if (document.getElementById('model-posenet').checked) {
      if (params.async) promises.push(run.posenet(image, video));
      else promises.push(await run.posenet(image, video));
    } else draw.clear(canvases.posenet);

    if (document.getElementById('model-handpose').checked) {
      if (params.async) promises.push(run.handpose(image, video));
      promises.push(await run.handpose(image, video));
    } else draw.clear(canvases.handpose);

    if (document.getElementById('model-faceapi').checked) {
      if (params.async) promises.push(run.faceapi(image, video));
      promises.push(await run.faceapi(image, video));
    } else draw.clear(canvases.faceapi);

    window.results = (params.async ? await Promise.all(promises) : promises).filter((a) => ((a !== null) && (a !== undefined)));

    const objects = document.getElementById('objects');
    objects.innerHTML = '';
    for (const object of extracted) objects.appendChild(object);
    extracted.length = 0;

    if (perf.Frame === 0) {
      const engine = await tf.engine();
      log.div('log', true, `TF State: ${engine.state.numBytes.toLocaleString()} bytes ${engine.state.numDataBuffers.toLocaleString()} buffers ${engine.state.numTensors.toLocaleString()} tensors`);
      log.div('log', true, `TF GPU Memory: used ${engine.backendInstance.numBytesInGPU.toLocaleString()} bytes free ${Math.floor(1000 * engine.backendInstance.numMBBeforeWarning).toLocaleString()} bytes`);
      // eslint-disable-next-line no-console
      log.debug('TF Flags:', engine.ENV.flags);
      // eslint-disable-next-line no-console
      log.debug('TF Models:', models);
      // eslint-disable-next-line no-console
      for (const result of results) log.debug('TF Results: ', result);
    }

    const gestures = await gesture.analyze(window.results);

    const t1 = performance.now();
    perf.Total = Math.trunc(t1 - t0);
    perf.Frame += 1;
    perf.Canvas = Math.round(perf.Canvas);
    fps.push(Math.round(10000 / (t1 - t0)) / 10);
    const avg = Math.round(10 * fps.reduce((a, b) => (a + b)) / fps.length) / 10;
    document.getElementById('status').innerText = `FPS: ${Math.round(10000 / (t1 - t0)) / 10} AVG: ${avg}`;
    document.getElementById('detected').innerText = `Detected: ${log.str([...detected, ...gestures])}`;
    document.getElementById('perf').innerText = document.getElementById('menu-log').checked ? `Performance: ${log.str(perf)}` : '';
  }
  requestAnimationFrame(main);
}

exports.main = main;
exports.clear = clearAll;
