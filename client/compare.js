const tf = require('@tensorflow/tfjs');
const log = require('./log.js');
const config = require('./config.js').default;
const modelClassify = require('./modelClassify.js');
const modelDetect = require('./modelDetect.js');
const processImage = require('./processImage.js');

const models = [];

async function init() {
  const res = await fetch('/api/user');
  if (res.ok) window.user = await res.json();
  if (window.user && window.user.user) {
    $('#btn-user').toggleClass('fa-user-slash fa-user');
    $('#user').text(window.user.user.split('@')[0]);
    log.result(`Logged in: ${window.user.user} root:${window.user.root} admin:${window.user.admin}`);
    if (!window.user.admin) $('#btn-update').css('color', 'gray');
  } else {
    window.location = '/client/auth.html';
  }
  await tf.setBackend(config.backEnd);
  await tf.enableProdMode();
  if (!config.floatPrecision) await tf.webgl.forceHalfFloat();
  log.result(`Configured Backend: ${tf.getBackend().toUpperCase()}`);
  log.result('Configuration:');
  log.result(`  Parallel processing: ${config.batchProcessing} parallel images`);
  log.result(`  Forced image resize: ${config.maxSize}px maximum shape: ${config.squareImage ? 'square' : 'native'}`);
  log.result(`  Float Precision: ${config.floatPrecision ? '32bit' : '16bit'}`);
}

async function loadClassify(options) {
  let engine;
  const stats = {};
  stats.time0 = window.performance.now();
  engine = await tf.engine();
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
  log.result(`Loaded model: ${options.name}  in ${stats.time.toLocaleString()} ms ${stats.size.toLocaleString()} MB ${stats.tensors.toLocaleString()} tensors`);
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
  log.result(`Loaded model: ${options.name}  in ${stats.time.toLocaleString()} ms ${stats.size.toLocaleString()} MB ${stats.tensors.toLocaleString()} tensors`);
}

async function print(file, image, results) {
  let text = '';
  for (const model of results) {
    let classified = model.model.name;
    for (const res of model.data) {
      classified += ` | ${Math.round(res.score * 100)}% ${res.class}`;
    }
    text += `${classified}<br>`;
  }

  const item = document.createElement('div');
  item.className = 'listitem';
  item.innerHTML = `
    <div class="col thumbnail">
      <img class="thumbnail" src="${image.thumbnail}" align="middle">
    </div>
    <div class="col description">
      <p class="listtitle">${file}</p>
      ${text}
    </div>
  `;
  $('#results').append(item);
}

async function classify() {
  log.result('Loading models ...');
  // await loadClassify({ name: 'ImageNet MobileNet v1', modelPath: '/models/mobilenet-v1/model.json', score: 0.2, topK: 3 });
  // await loadClassify({ name: 'ImageNet MobileNet v2', modelPath: '/models/mobilenet-v2/model.json', score: 0.2, topK: 3 });
  // await loadClassify({ name: 'ImageNet Inception v1', modelPath: 'models/inception-v1/model.json', score: 0.2, topK: 3 });
  // await loadClassify({ name: 'ImageNet Inception v2', modelPath: 'models/inception-v2/model.json', score: 0.2, topK: 3 });
  // await loadClassify({ name: 'ImageNet Inception v3', modelPath: 'models/inception-v3/model.json', score: 0.2, topK: 3 });
  // await loadClassify({ name: 'ImageNet Inception v4', modelPath: 'models/inception-v4/model.json', score: 0.2, topK: 3, useFloat: false, tensorSize: 299, scoreScale: 200 });
  // await loadClassify({ name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect-6k/model.json', score: 0.1, topK: 5, useFloat: false, tensorSize: 299, scoreScale: 1000, classes: 'assets/DeepDetect-Labels.json', offset: 0 });
  // await loadClassify({ name: 'ImageNet ResNet v2-50', modelPath: '/models/resnet-v2-50/model.json', score: 0.2, topK: 3, tensorSize: 224 });
  // await loadClassify({ name: 'ImageNet ResNet v2-101', modelPath: '/models/resnet-v2-101/model.json', score: 0.2, topK: 3 });
  // await loadClassify({ name: 'ImageNet Inception-ResNet v2', modelPath: '/models/inception-resnet-v2/model.json', score: 0.2, topK: 3, tensorSize: 224 });
  // await loadClassify({ name: 'ImageNet NASNet-A Mobile', modelPath: 'models/nasnet-mobile/model.json', score: 0.2, topK: 3, slice: 0 });
  // await loadClassify({ name: 'ImageNet EfficientNet B0', modelPath: 'models/efficientnet-b0/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 224, offset: 0 });
  // await loadClassify({ name: 'ImageNet EfficientNet B4', modelPath: 'models/efficientnet-b4/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 380, offset: 0 });
  // await loadClassify({ name: 'ImageNet EfficientNet B5', modelPath: 'models/efficientnet-b5/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 456, offset: 0 });
  // await loadClassify({ name: 'ImageNet EfficientNet B7', modelPath: 'models/efficientnet-b7/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 600, offset: 0 });
  // await loadClassify({ name: 'ImageNet-21k BiT-S R101x1', modelPath: 'models/bit-s-r101x1/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 224, offset: 1, classes: 'assets/ImageNet-Labels21k.json' });
  // await loadClassify({ name: 'ImageNet-21k BiT-M R101x1', modelPath: 'models/bit-m-r101x1/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 224, offset: 1, classes: 'assets/ImageNet-Labels21k.json' });
  await loadClassify({ name: 'iNaturalist Food MobileNet v1', modelPath: 'models/inaturalist/food/model.json', score: 0.3, scoreScale: 500, topK: 6, useFloat: false, tensorSize: 192, classes: 'assets/iNaturalist-Food-Labels.json', offset: 0 });
  await loadClassify({ name: 'iNaturalist Plants MobileNet v2', modelPath: 'models/inaturalist/plants/model.json', score: 0.2, scoreScale: 100, topK: 6, useFloat: false, tensorSize: 224, classes: 'assets/iNaturalist-Plants-Labels.json', offset: 0, background: 2101 });
  await loadClassify({ name: 'iNaturalist Birds MobileNet v2', modelPath: 'models/inaturalist/birds/model.json', score: 0.2, scoreScale: 100, topK: 6, useFloat: false, tensorSize: 224, classes: 'assets/iNaturalist-Birds-Labels.json', offset: 0, background: 964 });
  await loadClassify({ name: 'iNaturalist Insects MobileNet v2', modelPath: 'models/inaturalist/insects/model.json', score: 0.2, scoreScale: 100, topK: 6, useFloat: false, tensorSize: 224, classes: 'assets/iNaturalist-Insects-Labels.json', offset: 0, background: 1021 });

  log.result('Warming up ...');
  const warmup = await processImage.getImage('assets/warmup.jpg');
  await modelClassify.classify(models[0].model, warmup.canvas);

  const api = await fetch('/api/dir?folder=Samples/Objects/');
  const files = await api.json();
  log.result(`Received list from server: ${files.length} images`);

  log.result('Starting ...');
  const stats = [];
  // eslint-disable-next-line no-unused-vars
  for (const m in models) stats.push(0);
  for (const file of files) {
    const results = [];
    const image = await processImage.getImage(file);
    for (const m in models) {
      log.dot();
      const t0 = window.performance.now();
      const data = await modelClassify.classify(models[m].model, image.canvas);
      const t1 = window.performance.now();
      stats[m] += (t1 - t0);
      results.push({ model: models[m], data });
    }
    print(file, image, results);
  }
  log.result('');
  for (const m in models) log.result(`${models[m].name}: ${Math.round(stats[m]).toLocaleString()} ms / ${Math.round(stats[m] / files.length)} avg`);
}

async function detect() {
  log.result('Loading models ...');
  await loadDetect({ name: 'CoCo SSD v1', modelPath: 'models/cocossd-v1/model.json', score: 0.4, topK: 6, overlap: 0.5, exec: modelDetect.detectCOCO });
  // await loadDetect({ name: 'CoCo SSD v2', modelPath: 'models/cocossd-v2/model.json', score: 0.4, topK: 6, overlap: 0.5, exec: modelDetect.detectCOCO });
  // await loadDetect({ name: 'CoCo DarkNet/Yolo v1 Tiny', modelPath: 'models/yolo-v1-tiny/model.json', score: 0.4, topK: 6, overlap: 0.5, modelType: 'layers' });
  // await loadDetect({ name: 'CoCo DarkNet/Yolo v2 Tiny', modelPath: 'models/yolo-v2-tiny/model.json', score: 0.4, topK: 6, overlap: 0.5, modelType: 'layers' });
  // await loadDetect({ name: 'CoCo DarkNet/Yolo v3 Tiny', modelPath: 'models/yolo-v3-tiny/model.json', score: 0.4, topK: 6, overlap: 0.5, modelType: 'layers' });
  // await loadDetect({ name: 'CoCo DarkNet/Yolo v3 Full', modelPath: 'models/yolo-v3-full/model.json', score: 0.4, topK: 6, overlap: 0.5, modelType: 'layers' });
  // await loadDetect({ name: 'OpenImages SSD/MobileNet v2', modelPath: 'models/ssd-mobilenet-v2/model.json', score: 0.2, topK: 6, useFloat: true, classes: 'assets/OpenImage-Labels.json', exec: modelDetect.detectSSD });
  // await loadDetect({ name: 'OpenImages RCNN/Inception-ResNet v2', modelPath: 'models/rcnn-inception-resnet-v2/model.json', score: 0.2, topK: 6, useFloat: true, classes: 'assets/OpenImage-Labels.json', exec: modelDetect.detectSSD });

  log.result('Warming up ...');
  const warmup = await processImage.getImage('assets/warmup.jpg');
  // await modelDetect.detect(models[0].model, warmup.canvas);
  await modelDetect.exec(models[0].model, warmup.canvas);

  const api = await fetch('/api/dir?folder=Samples/Objects/');
  const files = await api.json();
  log.result(`Received list from server: ${files.length} images`);

  log.result('Starting ...');
  const stats = [];
  // eslint-disable-next-line no-unused-vars
  for (const m in models) stats.push(0);
  for (const file of files) {
    const results = [];
    const image = await processImage.getImage(file);
    for (const m in models) {
      log.dot();
      const t0 = window.performance.now();
      const data = await modelDetect.exec(models[m].model, image.canvas);
      const t1 = window.performance.now();
      stats[m] += (t1 - t0);
      results.push({ model: models[m], data });
    }
    print(file, image, results);
  }
  log.result('');
  for (const m in models) log.result(`${models[m].name}: ${Math.round(stats[m]).toLocaleString()} ms / ${Math.round(stats[m] / files.length)} avg`);
}

async function main() {
  init();
  $('#btn-classify').click(() => classify());
  $('#btn-detect').click(() => detect());
}

window.onload = main;
