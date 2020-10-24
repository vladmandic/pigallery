import * as tf from '@tensorflow/tfjs/dist/tf.esnext.js';

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
};

async function load(cfg) {
  let model;
  config = { ...config, ...cfg };
  const loadOpts = {
    fetchFunc: (...args) => fetch(...args),
    requestInit: { mode: 'no-cors' },
    fromTFHub: config.modelPath.includes('tfhub.dev') || config.tgz,
  };
  const modelPath = (!loadOpts.fromTFHub && !config.tgz && !config.modelPath.endsWith('model.json')) ? config.modelPath + '/model.json' : config.modelPath;
  if (config.modelType === 'graph') model = await tf.loadGraphModel(modelPath, loadOpts);
  if (config.modelType === 'layers') model = await tf.loadLayersModel(modelPath, loadOpts);
  const res = config.classes ? await fetch(config.classes) : await fetch(config.modelPath + '/classes.json');
  model.labels = await res.json();
  model.config = config;
  return model;
}

async function detect(model, image) {
  // set variables
  const maxResults = model.config.maxResults || 50;
  const iouThreshold = model.config.iouThreshold || 0.5;
  const minScore = model.config.minScore || 0.1;
  const normalizeInput = model.config.normalizeInput || 1;
  const scaleOutput = model.config.scaleOutput || false;
  const scaleScore = model.config.scaleScore || 1;

  // get image tensor
  // casting and normalization is on-demand

  const bufferT = image instanceof tf.Tensor ? tf.clone(image) : tf.browser.fromPixels(image, 3);
  const expandedT = bufferT.shape.length < 4 ? tf.expandDims(bufferT, 0) : tf.clone(bufferT);
  bufferT.dispose();
  const castedT = model.inputs[0].dtype === 'int32' ? tf.clone(expandedT) : tf.cast(expandedT, 'float32');
  expandedT.dispose();
  const imageT = normalizeInput === 1 ? tf.clone(castedT) : tf.mul(castedT, [normalizeInput]);
  castedT.dispose();
  const width = imageT.shape[2];
  const height = imageT.shape[1];

  // execute model
  const res = await model.executeAsync(imageT);
  imageT.dispose();

  // find results
  res.sort((a, b) => b.shape.length - a.shape.length); // sort results by complexity of tensors
  const boxesT = res[0]; // boxes is largest tensor, but remove extra dimension if present
  const scoresT = res[1]; // scores are next
  const classesT = res[2]; // classes are last

  const boxes = await boxesT.array(); // boxes data is as-is
  const scores = await scoresT.data();
  const classes = await classesT.data();

  // sort & filter results
  const filteredT = await tf.image.nonMaxSuppressionAsync(boxes, scores, maxResults, iouThreshold, minScore || 0.1);
  const filtered = await filteredT.data();
  filteredT.dispose();
  const detected = [];

  // create result object
  for (const i in filtered) {
    const id = parseInt(i);
    detected.push({
      score: (scaleScore) * Math.trunc(10000 * scores[i]) / 10000,
      id: classes[id],
      class: model.labels[classes[id]].displayName,
      bbox: {
        x: Math.trunc(boxes[0][id][0]) * (scaleOutput ? width : 1),
        y: Math.trunc(boxes[0][id][1]) * (scaleOutput ? height : 1),
        width: (Math.trunc((boxes[0][id][3] * (scaleOutput ? width : 1)) - (boxes[0][id][1])) * (scaleOutput ? width : 1)),
        height: (Math.trunc((boxes[0][id][2] * (scaleOutput ? height : 1)) - (boxes[0][id][0])) * (scaleOutput ? height : 1)),
      },
    });
  }
  return detected;
}

module.exports = {
  config,
  load,
  exec: detect,
};
