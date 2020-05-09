import * as tf from '@tensorflow/tfjs';
import * as labels from './assets/classesDetect.json';

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

export default class CocoSsd {
  constructor(config) {
    this.modelPath = config.modelPath || null;
    this.score = config.score || 0.2;
    this.topK = config.maxResults || 3;
    this.inputMin = config.inputMin || -1;
    this.inputMax = config.inputMax || 1;
    return this;
  }

  async load() {
    this.model = await tf.loadGraphModel(this.modelPath);
    return this.model;
  }

  async detect(image) {
    const imgBuf = tf.browser.fromPixels(image, 3);
    const batched = tf.tidy(() => imgBuf.expandDims(0));
    const result = await this.model.executeAsync(batched);
    const scores = result[0].dataSync();
    const boxes = result[1].dataSync();
    const height = batched.shape[1];
    const width = batched.shape[2];
    const [maxScores, classes] = calculateMaxScores(scores, result[0].shape[1], result[0].shape[2]);
    const indexTensor = tf.tidy(() => {
      const boxes2 = tf.tensor2d(boxes, [result[1].shape[1], result[1].shape[3]]);
      return tf.image.nonMaxSuppression(boxes2, maxScores, this.topK, 0.5, 0.5);
    });
    const indexes = indexTensor.dataSync();
    const results = buildDetectedObjects(width, height, boxes, maxScores, indexes, classes);
    batched.dispose();
    tf.dispose(result);
    indexTensor.dispose();
    return results;
  }
}
