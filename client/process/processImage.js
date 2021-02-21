import { tf } from '../shared/tf.js';
// eslint-disable-next-line import/order
import Human from '@vladmandic/human/dist/human.esm-nobundle.js';
import * as log from '../shared/log.js';
import * as modelClassify from './modelClassify.js';
import * as modelDetect from './modelDetect.js';
import * as hash from '../shared/blockhash.js';
import config from '../shared/config.js';

const models = {};
let error;

export function JSONtoStr(json) {
  if (!json) return '';
  let res = '';
  if (Array.isArray(json)) {
    for (const item of json) res += JSON.stringify(item).replace(/{|}|"/g, '').replace(/,/g, ', ');
  } else {
    res = JSON.stringify(json).replace(/{|}|"/g, '').replace(/,/g, ', ');
  }
  return res;
}

async function resetBackend(backendName) {
  /*
  const engine = tf.engine();
  if (backendName in engine.registry) {
    const backendFactory = tf.findBackendFactory(backendName);
    tf.removeBackend(backendName);
    tf.registerBackend(backendName, backendFactory);
  }
  */
  await tf.setBackend(backendName);
}

export async function load() {
  log.div('process-log', true, 'Starting Image Analsys');

  if (!config.models) {
    const req = await fetch('/api/models/get');
    if (req && req.ok) config.models = await req.json();
  }

  log.div('process-log', true, 'Image Classification models:');
  for (const model of config.models.classify) {
    log.div('process-log', true, `  ${JSONtoStr(model)}`);
  }
  log.div('process-log', true, 'Object Detection models:');
  for (const model of config.models.detect) {
    log.div('process-log', true, `  ${JSONtoStr(model)}`);
  }
  log.div('process-log', true, 'Face Detection model:');
  log.div('process-log', true, `  ${JSONtoStr(config.models.person)}`);
  const t0 = window.performance.now();

  log.div('process-log', true, 'TensorFlow models loading ...');

  if (config.models.person) {
    const human = new Human(config.models.person);
    await human.load(config.models.person);
    models.human = human;
  }

  models.classify = [];
  if (config.models.classify && config.models.classify.length > 0) {
    for (const cfg of config.models.classify) {
      const res = await modelClassify.load(cfg);
      models.classify.push(res);
    }
  }

  models.detect = [];
  if (config.models.detect && config.models.detect.length > 0) {
    for (const cfg of config.models.detect) {
      const res = await modelDetect.load(cfg);
      models.detect.push(res);
    }
  }

  const t1 = window.performance.now();
  log.div('process-log', true, `TensorFlow models loaded: ${Math.round(t1 - t0).toLocaleString().toLocaleString()}ms`);
  log.div('process-log', true, `Initializing TensorFlow/JS version ${tf.version_core}`);
  await resetBackend(config.backEnd);
  await tf.enableProdMode();
  tf.ENV.set('DEBUG', false);
  log.div('process-log', true, 'Configuration:');
  log.div('process-log', true, `  Backend: ${tf.getBackend().toUpperCase()}`);
  log.div('process-log', true, `  Parallel processing: ${config.batchProcessing} parallel images`);
  log.div('process-log', true, `  Forced image resize: ${config.maxSize}px maximum shape: ${config.squareImage ? 'square' : 'native'}`);
  if (config.memory) {
    log.div('process-log', true, '  WebGL: Enabling memory deallocator');
    tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
  }
  for (const [key, val] of Object.entries(config.webgl)) {
    log.div('process-log', true, '  WebGL:', key, val);
    tf.ENV.set(key, val);
  }
  const engine = await tf.engine();
  log.div('process-log', true, `TensorFlow engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers: ${engine.state.numDataBuffers.toLocaleString()} Tensors: ${engine.state.numTensors.toLocaleString()}`);
}

export async function getImage(url, maxSize = config.maxSize) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const ratio = 1.0 * image.height / image.width;
      if (Math.max(image.width, image.height) > maxSize) {
        if (config.squareImage) {
          image.height = maxSize;
          image.width = maxSize;
        } else {
          image.width = ratio <= 1 ? maxSize : 1.0 * maxSize / ratio;
          image.height = ratio >= 1 ? maxSize : 1.0 * maxSize * ratio;
        }
      }
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.height = image.height;
      offscreenCanvas.width = image.width;
      const ctx = offscreenCanvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, image.width, image.height);
      const data = ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);

      if (Math.max(image.width, image.height) > config.renderThumbnail) {
        if (config.squareImage) {
          image.height = config.renderThumbnail;
          image.width = config.renderThumbnail;
        } else {
          image.width = ratio <= 1 ? config.renderThumbnail : 1.0 * config.renderThumbnail / ratio;
          image.height = ratio >= 1 ? config.renderThumbnail : 1.0 * config.renderThumbnail * ratio;
        }
      }
      const thumbnailCanvas = document.createElement('canvas');
      thumbnailCanvas.height = image.height;
      thumbnailCanvas.width = image.width;
      const thumbnailCtx = thumbnailCanvas.getContext('2d');
      if (thumbnailCtx) thumbnailCtx.drawImage(image, 0, 0, image.width, image.height);
      const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.8);

      resolve({ image, canvas: offscreenCanvas, data, naturalHeight: image.naturalHeight, naturalWidth: image.naturalWidth, thumbnail });
    });
    image.src = url;
  });
}

export async function process(name) {
  // if (config.batchProcessing === 1) tf.engine().startScope();
  const mem = tf.memory();
  log.div('process-state', false, `Engine state: ${mem.numBytes.toLocaleString()} bytes ${mem.numTensors.toLocaleString()} tensors ${mem.numDataBuffers.toLocaleString()} buffers ${mem.numBytesInGPU ? mem.numBytesInGPU.toLocaleString() : '0'} GPU bytes`);
  const obj = {};
  obj.image = name;
  let model;

  const t0 = window.performance.now();

  // load & preprocess image
  const ti0 = window.performance.now();
  const image = await getImage(name);
  obj.processedSize = { width: image.canvas.width, height: image.canvas.height };
  obj.naturalSize = { width: image.naturalWidth, height: image.naturalHeight };
  obj.pixels = image.naturalHeight * image.naturalWidth;
  obj.thumbnail = image.thumbnail;
  const ti1 = window.performance.now();

  log.debug(`Processing: ${name} size: ${obj.naturalSize.width} x ${obj.naturalSize.height} input: ${obj.processedSize.width} x ${obj.processedSize.height}`);

  obj.classify = [];
  const tc0 = window.performance.now();
  const promisesClassify = [];
  try {
    if (!error && models.classify) {
      for (const m of models.classify) {
        model = m;
        if (config.batchProcessing === 1) promisesClassify.push(await modelClassify.classify(model, image.canvas));
        else promisesClassify.push(modelClassify.classify(model, image.canvas));
      }
    }
  } catch (err) {
    error = err;
    error.where = 'classify';
  }
  const tc1 = window.performance.now();

  obj.detect = [];
  const td0 = window.performance.now();
  const promisesDetect = [];
  try {
    if (!error && models.detect) {
      for (const m of models.detect) {
        model = m;
        if (config.batchProcessing === 1) promisesDetect.push(await modelDetect.detect(model, image.canvas));
        else promisesDetect.push(modelDetect.detect(model, image.canvas));
      }
    }
  } catch (err) {
    error = err;
    error.where = 'detect';
  }
  const td1 = window.performance.now();

  if (!error) {
    let resClassify = [];
    try {
      resClassify = await Promise.all(promisesClassify);
    } catch (err) {
      error = err;
      error.where = 'classify promise';
    }
    for (const i in resClassify) {
      if (resClassify[i]) {
        for (const j in resClassify[i]) resClassify[i][j].model = config.models.classify[i].name;
        obj.classify.push(...resClassify[i]);
      }
    }
  }
  if (!error) {
    let resDetect = [];
    try {
      resDetect = await Promise.all(promisesDetect);
    } catch (err) {
      error = err;
      error.where = 'detect promise';
    }
    for (const i in resDetect) {
      if (resDetect[i]) {
        for (const j in resDetect[i]) resDetect[i][j].model = config.models.detect[i].name;
        obj.detect.push(...resDetect[i]);
      }
    }
  }

  if (!error) obj.phash = await hash.data(image.data);

  const tp0 = window.performance.now();
  try {
    if (!error && models.human) {
      obj.person = [];
      const res = await models.human.detect(image.canvas, config.models.person);
      if (res && res.face) {
        for (const person of res.face) {
          obj.person.push({
            confidence: person.confidence,
            box: person.box,
            iris: person.iris,
            age: person.age,
            gender: person.gender,
            genderScore: person.genderConfidence,
            emotion: person.emotion[0] ? person.emotion[0].emotion : '',
            emotionScore: person.emotion[0] ? person.emotion[0].score : '',
            descriptor: person.embedding,
          });
        }
      }
    }
  } catch (err) {
    error = err;
    error.where = 'human';
    model = models.human;
    model.name = 'human';
  }
  const tp1 = window.performance.now();

  const t1 = window.performance.now();
  obj.perf = { total: Math.round(t1 - t0), load: Math.round(ti1 - ti0), classify: Math.round(tc1 - tc0), detect: Math.round(td1 - td0), person: Math.round(tp1 - tp0) };
  if (error) {
    log.div('process-log', true, `Error processing: <span style="color: lightcoral">${name}</span> Natural size: ${obj.naturalSize.width} x ${obj.naturalSize.height} Process size: ${obj.processedSize.width} x ${obj.processedSize.height}`);
    log.div('process-log', true, `Error during: ${error?.where} model: ${model?.name} error type: <span style="color: lightcoral">${error?.name}</span> message: <span style="color: lightcoral">${error?.message}</span>`);
    // log.div('process-log', true, `Error stack: <pre style="color: lightcoral">${error.stack}</pre>`);
    log.server(`Error processing: ${name} during: ${error?.where} model: ${model?.name} error:${error?.name} ${error?.message}`);
    // ignore NudeNet TypeError: Cannot read property '0' of undefined
    // eslint-disable-next-line no-console
    console.error(error);
    if (model?.name !== 'NudeNet') obj.error = true;
    else error = null;
    if (!error) log.server('Continuing processing due to non-critical error');
  }

  if (!error) {
    fetch('/api/record/put', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    }).then((post) => post.json());
  }
  return obj;
}
