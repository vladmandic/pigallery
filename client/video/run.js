import * as tf from '@tensorflow/tfjs/dist/tf.es2017.js';
import * as log from '../shared/log.js';
import * as draw from './draw.js';
import * as gesture from './gesture.js';
import * as runDetect from './runDetect.js';
import * as runClassify from './runClassify.js';
import * as runHuman from './runHuman.js';
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

const fps = [];
async function updatePerf(config, objects) {
  if (objects.perf.Total) fps.push(1000 / objects.perf.Total);
  if (fps.length > config.ui.maxFrames) fps.shift();
  if (objects.menus.perf.visible) {
    if (objects.menus.perf) objects.menus.perf.updateChart('FPS', fps);
    for (const key of Object.keys(objects.perf)) {
      if (key.toLowerCase().startsWith('memory')) objects.menus.perf.updateValue(key, objects.perf[key], ' MB');
      else if (key.toLowerCase().startsWith('tensor')) objects.menus.perf.updateValue(key, objects.perf[key]);
      else objects.menus.perf.updateValue(key, objects.perf[key], 'ms');
    }
  }
}

async function resetBackend(backendName) {
  const engine = tf.engine();
  if (backendName in engine.registry) {
    const backendFactory = tf.findBackendFactory(backendName);
    tf.removeBackend(backendName);
    tf.registerBackend(backendName, backendFactory);
  }
  await tf.setBackend(backendName);
}

async function init(config) {
  // document.getElementById('status').innerText = 'initializing';
  if (config.backEnd === 'wasm') tf.wasm.setPaths('/assets');
  await resetBackend(config.backEnd);
  tf.ENV.set('DEBUG', false);
  for (const [key, val] of Object.entries(config.webgl)) {
    log.debug('WebGL Setting', key, val);
    tf.ENV.set(key, val);
  }
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
}

async function main(config, objects) {
  const video = document.getElementById('video');
  const t0 = performance.now();
  objects.detected = {};
  objects.classified = {};
  objects.gestures = [];
  objects.human = [];
  objects.results = [];

  let input = await getVideoCanvas(video, objects.canvases, config);
  if (!input) return;

  // this is not optional as we need return canvas with filters applied
  const res = await runHuman.run(input, config, objects);
  if (res.human) objects.results.push(res);
  else draw.clear(objects.canvases.human);
  if (res.canvas) input = res.canvas;

  input.className = 'canvases';
  input.style.display = 'block';
  document.getElementById('canvases').appendChild(input);

  for (const m of definitions.models.classify) {
    const data = (config.classify[m.name]) ? await runClassify.run(m.name, input, config, objects) : null;
    if (data) objects.results.push(data);
    else draw.clear(objects.canvases[m.name]);
  }

  for (const m of definitions.models.various) {
    const data = (config.classify[m.name]) ? await runClassify.run(m.name, input, config, objects) : null;
    if (data) objects.results.push(data);
    else draw.clear(objects.canvases[m.name]);
  }

  for (const m of definitions.models.detect) {
    const data = (config.detect[m.name]) ? await runDetect.run(m.name, input, config, objects) : null;
    if (data) objects.results.push(data);
    else draw.clear(objects.canvases[m.name]);
  }

  objects.gestures = await gesture.analyze(objects.results);

  const t1 = performance.now();
  if (objects.results && objects.results[0] && objects.results[0].human) {
    const item = objects.results[0].human.performance;
    for (const [key, val] of Object.entries(item)) {
      if (val >= 10 && key !== 'total') objects.perf[`Human:${key}`] = val;
    }
  }
  if (config.ui.text) {
    let msg = '';
    if (objects.human.length > 0) msg += `human: ${log.str([...objects.human])}<br>`;
    for (const [key, val] of Object.entries(objects.detected)) {
      if (val.length > 0) msg += `detected: ${key}: ${log.str([...val])}<br>`;
    }
    for (const [key, val] of Object.entries(objects.classified)) {
      if (val.length > 0) msg += `classified: ${key}: ${log.str([...val])}<br>`;
    }
    if (objects.gestures.length > 0) msg += `gestures: ${log.str([...objects.gestures])}<br>`;
    document.getElementById('detected').innerHTML = msg;
  } else {
    document.getElementById('detected').innerHTML = '';
  }
  document.getElementById('status').innerText = '';
  objects.perf.Total = Math.trunc(t1 - t0);
  objects.perf.Memory = Math.trunc(tf.memory().numBytes / 1024 / 1024).toLocaleString();
  objects.perf.Tensors = tf.memory().numTensors;
  if (objects.perf.Total > (objects.perf.FirstFrame || 0)) objects.perf.FirstFrame = objects.perf.Total;
  updatePerf(config, objects);
  // get next frame immediately if frame rate above 33
  if (objects.perf.Total > 3) requestAnimationFrame(() => main(config, objects));
  else setTimeout(() => main(config, objects), 3);
}

exports.main = main;
exports.clear = clearAll;
exports.init = init;
