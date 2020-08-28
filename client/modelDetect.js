let tf = window.tf;
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
  const expanded = tf.expandDims(imgBuf, 0);
  let batched;
  if (!model.config.useFloat) {
    batched = expanded;
  } else {
    const cast = tf.cast(expanded, 'float32');
    batched = tf.mul(cast, [1.0 / 255.0]);
    tf.dispose(expanded);
    tf.dispose(cast);
  }
  const result = await model.executeAsync(batched);
  const [scores, classes] = calculateMaxScores(result);
  const reshaped = tf.tensor2d(result[1].dataSync(), [result[1].shape[1], result[1].shape[3]]);
  // const index = tf.image.nonMaxSuppression(reshaped, scores, model.config.topK, model.config.overlap, model.config.score, model.config.softNmsSigma); // async version leaks 2 tensors
  const index = await tf.image.nonMaxSuppressionAsync(reshaped, scores, model.config.topK, model.config.overlap, model.config.score, model.config.softNmsSigma);
  const results = buildDetectedObjects(model, batched, result, scores, classes, index); // disposes of batched, result, index
  tf.dispose(imgBuf);
  tf.dispose(reshaped);
  return results;
}

async function detectSSD(model, image) {
  const imgBuf = tf.browser.fromPixels(image, 3);
  const expanded = tf.expandDims(imgBuf, 0);
  let batched;
  if (!model.config.useFloat) {
    batched = expanded;
  } else {
    const cast = tf.cast(expanded, 'float32');
    batched = tf.mul(cast, [1.0 / 255.0]);
    tf.dispose(cast);
    tf.dispose(expanded);
    tf.dispose(cast);
  }
  // console.log('execute start', model); // look at model.inputs and model.outputs on how to execute a model
  const result = await model.executeAsync({ images: batched }, ['module_apply_default/hub_input/strided_slice_1', 'module_apply_default/hub_input/strided_slice_2', 'module_apply_default/hub_input/strided_slice']); // scores, classes, boxes
  // console.log('execute end', model, result); model.outputs map to result
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
  let result;
  if (model.config.exec === 'coco') result = await detectCOCO(model, image);
  if (model.config.exec === 'ssd') result = await detectSSD(model, image);
  return result;
}

module.exports = {
  config,
  load,
  exec,
  detectCOCO,
  detectSSD,
};
