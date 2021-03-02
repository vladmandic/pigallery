// @ts-nocheck
import $ from 'jquery';
import { tf, wasm } from '../shared/tf.js';
// import * as faceapi from '@vladmandic/face-api/dist/face-api.esm.js';
// import Human from '@vladmandic/human';
import * as log from '../shared/log.js';
import * as modelClassify from '../process/modelClassify.js';
import * as modelDetect from '../process/modelDetect.js';
import * as processImage from '../process/processImage.js';
import * as config from '../shared/config.js';

const models = [];
// @ts-ignore
window.cache = [];
let stop = false;
const limit = 0;

async function resetBackend(backendName) {
  const engine = tf.engine();
  if (backendName in engine.registry) {
    const backendFactory = tf.findBackendFactory(backendName);
    tf.removeBackend(backendName);
    tf.registerBackend(backendName, backendFactory);
  }
  await tf.setBackend(backendName);
  await tf.ready();
}

async function init() {
  const res = await fetch('/api/user/get');
  if (res.ok) window.user = await res.json();
  if (window.user && window.user.user) {
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    $('#user').text(window.user.user.split('@')[0]);
    log.div('log', true, `Logged in: ${window.user.user} root:${window.user.root} admin:${window.user.admin}`);
    if (!window.user.admin) $('#btn-update').css('color', 'gray');
  } else {
    location.replace('/auth');
  }
  log.div('log', true, `TensorFlow/JS Version: ${tf.version_core}`);
  await wasm.setWasmPaths('/assets/');
  await resetBackend(config.default.backEnd);
  await tf.enableProdMode();
  tf.ENV.set('DEBUG', false);
  if (config.default.backEnd === 'webgl') {
    for (const [key, val] of Object.entries(config.default.webgl)) {
      log.debug('  WebGL Setting', key, val);
      tf.ENV.set(key, val);
    }
  }
  log.div('log', true, `Configuration: backend: ${tf.getBackend().toUpperCase()} parallel processing: ${config.default.batchProcessing} image resize: ${config.default.maxSize}px shape: ${config.default.squareImage ? 'square' : 'native'}`);
  if (!config.default.models) {
    const req = await fetch('/api/models/get');
    if (req && req.ok) config.default.models = await req.json();
  }
}

async function loadClassify(options) {
  let engine;
  const stats = {};
  engine = await tf.engine();
  stats.time0 = performance.now();
  stats.bytes0 = engine.state.numBytes;
  stats.tensors0 = engine.state.numTensors;

  const model = await modelClassify.load(options);
  engine = await tf.engine();
  stats.time1 = performance.now();
  stats.bytes1 = engine.state.numBytes;
  stats.tensors1 = engine.state.numTensors;

  stats.size = Math.round((stats.bytes1 - stats.bytes0) / 1024 / 1024);
  stats.tensors = Math.round(stats.tensors1 - stats.tensors0);
  stats.time = Math.round(stats.time1 - stats.time0);
  models.push({ name: options.name, stats, model });
  log.div('log', true, `Loaded model: ${options.name} in ${stats.time.toLocaleString()} ms ${stats.size.toLocaleString()} MB ${stats.tensors.toLocaleString()} tensors`);
}

async function loadDetect(options) {
  let engine;
  const stats = {};
  stats.time0 = performance.now();
  engine = await tf.engine();
  stats.bytes0 = engine.state.numBytes;
  stats.tensors0 = engine.state.numTensors;

  const model = await modelDetect.load(options);
  engine = await tf.engine();
  stats.time1 = performance.now();
  stats.bytes1 = engine.state.numBytes;
  stats.tensors1 = engine.state.numTensors;

  stats.size = Math.round((stats.bytes1 - stats.bytes0) / 1024 / 1024);
  stats.tensors = Math.round(stats.tensors1 - stats.tensors0);
  stats.time = Math.round(stats.time1 - stats.time0);
  models.push({ name: options.name, stats, model });
  log.div('log', true, `Loaded model: ${options.name} in ${stats.time.toLocaleString()} ms ${stats.size.toLocaleString()} MB ${stats.tensors.toLocaleString()} tensors`);
}

async function print(file, image, results) {
  window.cache.push({ file, results });
  let text = '';
  for (const model of results) {
    let classified = model.model.name || model.model;
    if (model.data) {
      for (const res of model.data) {
        if (res.score && res.class) classified += ` | ${Math.round(res.score * 100)}% ${res.class} [id:${res.id}]`;
        if (res.age && res.gender) classified += ` | gender: ${Math.round(100 * res.genderProbability)}% ${res.gender} age: ${res.age.toFixed(1)}`;
        if (res.expression) {
          const emotion = Object.entries(res.expressions).reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
          classified += ` emotion: ${emotion[1]}% ${emotion[0]}`;
        }
      }
    }
    text += `${classified}<br>`;
  }
  const item = document.createElement('div');
  item.className = 'listitem';
  // item.style = `min-height: ${16 + window.options.listThumbSize}px; max-height: ${16 + window.options.listThumbSize}px; contain-intrinsic-size: ${16 + window.options.listThumbSize}px`;
  item.setAttribute('style', `min-height: ${16 + window.options.listThumbSize}px; max-height: ${16 + window.options.listThumbSize}px; contain-intrinsic-size: ${16 + window.options.listThumbSize}px`);
  item.innerHTML = `
    <div class="col thumbnail">
      <img class="thumbnail" src="${image.thumbnail}" align="middle" height=${window.options.listThumbSize} tag="${file}">
    </div>
    <div class="col description">
      <p class="listtitle">${file}</p>
      ${text}
    </div>
  `;
  $('#results').append(item);
}

async function classify() {
  stop = false;
  log.server('Compare: Classify');
  log.div('log', true, 'Loading models ...');
  const enabled = config.default.models.classify.filter((a) => a.enabled);
  for (const def of enabled) await loadClassify(def);
  log.div('log', true, 'Warming up ...');
  const warmup = await processImage.getImage('assets/warmup.jpg');
  await modelClassify.classify(models[0].model, warmup.canvas);
  log.div('log', true, 'TensorFlow Memory:', tf.memory());
  log.div('log', true, 'TensorFlow Flags:');
  log.div('log', true, tf.ENV.flags);

  const api = await fetch('/api/file/dir?folder=Tests/Objects/');
  const files = await api.json();
  log.div('log', true, `Received list from server: ${files.length} images`);

  if (tf.memory().numBytesInGPUAllocated > (tf.engine().backendInstance.numMBBeforeWarning * 1024 * 1024)) log.debug('High memory threshold:', tf.memory());

  const stats = [];
  // eslint-disable-next-line no-unused-vars
  for (const m in models) stats.push(0);
  for (const i in files) {
    if ((limit > 0) && (parseInt(i) >= limit)) stop = true;
    if (stop) continue;
    const results = [];
    const image = await processImage.getImage(files[i]);
    for (const m in models) {
      if (stop) continue;
      const t0 = performance.now();
      const data = await modelClassify.classify(models[m].model, image.canvas);
      const t1 = performance.now();
      stats[m] += (t1 - t0);
      results.push({ model: models[m], data });
      log.debug('Classify', Math.trunc(t1 - t0), 'ms', files[i], models[m], data);
    }
    print(files[i], image, results);
  }
  log.div('log', true, 'Finished:', tf.memory());
  for (const m in models) {
    log.div('log', true, `${models[m].name}: ${Math.round(stats[m]).toLocaleString()} ms / ${Math.round(stats[m] / files.length)} avg`);
  }
}

// eslint-disable-next-line no-unused-vars
async function detect() {
  stop = false;
  log.server('Compare: Detect');
  log.div('log', true, 'Loading models ...');
  const enabled = config.default.models.detect.filter((a) => a.enabled);
  for (const def of enabled) await loadDetect(def);
  if (!models[0].model) return;

  log.div('log', true, 'Warming up ...');
  const warmup = await processImage.getImage('assets/warmup.jpg');

  await modelDetect.detect(models[0].model, warmup.canvas);
  log.div('log', true, 'TensorFlow Memory:', tf.memory());
  log.div('log', true, 'TensorFlow Flags:');
  log.div('log', true, tf.ENV.flags);

  const api = await fetch('/api/file/dir?folder=Tests/Objects/');
  // const api = await fetch('/api/file/dir?folder=Tests/Persons/');
  // const api = await fetch('/api/file/dir?folder=Tests/NSFW/');
  const files = await api.json();
  log.div('log', true, `Received list from server: ${files.length} images`);

  const stats = [];
  // eslint-disable-next-line no-unused-vars
  for (const m in models) stats.push(0);
  for (const i in files) {
    if ((limit > 0) && (parseInt(i) >= limit)) stop = true;
    if (stop) continue;
    const results = [];
    const image = await processImage.getImage(files[i]);
    for (const m in models) {
      if (stop || !m) continue;
      const t0 = performance.now();
      const data = await modelDetect.detect(models[m].model, image.canvas);
      const t1 = performance.now();
      stats[m] += (t1 - t0);
      // tbd: human
      results.push({ model: models[m], data });
      log.debug('Detect', Math.trunc(t1 - t0), 'ms', files[i], models[m], data);
    }
    print(files[i], image, results);
  }
  log.div('log', true, 'Finished:', tf.memory());
  for (const m in models) {
    log.div('log', true, `${models[m].name}: ${Math.round(stats[m]).toLocaleString()} ms / ${Math.round(stats[m] / files.length)} avg`);
  }
}

async function main() {
  await init();
  $('#btn-classify').on('click', () => classify());
  $('#btn-detect').on('click', () => detect());
  $('#btn-stop').on('click', () => {
    log.div('log', true, 'Stop requested');
    stop = true;
  });
  await config.done();
}

window.onload = main;
