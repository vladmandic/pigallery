import * as tf from '@tensorflow/tfjs';
import classesImageNet from './assets/ImageNet-Labels1000.json';

let config = {
  modelPath: null,
  modelType: 'graph',
  score: 0.2,
  topK: 3,
  inputMin: 0,
  inputMax: 1,
  alignCorners: true,
  tensorSize: 224,
  tensorShape: 3,
};
let model;

async function load(cfg) {
  config = { ...config, ...cfg };
  const tfHub = config.modelPath.includes('tfhub.dev');
  if (config.modelType === 'graph') model = await tf.loadGraphModel(config.modelPath, { fromTFHub: tfHub });
  if (config.modelType === 'layers') model = await tf.loadLayersModel(config.modelPath, { fromTFHub: tfHub });
  // eslint-disable-next-line no-use-before-define
  return exported;
}

async function decodeValues(values) {
  const valuesAndIndices = [];
  for (const i in values) valuesAndIndices.push({ score: values[i], index: i });
  const results = valuesAndIndices
    .filter((a) => a.score > config.score)
    .sort((a, b) => b.score - a.score)
    .map((a) => {
      // offset indexes by -1 to avoid uncessary slice
      const id = classesImageNet[a.index - 1] ? classesImageNet[a.index - 1][0] : a.index;
      const label = classesImageNet[a.index - 1] ? classesImageNet[a.index - 1][1] : `unknown id:${a.index}`;
      return { id, class: label, score: a.score };
    });
  if (results && results.length > config.topK) results.length = config.topK;
  return results;
}

async function classify(image) {
  const values = tf.tidy(() => {
    const imgBuf = tf.browser.fromPixels(image, 3);
    const bufFloat = imgBuf.toFloat();
    const mul = bufFloat.mul((config.inputMax - config.inputMin) / 255.0);
    const add = mul.add(config.inputMin);
    const resized = tf.image.resizeBilinear(add, [config.tensorSize, config.tensorSize], config.alignCorners);
    const reshaped = resized.reshape([-1, config.tensorSize, config.tensorSize, config.tensorShape]);
    const predictions = model.predict(reshaped);
    const prediction = Array.isArray(predictions) ? predictions[0] : predictions; // some models return prediction for multiple objects in array, some return single prediction
    const softmax = prediction.softmax();
    const data = softmax.dataSync();
    return data;
  });
  return decodeValues(values);
}

const exported = {
  config,
  load,
  classify,
};

export default exported;
