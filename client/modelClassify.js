let tf = window.tf;
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
  background: -1,
  classes: 'assets/ImageNet-Labels1000.json',
};

async function load(cfg) {
  tf = window.tf;
  let model;
  config = { ...config, ...cfg };
  const loadOpts = {
    fetchFunc: (...args) => fetch(...args),
    fromTFHub: config.modelPath.includes('tfhub.dev'),
  };
  if (config.modelType === 'graph') model = await tf.loadGraphModel(config.modelPath, loadOpts);
  if (config.modelType === 'layers') model = await tf.loadLayersModel(config.modelPath, loadOpts);
  const res = await fetch(config.classes);
  model.labels = await res.json();
  model.config = config;
  return model;
}

async function decodeValues(model, values) {
  const pairs = [];
  for (const i in values) pairs.push({ score: values[i], index: i });
  const results = pairs
    .filter((a) => (a.score * model.config.scoreScale > model.config.score) && (parseInt(a.index, 10) !== model.config.background))
    .sort((a, b) => b.score - a.score)
    // .filter((a) => a.index !== model.config.background)
    .map((a) => {
      const id = a.index - model.config.offset; // offset indexes for some models
      const wnid = model.labels[id] ? model.labels[id][0] : a.index;
      const label = model.labels[id] ? model.labels[id][1] : `unknown id:${a.index}`;
      // console.log(id, wnid, label);
      return { wnid, id, class: label.toLowerCase(), score: a.score * model.config.scoreScale };
    });
  if (results && results.length > model.config.topK) results.length = model.config.topK;
  return results;
}

async function classify(model, image) {
  const values = tf.tidy(() => {
    const imgBuf = tf.browser.fromPixels(image, 3);
    const bufFloat = tf.cast(imgBuf, 'float32'); // imgBuf.toFloat();
    const mul = tf.mul(bufFloat, (model.config.inputMax - model.config.inputMin) / 255.0); // bufFloat.mul((model.config.inputMax - model.config.inputMin) / 255.0);
    const add = tf.add(mul, model.config.inputMin); // mul.add(model.config.inputMin);
    const resized = tf.image.resizeBilinear(add, [model.config.tensorSize, model.config.tensorSize], model.config.alignCorners);
    const reshaped = tf.reshape(resized, [-1, model.config.tensorSize, model.config.tensorSize, model.config.tensorShape]); // resized.reshape([-1, model.config.tensorSize, model.config.tensorSize, model.config.tensorShape]);
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
  return decoded;
}

module.exports = {
  config,
  load,
  classify,
};
