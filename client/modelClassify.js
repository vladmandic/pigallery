let tf = window.tf;
let config = {
  modelPath: null,
  modelType: 'graph',
  score: 0.2,
  topK: 3,
  inputMin: 0,
  inputMax: 1,
  alignCorners: false,
  tensorSize: 224,
  offset: 1,
  scoreScale: 1,
  background: -1,
  useFloat: true,
};

async function load(cfg) {
  tf = window.tf;
  let model;
  config = { ...config, ...cfg };
  const loadOpts = {
    fetchFunc: (...args) => fetch(...args),
    fromTFHub: config.modelPath.includes('tfhub.dev'),
  };
  const modelPath = config.modelPath.endsWith('.json') ? config.modelPath : config.modelPath + '/model.json';
  if (config.modelType === 'graph') model = await tf.loadGraphModel(modelPath, loadOpts);
  if (config.modelType === 'layers') model = await tf.loadLayersModel(modelPath, loadOpts);
  const res = config.classes ? await fetch(config.classes) : await fetch(config.modelPath + '/classes.json');
  model.labels = await res.json();
  model.config = config;
  return model;
}

async function decodeValues(model, values) {
  const pairs = [];
  for (const i in values) pairs.push({ score: values[i], index: i });
  const results = pairs
    .filter((a) => ((a.score * model.config.scoreScale) > model.config.score) && (model.config.background !== parseInt(a.index, 10)))
    .sort((a, b) => b.score - a.score)
    .map((a) => {
      const id = parseInt(a.index) - model.config.offset; // offset indexes for some models
      const wnid = model.labels[id] ? model.labels[id][0] : a.index;
      const label = model.labels[id] ? model.labels[id][1] : `unknown id:${a.index}`;
      return { wnid, id, class: label.toLowerCase(), score: a.score * model.config.scoreScale };
    });
  if (results && results.length > model.config.topK) results.length = model.config.topK;
  return results;
}

async function classify(model, image) {
  const values = tf.tidy(() => {
    const buffer = tf.browser.fromPixels(image, 3);
    let cast;
    if (!model.config.useFloat) {
      cast = buffer;
    } else {
      const bufftmp = tf.cast(buffer, 'float32');
      cast = tf.mul(bufftmp, [(model.config.inputMax - model.config.inputMin) / 255.0]);
      tf.dispose(bufftmp);
    }
    const offset = model.config.inputMin > 0 ? tf.add(cast, model.config.inputMin) : cast;
    const resized = tf.image.resizeBilinear(offset, [model.config.tensorSize, model.config.tensorSize], model.config.alignCorners);
    const reshaped = tf.reshape(resized, [-1, model.config.tensorSize, model.config.tensorSize, 3]);
    const predictions = model.predict(reshaped);
    const prediction = Array.isArray(predictions) ? predictions[0] : predictions; // some models return prediction for multiple objects in array, some return single prediction
    const softmax = prediction.softmax();
    const data = softmax.dataSync();
    tf.dispose(buffer);
    tf.dispose(cast);
    tf.dispose(offset);
    tf.dispose(resized);
    tf.dispose(reshaped);
    tf.dispose(predictions);
    tf.dispose(softmax);
    return data;
  });
  const decoded = await decodeValues(model, values);
  return decoded;
}

module.exports = {
  config,
  load,
  classify,
};

/*
      const normalized1 = img.toFloat().div(this.normalizationOffset);
      const resized1 = tf.image.resizeBilinear(normalized1, [model.config.tensorSize, model.config.tensorSize], model.config.alignCorners);
      const batched1 = resized1.reshape([1, model.config.tensorSize, model.config.tensorSize, 3]);
*/
