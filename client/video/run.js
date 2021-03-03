import { tf, wasm } from '../shared/tf';
import * as log from '../shared/log';
import * as draw from './draw';
import * as gesture from './gesture';
import * as runDetect from './runDetect';
import * as runClassify from './runClassify';
import * as runHuman from './runHuman';

async function getVideoCanvas(video, canvases, config) {
  if (video.paused || video.ended || (video.readyState <= 2)) return null;
  if (!canvases.process) {
    canvases.process = document.createElement('canvas');
    canvases.process.id = 'canvas-process';
    canvases.process.visibility = 'hidden';
  } else {
    draw.clear(canvases.process);
  }
  const matrix = video.style.transform.match(/matrix\((.*)\)/)[1].split(',').map((a) => parseFloat(a));
  canvases.process.width = Math.trunc(video.offsetWidth * config.ui.scale / 100);
  canvases.process.height = Math.trunc(video.offsetHeight * config.ui.scale / 100);
  canvases.process.getContext('2d').drawImage(video, matrix[4], matrix[5], matrix[0] * video.videoWidth, matrix[0] * video.videoHeight, 0, 0, canvases.process.width, canvases.process.height);
  return canvases.process;
}

async function clear(canvases) {
  for (const canvas of Object.values(canvases)) {
    log.debug('Clear canvas', canvas);
    draw.clear(canvas);
  }
  canvases = [];
}

const fps = [];
async function updatePerf(config, objects) {
  if (objects.perf['Total time']) fps.push(1000 / objects.perf['Total time']);
  if (fps.length > config.ui.maxFrames) fps.shift();
  if (objects.menus.perf.visible) {
    if (objects.menus.perf) objects.menus.perf.updateChart('FPS', fps);
    for (const key of Object.keys(objects.perf)) {
      if (key.toLowerCase().includes('memory')) objects.menus.perf.updateValue(key, objects.perf[key], ' MB');
      else if (key.toLowerCase().includes('tensor')) objects.menus.perf.updateValue(key, objects.perf[key]);
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
  // @ts-ignore
  if (config.backEnd === 'wasm') await wasm.setWasmPaths('/assets/');
  await resetBackend(config.backEnd);
  tf.ENV.set('DEBUG', false);
  if (config.backEnd === 'webgl') {
    for (const [key, val] of Object.entries(config.webgl)) {
      log.debug('Setting WebGL:', key, val);
      tf.ENV.set(key, val);
    }
    if (config.memory) {
      log.debug('Setting WebGL: WEBGL_DELETE_TEXTURE_THRESHOLD:', config.memory);
      tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    }
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
  log.debug('TF Models:', config.models);
}

async function main(config, objects) {
  const video = document.getElementById('video');
  const t0 = performance.now();
  objects.detected = {};
  objects.classified = {};
  objects.gestures = [];
  objects.human = [];
  objects.results = [];

  const input = await getVideoCanvas(video, objects.canvases, config);
  if (!input) return;

  // this is not optional as we need return canvas with filters applied
  const res = await runHuman.run(input, config, objects);
  if (res.human) objects.results.push(res);
  else draw.clear(objects.canvases.human);

  // this is canvas with actual image, all other are overlays
  // if (res.human.canvas) input = res.human.canvas;
  // input.className = 'canvases';
  // input.style.display = 'block';
  // input.id = 'canvas-raw';
  // document.getElementById('canvases')?.appendChild(input);

  // load model list once
  if (!config.models) {
    const req = await fetch('/api/models/get');
    if (req && req.ok) config.models = await req.json();
  }

  for (const m of config.models.classify) {
    if (m.enabled) {
      const data = (config.classify[m.name]) ? await runClassify.run(m.name, input, config, objects) : null;
      if (data) objects.results.push(data);
      else draw.clear(objects.canvases[m.name]);
    }
  }

  for (const m of config.models.various) {
    if (m.enabled) {
      const data = (config.classify[m.name]) ? await runClassify.run(m.name, input, config, objects) : null;
      if (data) objects.results.push(data);
      else draw.clear(objects.canvases[m.name]);
    }
  }

  for (const m of config.models.detect) {
    if (m.enabled) {
      const data = (config.detect[m.name]) ? await runDetect.run(m.name, input, config, objects) : null;
      if (data) objects.results.push(data);
      else draw.clear(objects.canvases[m.name]);
    }
  }

  objects.gestures = await gesture.analyze(objects.results);

  const t1 = performance.now();
  if (objects.results && objects.results[0] && objects.results[0].human) {
    const item = objects.results[0].human.performance;
    for (const [key, val] of Object.entries(item)) {
      objects.perf[`Human:${key}`] = val;
    }
  }
  const el = document.getElementById('detected');
  if (!el) return;
  if (config.ui.text) {
    let msg = '';
    // @ts-ignore
    msg += `camera: ${video?.videoWidth} x ${video?.videoHeight} processing: ${input.width} x ${input.height}<br>`;
    if (objects.human.length > 0) msg += `human: ${log.str([...objects.human])}<br>`;
    for (const [key, val] of Object.entries(objects.detected)) {
      if (val.length > 0) msg += `detected: ${key}: ${log.str([...val])}<br>`;
    }
    for (const [key, val] of Object.entries(objects.classified)) {
      if (val.length > 0) msg += `classified: ${key}: ${log.str([...val])}<br>`;
    }
    if (objects.gestures.length > 0) msg += `gestures: ${log.str([...objects.gestures])}<br>`;
    el.innerHTML = msg;
  } else {
    el.innerHTML = '';
  }
  // @ts-ignore
  document.getElementById('status').innerText = '';
  objects.perf['Total time'] = Math.trunc(t1 - t0);
  const mem = tf.memory();
  objects.perf['System Memory'] = Math.trunc(mem.numBytes / 1024 / 1024).toLocaleString();
  if (mem.numBytesInGPU) objects.perf['GPU memory used'] = Math.trunc(mem.numBytesInGPU / 1024 / 1024).toLocaleString();
  if (mem.numBytesInGPUAllocated) objects.perf['GPU memory allocated'] = Math.trunc(mem.numBytesInGPUAllocated / 1024 / 1024).toLocaleString();
  objects.perf.Tensors = mem.numTensors;
  if (objects.perf['Total time'] > (objects.perf.FirstFrame || 0)) objects.perf.FirstFrame = objects.perf['Total time'];
  updatePerf(config, objects);
  // get next frame immediately if frame rate above 33 else slow down processing by 3ms
  if (objects.perf['Total time'] > 3) requestAnimationFrame(() => main(config, objects));
  else setTimeout(() => main(config, objects), 3);
}

export {
  main,
  init,
  clear,
};
