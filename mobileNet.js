import * as tf from '@tensorflow/tfjs';
import classesImageNet from './assets/ImageNetLabels.json';

let config = {
  modelPath: null,
  score: 0.2,
  topK: 3,
  inputMin: 0,
  inputMax: 1,
  alignCorners: true,
};
let model;

async function getTopK(logits, topK, score) {
  const softmax = logits.softmax();
  tf.dispose(logits);
  logits.dispose();
  const values = await softmax.data();
  tf.dispose(softmax);
  softmax.dispose();
  const valuesAndIndices = [];
  for (let i = 0; i < values.length; i++) valuesAndIndices.push({ value: values[i], index: i });
  valuesAndIndices.sort((a, b) => b.value - a.value);
  const topkValues = new Float32Array(topK);
  const topkIndices = new Int32Array(topK);
  for (let i = 0; i < topK; i++) {
    topkValues[i] = valuesAndIndices[i].value;
    topkIndices[i] = valuesAndIndices[i].index;
  }
  const topClassesAndProbs = [];
  for (let i = 0; i < topkIndices.length; i++) {
    topClassesAndProbs.push({ id: classesImageNet[topkIndices[i]][0], class: classesImageNet[topkIndices[i]][1], score: topkValues[i] });
  }
  const filtered = topClassesAndProbs.filter((a) => a.score > score);
  return filtered;
}

async function load(cfg) {
  config = { ...config, ...cfg };
  model = await tf.loadGraphModel(config.modelPath);
  // eslint-disable-next-line no-use-before-define
  return mobilenet;
}

async function classify(image) {
  const imgBuf = tf.browser.fromPixels(image, 3);
  const bufFloat = imgBuf.toFloat();
  const mul = bufFloat.mul((config.inputMax - config.inputMin) / 255.0);
  const add = mul.add(config.inputMin);
  const resized = tf.image.resizeBilinear(add, [224, 224], config.alignCorners);
  const reshaped = resized.reshape([-1, 224, 224, 3]);
  const logits = model.predict(reshaped);
  const sliced = logits.slice([0, 1], [-1, 1000]);
  const results = await getTopK(sliced, config.topK, config.score);
  imgBuf.dispose();
  bufFloat.dispose();
  mul.dispose();
  add.dispose();
  resized.dispose();
  reshaped.dispose();
  logits.dispose();
  sliced.dispose();
  return results;
}

const mobilenet = {
  load,
  classify,
};

export default mobilenet;
