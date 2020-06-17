const tf = require('@tensorflow/tfjs');

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
  offset: 1,
  scoreScale: 1,
  classes: 'assets/ImageNet-Labels1000.json',
};

async function load(cfg) {
  let model;
  config = { ...config, ...cfg };
  const tfHub = config.modelPath.includes('tfhub.dev');
  if (config.modelType === 'graph') model = await tf.loadGraphModel(config.modelPath, { fromTFHub: tfHub });
  if (config.modelType === 'layers') model = await tf.loadLayersModel(config.modelPath, { fromTFHub: tfHub });
  const res = await fetch(config.classes);
  model.labels = await res.json();
  model.config = config;
  return model;
}

async function decodeValues(model, values) {
  const valuesAndIndices = [];
  for (const i in values) valuesAndIndices.push({ score: values[i], index: i });
  const results = valuesAndIndices
    .filter((a) => a.score * model.config.scoreScale > model.config.score)
    .sort((a, b) => b.score - a.score)
    .map((a) => {
      const id = a.index - model.config.offset; // offset indexes for some models
      const wnid = model.labels[id] ? model.labels[id][0] : a.index;
      const label = model.labels[id] ? model.labels[id][1] : `unknown id:${a.index}`;
      return { wnid, id, class: label, score: a.score * model.config.scoreScale };
    });
  if (results && results.length > model.config.topK) results.length = model.config.topK;
  return results;
}

async function classify(model, image) {
  const values = tf.tidy(() => {
    const imgBuf = tf.browser.fromPixels(image, 3);
    const bufFloat = imgBuf.toFloat();
    const mul = bufFloat.mul((model.config.inputMax - model.config.inputMin) / 255.0);
    const add = mul.add(model.config.inputMin);
    const resized = tf.image.resizeBilinear(add, [model.config.tensorSize, model.config.tensorSize], model.config.alignCorners);
    const reshaped = resized.reshape([-1, model.config.tensorSize, model.config.tensorSize, model.config.tensorShape]);
    let batched;
    if (!model.config.useFloat) {
      batched = reshaped;
    } else {
      const cast = tf.cast(reshaped, 'float32');
      batched = tf.mul(cast, [1.0 / 255.0]);
      tf.dispose(cast);
    }
    const predictions = model.predict(batched);
    const prediction = Array.isArray(predictions) ? predictions[0] : predictions; // some models return prediction for multiple objects in array, some return single prediction
    const softmax = prediction.softmax();
    const data = softmax.dataSync();
    return data;
  });
  const decoded = await decodeValues(model, values);
  // eslint-disable-next-line no-console
  if (window.debug) console.log(model, values, decoded);
  return decoded;
}

module.exports = {
  config,
  load,
  classify,
};
