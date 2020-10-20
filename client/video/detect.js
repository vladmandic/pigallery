import * as tf from '@tensorflow/tfjs/dist/tf.es2017.js';
import * as log from '../shared/log.js';
import * as draw from './draw.js';
import * as gesture from './gesture.js';
import * as models from './models.js';
import * as human from './human.js';
import * as definitions from '../shared/models.js';

async function getVideoCanvas(video, canvases, config) {
  if (config.ui.overlay) document.getElementById('video').style.visibility = 'hidden';
  else document.getElementById('video').style.visibility = 'visible';
  if (video.paused || video.ended || (video.readyState <= 2)) return null;
  if (!canvases.process) {
    canvases.process = document.createElement('canvas');
    canvases.process.id = 'canvas-process';
  } else {
    draw.clear(canvases.process);
  }
  canvases.process.width = video.offsetWidth;
  canvases.process.height = video.offsetHeight;
  const matrix = video.style.transform.match(/matrix\((.*)\)/)[1].split(',').map((a) => parseFloat(a));
  canvases.process.getContext('2d').drawImage(video, matrix[4], matrix[5], matrix[0] * video.videoWidth, matrix[0] * video.videoHeight, 0, 0, canvases.process.width, canvases.process.height);
  return canvases.process;
}

async function clearAll(canvases) {
  for (const canvas of Object.values(canvases)) {
    log.debug('Clear canvas', canvas);
    draw.clear(canvas);
  }
  canvases = [];
}

async function init(config) {
  document.getElementById('status').innerText = 'initializing';
  if (config.backEnd === 'wasm') tf.wasm.setPaths('/assets');
  tf.setBackend(config.backEnd);
  // tf.ENV.set('WEBGL_CPU_FORWARD', false);
  if (config.backEnd === 'webgl') tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true);
  await tf.ready();
  await tf.enableProdMode();
  log.div('log', true, `Using TensorFlow/JS: ${tf.version_core} Backend: ${tf.getBackend().toUpperCase()}`);

  const engine = await tf.engine();
  log.div('log', true, `TF State: ${engine.state.numBytes.toLocaleString()} bytes ${engine.state.numDataBuffers.toLocaleString()} buffers ${engine.state.numTensors.toLocaleString()} tensors`);
  log.div('log', true, `TF GPU Memory: used ${engine.backendInstance.numBytesInGPU.toLocaleString()} bytes free ${Math.floor(1024 * 1024 * engine.backendInstance.numMBBeforeWarning).toLocaleString()} bytes`);
  // eslint-disable-next-line no-console
  log.debug('TF Flags:', engine.ENV.flags);
  // eslint-disable-next-line no-console
  log.debug('TF Models:', definitions.models);
  // eslint-disable-next-line no-console
}

async function main(config, objects) {
  const video = document.getElementById('video');
  const t0 = performance.now();
  objects.detected = [];
  objects.results = [];

  let input = await getVideoCanvas(video, objects.canvases, config);
  if (!input) return;

  models.set(objects);

  // this is not optional as we need return canvas with filters applied
  const res = await human.run(input, config.human, objects);
  if (res.canvas) input = res.canvas;
  input.className = 'canvases';
  input.style.display = 'block';
  document.getElementById('canvases').appendChild(input);

  objects.results.push(res);

  if (config.classify.imagenet) objects.results.push(await models.imagenet(input, config));
  else draw.clear(objects.canvases.imagenet);

  if (config.classify.deepdetect) objects.results.push(await models.deepdetect(input, config));
  else draw.clear(objects.canvases.deepdetect);

  if (config.detect.coco) objects.results.push(await models.cocossd(input, config));
  else draw.clear(objects.canvases.cocossd);

  if (config.classify.nsfw) objects.results.push(await models.nsfw(input, config));
  else draw.clear(objects.canvases.nsfw);

  if (config.classify.food) objects.results.push(await models.food(input, config));
  else draw.clear(objects.canvases.food);

  if (config.classify.plants) objects.results.push(await models.plants(input, config));
  else draw.clear(objects.canvases.plants);

  if (config.classify.birds) objects.results.push(await models.birds(input, config));
  else draw.clear(objects.canvases.birds);

  if (config.classify.insects) objects.results.push(await models.insects(input, config));
  else draw.clear(objects.canvases.insects);

  const gestures = await gesture.analyze(objects.results);

  const t1 = performance.now();
  objects.perf.Total = Math.trunc(t1 - t0);
  document.getElementById('detected').innerText = `Detected: ${log.str([...objects.detected, ...gestures])}`;
  document.getElementById('status').innerText = '';
  requestAnimationFrame(() => main(config, objects));
}

exports.main = main;
exports.clear = clearAll;
exports.init = init;
