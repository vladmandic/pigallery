import * as tf from '@vladmandic/tfjs/dist/tfjs.esm';

const defaults = {
  modelPath: null,
  modelType: 'graph',
  minScore: 0.1,
  maxResults: 50,
  normalizeInput: 1 / 255, // value:(1) = range:(0..255), value=(1/255) = range:(0..1), value:(-1 + 1/127.5) = range:(-1..1)
  tensorSize: 224,
  offset: 0,
  scaleScore: 1,
  background: -1,
  softmax: true,
};

export async function load(userConfig) {
  let model = { config: { ...defaults, ...userConfig } };
  if (!model.config.modelPath) throw new Error('Error loading model: path is null');
  const loadOpts = {
    // fetchFunc: (...args) => fetch(...args),
    // requestInit: { mode: 'no-cors' },
    fromTFHub: model.config.modelPath.includes('tfhub.dev'), // dynamically change flag depending on model url
  };
  const modelPath = (!loadOpts.fromTFHub && !model.config.modelPath.endsWith('model.json')) ? `${model.config.modelPath}/model.json` : model.config.modelPath; // append model.json if not present
  try {
    const saveConfig = model.config;
    if (model.config.modelType === 'layers') model = await tf.loadLayersModel(modelPath, loadOpts);
    // @ts-ignore typescript error due to appending extra properties
    else model = await tf.loadGraphModel(modelPath, loadOpts);
    model.config = saveConfig;
    model['name'] = model.config.name;
  } catch (err) {
    throw new Error(`Error loading model: ${modelPath} message:${err.message}`);
  }
  try {
    const res = model.config.classes ? await fetch(model.config.classes) : await fetch(`${model.config.modelPath}/classes.json`); // load classes json file from modelpath/classes.json or user provided url
    model['labels'] = await res.json();
  } catch (err) {
    throw new Error(`Error loading classes: $${model.config.classes} message:${err.message}`);
  }
  return model;
}

async function decodeValues(model, values) {
  const pairs:Array<{ score: number, index: string }> = [];
  for (const i in values) pairs.push({ score: values[i], index: i });
  // console.log('pairs', pairs.sort((a, b) => b.score - a.score));
  const results = pairs
    .filter((a) => ((a.score * model.config.scaleScore) > model.config.minScore) && (model.config.background !== parseInt(a.index)))
    .sort((a, b) => b.score - a.score)
    .map((a) => {
      const id = parseInt(a.index) - model.config.offset; // offset indexes for some models
      const wnid = model.labels[id] ? model.labels[id][0] : a.index;
      const label = model.labels[id] ? model.labels[id][1]?.toLowerCase() : `unknown id:${a.index}`;
      const score = Math.min(1, Math.trunc(model.config.scaleScore * 10000 * a.score) / 10000); // limit score to 100% in case of scaled scores
      return { id, wnid, score, class: label, model: model.config.name };
    });
  if (results.length > (2 * model.config.maxResults)) results.length = 2 * model.config.maxResults; // rought cut to guard against huge result sets
  const duplicates:Array<any> = [];
  const filtered = results.filter((a) => { // filter out duplicate classes
    if (duplicates.includes(a.class)) return false;
    duplicates.push(a.class);
    return true;
  });
  if (filtered.length > model.config.maxResults) filtered.length = model.config.maxResults; // cut results to maximum length
  return filtered;
}

async function getImage(model, image) {
  // read image pixels or use tensor as-is
  const bufferT = image instanceof tf.Tensor ? tf.clone(image) : tf.browser.fromPixels(image, 3);
  // resize to expected model input size
  const resizedT = tf.image.resizeBilinear(bufferT, [model.config.tensorSize, model.config.tensorSize], false);
  const expandedT = resizedT.shape.length < 4 ? tf.expandDims(resizedT, 0) : tf.clone(resizedT);
  // casting depends on model input data type
  const castedT = model.inputs[0].dtype === 'int32' ? tf.clone(expandedT) : tf.cast(expandedT, 'float32');
  // normalization is on-demand
  const imageT = model.config.normalizeInput === 1 ? tf.clone(castedT) : tf.mul(castedT, [model.config.normalizeInput]);
  tf.dispose([bufferT, resizedT, castedT, expandedT]);
  return imageT;
}

export async function classify(model, image, userConfig = {}) {
  // allow changes of configurations on the fly to play with nms settings
  if (userConfig) model.config = { ...model.config, ...userConfig };

  // get image tensor
  const imageT = await getImage(model, image);

  // run prediction
  const predictionsT = model.predict(imageT);
  imageT.dispose();

  // get best results
  const predictionT0 = Array.isArray(predictionsT) ? predictionsT[0] : predictionsT; // some models return prediction for multiple objects in array, some return single prediction
  const softmaxT = model.config.softmax ? tf.softmax(predictionT0) : tf.clone(predictionT0);
  if (Array.isArray(predictionsT)) for (const tensorT of predictionsT) tensorT.dispose();
  else tf.dispose(predictionsT);
  const softmax = await softmaxT.data();
  tf.dispose(softmaxT);

  // decode result data
  const decoded = await decodeValues(model, softmax);
  return decoded;
}
