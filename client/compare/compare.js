// import ndarray from 'ndarray';
// import ops from 'ndarray-ops';
// import KerasJS from '../assets/keras.min.js';

import $ from 'jquery';
import * as tf from '@tensorflow/tfjs/dist/tf.esnext.js';
import * as faceapi from '@vladmandic/face-api/dist/face-api.esm.js';
import Human from '@vladmandic/human';
import * as log from '../shared/log.js';
import * as modelClassify from '../process/modelClassify.js';
import * as modelDetect from '../process/modelDetect.js';
// import * as modelYolo from '../process/modelYolo.js';
import * as definitions from '../shared/models.js';
import * as processImage from '../process/processImage.js';
import config from '../shared/config.js';

const models = [];
window.cache = [];
let stop = false;
const limit = 0;

async function init() {
  const res = await fetch('/api/user');
  if (res.ok) window.user = await res.json();
  if (window.user && window.user.user) {
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    $('#user').text(window.user.user.split('@')[0]);
    log.div('log', true, `Logged in: ${window.user.user} root:${window.user.root} admin:${window.user.admin}`);
    if (!window.user.admin) $('#btn-update').css('color', 'gray');
  } else {
    window.location.replace('/auth');
  }
  log.div('log', true, `TensorFlow/JS Version: ${tf.version_core}`);
  await tf.setBackend(config.default.backEnd);
  await tf.ready();
  await tf.enableProdMode();
  tf.ENV.set('DEBUG', false);
  for (const [key, val] of Object.entries(config.default.webgl)) {
    log.debug('WebGL Setting', key, val);
    tf.ENV.set(key, val);
  }
  log.div('log', true, `Configuration: backend: ${tf.getBackend().toUpperCase()} parallel processing: ${config.default.batchProcessing} image resize: ${config.default.maxSize}px shape: ${config.default.squareImage ? 'square' : 'native'}`);
}

async function loadClassify(options) {
  let engine;
  const stats = {};
  engine = await tf.engine();
  stats.time0 = window.performance.now();
  stats.bytes0 = engine.state.numBytes;
  stats.tensors0 = engine.state.numTensors;

  const model = await modelClassify.load(options);
  engine = await tf.engine();
  stats.time1 = window.performance.now();
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
  stats.time0 = window.performance.now();
  engine = await tf.engine();
  stats.bytes0 = engine.state.numBytes;
  stats.tensors0 = engine.state.numTensors;

  const model = await modelDetect.load(options);
  engine = await tf.engine();
  stats.time1 = window.performance.now();
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
        if (res.custom && res.data) classified += ` | ${res.custom}: ${JSON.stringify(res.data)}`;
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
  item.style = `min-height: ${16 + window.options.listThumbSize}px; max-height: ${16 + window.options.listThumbSize}px; contain-intrinsic-size: ${16 + window.options.listThumbSize}px`;
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
  for (const def of definitions.models.classify) await loadClassify(def);

  log.div('log', true, 'Warming up ...');
  const warmup = await processImage.getImage('assets/warmup.jpg');
  await modelClassify.classify(models[0].model, warmup.canvas);
  log.div('log', true, 'TensorFlow Memory:', tf.memory());
  log.div('log', true, 'TensorFlow Flags:');
  log.div('log', true, tf.ENV.flags);

  const api = await fetch('/api/dir?folder=Tests/Objects/');
  const files = await api.json();
  log.div('log', true, `Received list from server: ${files.length} images`);

  const stats = [];
  // eslint-disable-next-line no-unused-vars
  for (const m in models) stats.push(0);
  for (const i in files) {
    if (tf.memory().numBytesInGPUAllocated > tf.ENV.get('WEBGL_DELETE_TEXTURE_THRESHOLD')) log.debug('High memory threshold:', tf.memory());
    if ((limit > 0) && (i >= limit)) stop = true;
    if (stop) break;
    const results = [];
    const image = await processImage.getImage(files[i]);
    for (const m in models) {
      const t0 = window.performance.now();
      const data = await modelClassify.classify(models[m].model, image.canvas);
      const t1 = window.performance.now();
      stats[m] += (t1 - t0);
      results.push({ model: models[m], data });
      log.debug('Classify', files[i], models[m], data);
    }
    print(files[i], image, results);
  }
  log.div('log', true, 'Finished:', tf.memory());
  for (const m in models) {
    log.div('log', true, `${models[m].name}: ${Math.round(stats[m]).toLocaleString()} ms / ${Math.round(stats[m] / files.length)} avg`);
  }
}

async function person() {
  stop = false;
  log.div('log', true, `FaceAPI version: ${faceapi.tf.version_core} backend ${faceapi.tf.getBackend()}`);
  log.div('log', true, 'Loading models ...');

  let engine;
  let stats = {};
  stats.time0 = window.performance.now();
  engine = await tf.engine();
  stats.bytes0 = engine.state.numBytes;
  stats.tensors0 = engine.state.numTensors;

  const options = definitions.models.person[0];
  if (options.exec === 'yolo') await faceapi.nets.tinyFaceDetector.load(options.modelPath);
  if (options.exec === 'ssd') await faceapi.nets.ssdMobilenetv1.load(options.modelPath);
  await faceapi.nets.ageGenderNet.load(options.modelPath);
  await faceapi.nets.faceLandmark68Net.load(options.modelPath);
  await faceapi.nets.faceRecognitionNet.load(options.modelPath);
  await faceapi.nets.faceExpressionNet.load(options.modelPath);
  if (options.exec === 'yolo') options.options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: options.score, inputSize: options.tensorSize });
  if (options.exec === 'ssd') options.options = new faceapi.SsdMobilenetv1Options({ minConfidence: options.score, maxResults: options.topK });

  const human = new Human();
  await human.load(config.default.human);

  log.div('log', true, 'Warming up ...');
  const warmup = await processImage.getImage('assets/warmup.jpg');
  await faceapi.detectAllFaces(warmup.canvas, options.options);
  await human.detect(warmup.canvas, config.default.human);
  log.div('log', true, 'TensorFlow Memory:', faceapi.tf.memory());
  log.div('log', true, 'TensorFlow Flags:');
  log.div('log', true, faceapi.tf.ENV.flags);

  engine = await tf.engine();
  stats.time1 = window.performance.now();
  stats.bytes1 = engine.state.numBytes;
  stats.tensors1 = engine.state.numTensors;

  stats.size = Math.round((stats.bytes1 - stats.bytes0) / 1024 / 1024);
  stats.tensors = Math.round(stats.tensors1 - stats.tensors0);
  stats.time = Math.round(stats.time1 - stats.time0);
  log.div('log', true, `Loaded models: FaceAPI/Human in ${stats.time.toLocaleString()} ms ${stats.size.toLocaleString()} MB ${stats.tensors.toLocaleString()} tensors`);

  const api = await fetch('/api/dir?folder=Tests/Persons/');
  const files = await api.json();
  log.div('log', true, `Received list from server: ${files.length} images`);

  stats = [0, 0];
  let data;
  for (const i in files) {
    if (tf.memory().numBytesInGPUAllocated > tf.ENV.get('WEBGL_DELETE_TEXTURE_THRESHOLD')) log.debug('High memory threshold:', tf.memory());
    if ((limit > 0) && (i >= limit)) stop = true;
    if (stop) break;
    const results = [];
    const image = await processImage.getImage(files[i]);

    const t0 = window.performance.now();

    data = await faceapi
      .detectAllFaces(image.canvas, options.options)
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptors()
      .withAgeAndGender();

    results.push({ model: 'FaceAPI', data });
    log.debug('FaceApi', files[i], data);

    const t1 = window.performance.now();
    stats[0] += t1 - t0;

    data = await human.detect(image.canvas, config.default.human);
    log.debug('Human', files[i], data);
    results.push({ model: 'Human', data: [data] });

    const t2 = window.performance.now();
    stats[1] += t2 - t1;

    print(files[i], image, results);
  }
  log.div('log', true, 'Finished:', tf.memory());
  log.div('log', true, `FaceApi: ${Math.round(stats[0]).toLocaleString()} ms / ${Math.round(stats[0] / files.length)} avg`);
  log.div('log', true, `Human: ${Math.round(stats[1]).toLocaleString()} ms / ${Math.round(stats[1] / files.length)} avg`);
}

// eslint-disable-next-line no-unused-vars
async function detect() {
  stop = false;
  log.server('Compare: Detect');
  log.div('log', true, 'Loading models ...');
  for (const def of definitions.models.detect) await loadDetect(def);
  if (!models[0].model) return;

  log.div('log', true, 'Warming up ...');
  const warmup = await processImage.getImage('assets/warmup.jpg');

  await modelDetect.detect(models[0].model, warmup.canvas);
  log.div('log', true, 'TensorFlow Memory:', tf.memory());
  log.div('log', true, 'TensorFlow Flags:');
  log.div('log', true, tf.ENV.flags);

  // const api = await fetch('/api/dir?folder=Tests/Objects/');
  // const api = await fetch('/api/dir?folder=Tests/Persons/');
  const api = await fetch('/api/dir?folder=Tests/NSFW/');
  const files = await api.json();
  log.div('log', true, `Received list from server: ${files.length} images`);

  const stats = [];
  // eslint-disable-next-line no-unused-vars
  for (const m in models) stats.push(0);
  for (const i in files) {
    if (tf.memory().numBytesInGPUAllocated > tf.ENV.get('WEBGL_DELETE_TEXTURE_THRESHOLD')) log.debug('High memory threshold:', tf.memory());
    if ((limit > 0) && (i >= limit)) stop = true;
    if (stop) continue;
    const results = [];
    const image = await processImage.getImage(files[i]);
    for (const m in models) {
      const t0 = window.performance.now();
      const data = await modelDetect.detect(models[m].model, image.canvas);
      const t1 = window.performance.now();
      stats[m] += (t1 - t0);
      // tbd: human
      results.push({ model: models[m], data });
      log.debug('Detect', files[i], models[m], data);
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
  $('#btn-person').on('click', () => person());
  $('#btn-stop').on('click', () => { stop = true; });
  await config.done();
}

window.onload = main;
