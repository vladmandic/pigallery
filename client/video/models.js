import * as tf from '@tensorflow/tfjs/dist/tf.es2017.js';
import * as cocossd from '@tensorflow-models/coco-ssd/dist/coco-ssd.es2017.js';
import * as log from '../shared/log.js';
import * as draw from './draw.js';
import * as modelClassify from '../process/modelClassify.js';
import * as definitions from '../shared/models.js';

window.tf = tf;
let objects;

function setObjects(inObjects) {
  objects = inObjects;
}

function appendCanvas(name, width, height) {
  objects.canvases[name] = document.createElement('canvas', { desynchronized: true });
  objects.canvases[name].style.position = 'relative';
  objects.canvases[name].id = `canvas-${name}`;
  objects.canvases[name].style.position = 'absolute';
  objects.canvases[name].style.top = 0;
  objects.canvases[name].width = width;
  objects.canvases[name].height = height;
  document.getElementById('canvases').appendChild(objects.canvases[name]);
}

async function runCocoSSD(video, config) {
  // https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd
  const t0 = performance.now();
  if (!objects.models.cocossd && !(video.paused || video.ended)) {
    objects.perf.Frame = 0;
    document.getElementById('status').innerText = 'Loading model: COCO ...';
    const memory0 = await tf.memory();
    objects.models.cocossd = await cocossd.load({ base: 'mobilenet_v2' });
    const memory1 = await tf.memory();
    document.getElementById('status').innerText = '';
    log.div('log', true, `Loaded model CocoSSD: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!objects.models.cocossd) {
    log.div('log', true, 'Model CocoSSD not loaded');
    return {};
  }
  if (!objects.canvases.cocossd) appendCanvas('cocossd', video.offsetWidth, video.offsetHeight);
  const res = await objects.models.cocossd.detect(video, config.detect.maxObjects, config.detect.minThreshold);
  const t1 = performance.now();
  objects.perf.CocoSSD = Math.trunc(t1 - t0);
  if ((objects.perf.Frame === 0) || !objects.canvases.cocossd) return { cocossd: objects };
  const ctx = objects.canvases.cocossd.getContext('2d');
  ctx.clearRect(0, 0, objects.canvases.cocossd.width, objects.canvases.cocossd.height);
  for (const object of res) {
    const x = object.bbox[0];
    const y = object.bbox[1];
    const width = object.bbox[2];
    const height = object.bbox[3];
    if (config.ui.thumbnails) objects.extracted.push(draw.crop(video, x, y, width, height, { title: object.class }));
    const label = `${(100 * object.score).toFixed(1)}% ${object.class}`;
    objects.detected.push(label);
    ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    draw.rect({
      canvas: objects.canvases.cocossd,
      x: x * objects.canvases.cocossd.width / video.videoWidth,
      y: y * objects.canvases.cocossd.height / video.videoHeight,
      width: width * objects.canvases.cocossd.width / video.videoWidth,
      height: height * objects.canvases.cocossd.height / video.videoHeight,
      lineWidth: config.ui.lineWidth,
      color: config.ui.lineColor,
      title: label,
    });
  }
  return { cocossd: objects };
}

async function runClassify(name, video, config) {
  const t0 = performance.now();
  if (!objects.models[name] && !(video.paused || video.ended)) {
    objects.perf.Frame = 0;
    document.getElementById('status').innerText = `Loading model: ${name} ...`;
    const memory0 = await tf.memory();
    const opt = definitions.models.video[name];
    objects.models[name] = await modelClassify.load(opt);
    const memory1 = await tf.memory();
    document.getElementById('status').innerText = '';
    log.div('log', true, `Loaded model ${name}: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!objects.models[name]) {
    log.div('log', true, `Model ${name} not loaded`);
    return {};
  }
  if (!objects.canvases[name]) appendCanvas(name, video.offsetWidth, video.offsetHeight);
  const res = await modelClassify.classify(objects.models[name], video);
  if (res && res.lenght > 0) {
    for (const item of res) {
      if (item.score > config.classify.minThreshold) {
        const title = `${(100 * item.score).toFixed(1)}% ${name}:${res[0].class}`;
        objects.detected.push(title);
      }
    }
  }
  const t1 = performance.now();
  objects.perf[name] = Math.trunc(t1 - t0);
  const obj = {};
  obj[name] = res;
  return obj;
}

async function runFood(video, config) {
  // https://tfhub.dev/google/aiy/vision/classifier/food_V1/1
  return runClassify('food', video, config);
}

async function runPlants(video, config) {
  // https://tfhub.dev/google/aiy/vision/classifier/plants_V1/1
  return runClassify('plants', video, config);
}

async function runBirds(video, config) {
  // https://tfhub.dev/google/aiy/vision/classifier/birds_V1/1
  return runClassify('birds', video, config);
}

async function runInsects(video, config) {
  // https://tfhub.dev/google/aiy/vision/classifier/insects_V1/1
  return runClassify('insects', video, config);
}

async function runNSFW(video, config) {
  // https://github.com/infinitered/nsfwjs
  return runClassify('nsfw', video, config);
}

async function runImageNet(video, config) {
  // https://tfhub.dev/tensorflow/efficientnet/b0/classification/1
  return runClassify('imagenet', video, config);
}

async function runDeepDetect(video, config) {
  return runClassify('deepdetect', video, config);
}

// exports.facemesh = runFaceMesh;
exports.cocossd = runCocoSSD;
exports.food = runFood;
exports.plants = runPlants;
exports.birds = runBirds;
exports.insects = runInsects;
exports.nsfw = runNSFW;
exports.imagenet = runImageNet;
exports.deepdetect = runDeepDetect;
exports.set = setObjects;
