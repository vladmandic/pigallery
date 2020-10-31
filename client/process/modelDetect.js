import * as tf from '@tensorflow/tfjs/dist/tf.es2017.js';
import * as custom from './custom.js';

const defaults = {
  modelPath: null, // required
  maxResults: 50, // used by nms
  iouThreshold: 0.5, // used by nms
  minScore: 0.1, // used by nms
  normalizeInput: 1, // value:(1) = range:(0..255), value=(1/255) = range:(0..1), value:(-1 + 1/127.5) = range:(-1..1)
  scaleScore: 1, // use if scores are off by order of magniture
  map: { boxes: 'Identity_1:0', scores: 'Identity_4:0', classes: 'Identity_2:0' }, // defaults map to tfhub object detection models
  classes: null, // set to url or leave as null to load classes.json from modelPath
  switchAxis: false,
  softmax: false,
};

async function load(userConfig) {
  let model = { config: { ...defaults, ...userConfig } };
  if (!model.config.modelPath) throw new Error('Error loading model: path is null');
  const loadOpts = {
    fetchFunc: (...args) => fetch(...args),
    requestInit: { mode: 'no-cors' },
    fromTFHub: model.config.modelPath.includes('tfhub.dev'), // dynamically change flag depending on model url
  };
  const modelPath = (!loadOpts.fromTFHub && !model.config.modelPath.endsWith('model.json')) ? model.config.modelPath + '/model.json' : model.config.modelPath; // append model.json if not present
  try {
    const saveConfig = model.config;
    model = await tf.loadGraphModel(modelPath, loadOpts);
    model.config = saveConfig;
    model.name = model.config.name;
  } catch (err) {
    throw new Error(`Error loading model: $${modelPath} message:${err.message}`);
  }
  try {
    const res = model.config.classes ? await fetch(model.config.classes) : await fetch(model.config.modelPath + '/classes.json'); // load classes json file from modelpath/classes.json or user provided url
    if (res && res.ok) model.labels = await res.json();
    else throw new Error(`classes file is missing: ${model.config.classes} status: ${res.status}`);
  } catch (err) {
    throw new Error(`Error loading classes: ${model.config.classes} message: ${err.message}`);
  }
  return model;
}

async function getImage(model, image) {
  // read image pixels or use tensor as-is
  const bufferT = image instanceof tf.Tensor ? tf.clone(image) : tf.browser.fromPixels(image, 3);
  const expandedT = bufferT.shape.length < 4 ? tf.expandDims(bufferT, 0) : tf.clone(bufferT);
  bufferT.dispose();

  // casting depends on model input data type
  const castedT = model.inputs[0].dtype === 'int32' ? tf.clone(expandedT) : tf.cast(expandedT, 'float32');
  expandedT.dispose();

  // normalization is on-demand
  const imageT = model.config.normalizeInput === 1 ? tf.clone(castedT) : tf.mul(castedT, [model.config.normalizeInput]);
  castedT.dispose();
  return imageT;
}

async function detect(model, image, userConfig) {
  // allow changes of configurations on the fly to play with nms settings
  if (userConfig) model.config = { ...model.config, ...userConfig };

  // get image tensor
  const imageT = await getImage(model, image);

  // execute model
  const res = await model.executeAsync(imageT, [model.config.map.boxes, model.config.map.scores, model.config.map.classes]);
  // find results
  const boxesT = res[0].shape.length > 2 ? res[0].squeeze() : res[0].clone(); // boxes can be 3d or 2d in some models
  const softmaxT = model.config.softmax ? res[1].softmax() : res[1].clone();
  const boxes = await boxesT.array();
  const scores = await softmaxT.data();
  const classes = await res[2].data();
  for (const tensorT of res) tensorT.dispose();
  softmaxT.dispose();
  boxesT.dispose();

  // sort & filter results using nms feature
  const nmsT = await tf.image.nonMaxSuppressionAsync(boxes, scores, model.config.maxResults, model.config.iouThreshold, model.config.minScore / model.config.scaleScore);
  const nms = await nmsT.data();
  nmsT.dispose();
  // console.log(`executeAsync: ${Math.trunc(t1 - t0)} ms`);
  // console.log(`allocated: ${Math.trunc(tf.memory().numBytesInGPUAllocated / 1024 / 1024)} MB free: ${Math.trunc(tf.memory().numBytesInGPUFree / 1024 / 1024)} MB limit: ${Math.trunc(tf.engine().backendInstance.numMBBeforeWarning)} MB`);

  // create result object
  const detected = [];
  for (const i in nms) {
    const id = parseInt(i);
    const scaleOutput = ((boxes[id][0] > 0 && boxes[id][0] < 1) || (boxes[id][1] > 0 && boxes[id][1] < 1));
    // not sure if model output is x,y or y,x
    const a = boxes[id][0];
    const b = boxes[id][1];
    const c = boxes[id][2] - a;
    const d = boxes[id][3] - b;
    const width = model.config.switchAxis ? imageT.shape[1] : imageT.shape[2];
    const height = model.config.switchAxis ? imageT.shape[2] : imageT.shape[1];
    detected.push({
      score: Math.min(1, Math.trunc(model.config.scaleScore * 10000 * scores[i]) / 10000), // limit score to 100% in case of scaled scores
      id: classes[id],
      class: model.labels[classes[id]].displayName,
      bbox: { // switch box from y0,x0,y1,x1 to x,y,width,height and potentially scale it if model returns coordinates in range 0..1
        x: Math.trunc((scaleOutput ? width : 1) * (model.config.switchAxis ? a : b)),
        y: Math.trunc((scaleOutput ? height : 1) * (model.config.switchAxis ? b : a)),
        width: Math.trunc((scaleOutput ? width : 1) * (model.config.switchAxis ? c : d)),
        height: Math.trunc((scaleOutput ? height : 1) * (model.config.switchAxis ? d : c)),
      },
    });
  }
  const results = detected.filter((a) => a.score > model.config.minScore); // filter by score one more time as nms can miss items
  if (model.config.postProcess) {
    try {
      const data = await custom[model.config.postProcess](model, detected); // hack to call a named function
      if (data) results.unshift(...data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('Post process error:', err.message);
    }
  }
  // cleanup and return results
  imageT.dispose();
  return results;
}

module.exports = {
  load,
  detect,
};
