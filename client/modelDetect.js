/* eslint-disable no-use-before-define */

const tf = require('@tensorflow/tfjs');

let config = {
  modelPath: null,
  modelType: 'graph',
  score: 0.2,
  topK: 3,
  inputMin: -1,
  inputMax: 1,
  overlap: 0.1,
  softNmsSigma: 0,
  useFloat: false,
  classes: 'assets/Coco-Labels.json',
  exec: detectCOCO,
};

async function load(cfg) {
  let model;
  config = { ...config, ...cfg };
  if (config.modelType === 'graph') model = await tf.loadGraphModel(config.modelPath);
  if (config.modelType === 'layers') model = await tf.loadLayersModel(config.modelPath);
  const res = await fetch(config.classes);
  model.labels = await res.json();
  model.config = config;
  return model;
}

function buildDetectedObjects(model, batched, result, maxScores, classes, index) {
  const width = batched.shape[2];
  const height = batched.shape[1];
  const boxes = result[1].dataSync();
  const indexes = index.dataSync();
  tf.dispose(batched);
  tf.dispose(result);
  tf.dispose(index);
  const count = indexes.length;
  const objects = [];
  for (let i = 0; i < count; i++) {
    const box = [];
    for (let j = 0; j < 4; j++) {
      box[j] = boxes[indexes[i] * 4 + j];
    }
    const minY = box[0] * height;
    const minX = box[1] * width;
    const maxY = box[2] * height;
    const maxX = box[3] * width;
    box[0] = minX;
    box[1] = minY;
    box[2] = maxX - minX;
    box[3] = maxY - minY;
    objects.push({ box, class: model.labels[classes[indexes[i]] + 1].displayName, score: maxScores[indexes[i]] });
  }
  return objects;
}

function calculateMaxScores(result) {
  const allScores = result[0].dataSync();
  const numBoxes = result[0].shape[1];
  const numClasses = result[0].shape[2];
  const scores = [];
  const classes = [];
  for (let i = 0; i < numBoxes; i++) {
    let max = Number.MIN_VALUE;
    let index = -1;
    for (let j = 0; j < numClasses; j++) {
      if (allScores[i * numClasses + j] > max) {
        max = allScores[i * numClasses + j];
        index = j;
      }
    }
    scores[i] = max;
    classes[i] = index;
  }
  return [scores, classes];
}

async function detectCOCO(model, image) {
  const imgBuf = tf.browser.fromPixels(image, 3);
  const expanded = imgBuf.expandDims(0);
  let batched;
  if (!model.config.useFloat) {
    batched = expanded;
  } else {
    const cast = tf.cast(expanded, 'float32');
    batched = tf.mul(cast, [1.0 / 255.0]);
  }
  const result = await model.executeAsync(batched);
  const [scores, classes] = calculateMaxScores(result);
  const reshaped = tf.tensor2d(result[1].dataSync(), [result[1].shape[1], result[1].shape[3]]);
  const index = tf.image.nonMaxSuppression(reshaped, scores, model.config.topK, model.config.overlap, model.config.score, model.config.softNmsSigma); // async version leaks 2 tensors
  const results = buildDetectedObjects(model, batched, result, scores, classes, index); // disposes of batched, result, index
  tf.dispose(imgBuf);
  tf.dispose(reshaped);
  return results;
}

async function detectSSD(model, image) {
  const imgBuf = tf.browser.fromPixels(image, 3);
  const expanded = imgBuf.expandDims(0);
  let batched;
  if (!model.config.useFloat) {
    batched = expanded;
  } else {
    const cast = tf.cast(expanded, 'float32');
    batched = tf.mul(cast, [1.0 / 255.0]);
    tf.dispose(cast);
  }
  // console.log('execute start', model); look at model.inputs and model.outputs on how to execute a model
  const result = await model.executeAsync({ images: batched }, ['module_apply_default/hub_input/strided_slice_1', 'module_apply_default/hub_input/strided_slice_2', 'module_apply_default/hub_input/strided_slice']); // scores, classes, boxes
  // console.log('execute end', model, result); model.outputs map to result
  // for (const data of result) console.log(data, data.dataSync());
  const scores = result[0].dataSync();
  const classes = result[1].dataSync();
  const boxes = result[2].dataSync();
  const width = batched.shape[2];
  const height = batched.shape[1];
  tf.dispose(batched);
  tf.dispose(result);
  tf.dispose(imgBuf);
  let objects = [];
  for (const i in scores) {
    const box = [];
    const minY = boxes[i * 4 + 0] * height;
    const minX = boxes[i * 4 + 1] * width;
    const maxY = boxes[i * 4 + 2] * height;
    const maxX = boxes[i * 4 + 3] * width;
    box[0] = minX;
    box[1] = minY;
    box[2] = maxX - minX;
    box[3] = maxY - minY;
    // const box = [boxes[i * 4 + 0], boxes[i * 4 + 1], boxes[i * 4 + 2], boxes[i * 4 + 3]];
    const label = model.labels[classes[i]].displayName.toLowerCase();
    objects.push({ class: label, score: scores[i], box });
  }
  objects = objects
    .filter((a) => a.score > model.config.score)
    .sort((a, b) => b.score - a.score);
  if (objects.length > model.config.topK) objects.length = model.config.topK;
  return objects;
}

async function exec(model, image) {
  const result = await model.config.exec(model, image);
  return result;
}

module.exports = {
  config,
  load,
  exec,
  detectCOCO,
  detectSSD,
};
