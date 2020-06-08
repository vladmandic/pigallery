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
  classes: 'assets/Coco-Labels.json',
  labels: {},
};

async function load(cfg) {
  let model;
  config = { ...config, ...cfg };
  if (config.modelType === 'graph') model = await tf.loadGraphModel(config.modelPath);
  if (config.modelType === 'layers') model = await tf.loadLayersModel(config.modelPath);
  const res = await fetch(config.classes);
  config.labels = await res.json();
  // eslint-disable-next-line no-use-before-define
  return model;
}

function buildDetectedObjects(batched, result, maxScores, classes, index) {
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
    objects.push({ box, class: config.labels[classes[indexes[i]] + 1].displayName, score: maxScores[indexes[i]] });
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

async function detect(model, image) {
  const imgBuf = tf.browser.fromPixels(image, 3);
  const batched = imgBuf.expandDims(0);
  const result = await model.executeAsync(batched);
  const [scores, classes] = calculateMaxScores(result);
  const reshaped = tf.tensor2d(result[1].dataSync(), [result[1].shape[1], result[1].shape[3]]);
  const index = tf.image.nonMaxSuppression(reshaped, scores, config.topK, config.overlap, config.score, config.softNmsSigma); // async version leaks 2 tensors
  const results = buildDetectedObjects(batched, result, scores, classes, index); // disposes of batched, result, index
  tf.dispose(imgBuf);
  tf.dispose(reshaped);
  return results;
}

module.exports = {
  config,
  load,
  detect,
};
