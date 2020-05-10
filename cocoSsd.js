import * as tf from '@tensorflow/tfjs';
import * as labels from './assets/CocoSSDLabels.json';

let config = {
  modelPath: null,
  score: 0.2,
  topK: 3,
  inputMin: -1,
  inputMax: 1,
};
let model;

function buildDetectedObjects(width, height, boxes, scores, indexes, classes) {
  const count = indexes.length;
  const objects = [];
  for (let i = 0; i < count; i++) {
    const bbox = [];
    for (let j = 0; j < 4; j++) {
      bbox[j] = boxes[indexes[i] * 4 + j];
    }
    const minY = bbox[0] * height;
    const minX = bbox[1] * width;
    const maxY = bbox[2] * height;
    const maxX = bbox[3] * width;
    bbox[0] = minX;
    bbox[1] = minY;
    bbox[2] = maxX - minX;
    bbox[3] = maxY - minY;
    objects.push({ bbox, class: labels[classes[indexes[i]] + 1].displayName, score: scores[indexes[i]] });
  }
  return objects;
}

function calculateMaxScores(scores, numBoxes, numClasses) {
  const maxes = [];
  const classes = [];
  for (let i = 0; i < numBoxes; i++) {
    let max = Number.MIN_VALUE;
    let index = -1;
    for (let j = 0; j < numClasses; j++) {
      if (scores[i * numClasses + j] > max) {
        max = scores[i * numClasses + j];
        index = j;
      }
    }
    maxes[i] = max;
    classes[i] = index;
  }
  return [maxes, classes];
}

async function load(cfg) {
  config = { ...config, ...cfg };
  model = await tf.loadGraphModel(config.modelPath);
  // eslint-disable-next-line no-use-before-define
  return cocossd;
}

async function detect(image) {
  const imgBuf = tf.browser.fromPixels(image, 3);
  const batched = tf.tidy(() => imgBuf.expandDims(0));
  const result = await model.executeAsync(batched);
  const scores = result[0].dataSync();
  const boxes = result[1].dataSync();
  const [maxScores, classes] = calculateMaxScores(scores, result[0].shape[1], result[0].shape[2]);
  const indexTensor = tf.tidy(() => {
    const boxes2 = tf.tensor2d(boxes, [result[1].shape[1], result[1].shape[3]]);
    const tensor = tf.image.nonMaxSuppression(boxes2, maxScores, config.topK, 0.5, 0.5); // nonMaxSuppressionAsync
    boxes2.dispose();
    return tensor;
  });
  const indexes = await indexTensor.dataSync();
  const results = buildDetectedObjects(batched.shape[2], batched.shape[1], boxes, maxScores, indexes, classes);
  imgBuf.dispose();
  batched.dispose();
  indexTensor.dispose();
  return results;
}

const cocossd = {
  load,
  detect,
};

export default cocossd;
