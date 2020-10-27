import * as tf from '@tensorflow/tfjs/dist/tf.es2017.js';
import * as log from '../shared/log.js';
import * as modelClassify from '../process/modelClassify.js';
import * as definitions from '../shared/models.js';

let objects;

function setObjects(inObjects) {
  objects = inObjects;
}

async function runClassify(name, input, config) {
  const t0 = performance.now();
  if (!objects.models[name]) {
    document.getElementById('status').innerText = `loading model: ${name} ...`;
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
  const res = await modelClassify.classify(objects.models[name], input);
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
  return { name: res };
}

async function runFood(input, config) {
  // https://tfhub.dev/google/aiy/vision/classifier/food_V1/1
  return runClassify('food', input, config);
}

async function runPlants(input, config) {
  // https://tfhub.dev/google/aiy/vision/classifier/plants_V1/1
  return runClassify('plants', input, config);
}

async function runBirds(input, config) {
  // https://tfhub.dev/google/aiy/vision/classifier/birds_V1/1
  return runClassify('birds', input, config);
}

async function runInsects(input, config) {
  // https://tfhub.dev/google/aiy/vision/classifier/insects_V1/1
  return runClassify('insects', input, config);
}

async function runImageNet(input, config) {
  // https://tfhub.dev/tensorflow/efficientnet/b0/classification/1
  return runClassify('imagenet', input, config);
}

async function runDeepDetect(input, config) {
  return runClassify('deepdetect', input, config);
}

// exports.facemesh = runFaceMesh;
exports.food = runFood;
exports.plants = runPlants;
exports.birds = runBirds;
exports.insects = runInsects;
exports.imagenet = runImageNet;
exports.deepdetect = runDeepDetect;
exports.set = setObjects;
