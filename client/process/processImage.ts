import * as tf from '@vladmandic/tfjs/dist/tfjs.esm';
import { Human } from '@vladmandic/human/dist/human.esm';
import * as log from '../shared/log';
import * as modelClassify from './modelClassify';
import * as modelDetect from './modelDetect';
import * as hash from '../shared/blockhash';
import * as config from '../shared/config';

const models:{ classify: Array<any>, detect: Array<any>, human: any } = { classify: [], detect: [], human: {} };
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

  if (config.default.models.initial) {
    const req = await fetch('/api/models/get');
    if (req && req.ok) config.default.models = await req.json();
  }

  log.div('process-log', true, 'Image Classification models:');
  for (const model of config.default.models.classify.filter((a) => a['enabled'])) {
    log.div('process-log', true, `  ${model['name']}`);
  }
  log.div('process-log', true, 'Object Detection models:');
  for (const model of config.default.models.detect.filter((a) => a['enabled'])) {
    log.div('process-log', true, `  ${model['name']}`);
  }
  log.div('process-log', true, 'Face Detection model:');
  log.div('process-log', true, `  ${config.default.models.person['name']}`);
  const t0 = performance.now();

  log.div('process-log', true, 'TensorFlow models loading ...');

  if (config.default.models.person) {
    const human = new Human(config.default.models.person);
    await human.load(config.default.models.person);
    models.human = human;
  }

  models.classify = [];
  if (config.default.models.classify && config.default.models.classify.length > 0) {
    for (const cfg of config.default.models.classify.filter((a) => a['enabled'])) {
      const res = await modelClassify.load(cfg);
      models.classify.push(res);
    }
  }

  models.detect = [];
  if (config.default.models.detect && config.default.models.detect.length > 0) {
    for (const cfg of config.default.models.detect.filter((a) => a['enabled'])) {
      const res = await modelDetect.load(cfg);
      models.detect.push(res);
    }
  }

  const t1 = performance.now();
  log.div('process-log', true, `TensorFlow models loaded: ${Math.round(t1 - t0).toLocaleString().toLocaleString()}ms`);
  log.div('process-log', true, `Initializing TensorFlow/JS version ${tf.version_core}`);
  await resetBackend(config.default.backEnd);
  await tf.enableProdMode();
  tf.ENV.set('DEBUG', false);
  log.div('process-log', true, 'Configuration:');
  log.div('process-log', true, `  Backend: ${tf.getBackend().toUpperCase()}`);
  log.div('process-log', true, `  Parallel processing: ${config.default.batchProcessing} parallel images`);
  log.div('process-log', true, `  Forced image resize: ${config.default.maxSize}px maximum shape: ${config.default.squareImage ? 'square' : 'native'}`);
  log.div('process-log', true, `  Auto reload on error: ${config.default.autoreload}`);
  if (config.default.backEnd === 'webgl') {
    if (config.default.memory) {
      log.div('process-log', true, '  WebGL: Enabling memory deallocator');
      tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    }
    for (const [key, val] of Object.entries(config.default.webgl)) {
      log.div('process-log', true, '  WebGL: ', key.toLowerCase(), ': ', val);
      tf.ENV.set(key, val);
    }
  }
  const engine = await tf.engine();
  log.div('process-log', true, `TensorFlow engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers: ${engine.state.numDataBuffers.toLocaleString()} Tensors: ${engine.state.numTensors.toLocaleString()}`);
}

export async function getImage(url, maxSize = 0):Promise<any> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const ratio = 1.0 * image.height / image.width;
      if (maxSize === 0) maxSize = Math.max(image.width, image.height);
      if (Math.max(image.width, image.height) > (3 * maxSize)) {
        if (config.default.squareImage) {
          image.height = 3 * maxSize;
          image.width = 3 * maxSize;
        } else {
          image.width = ratio <= 1 ? 3.0 * maxSize : 3.0 * maxSize / ratio;
          image.height = ratio >= 1 ? 3.0 * maxSize : 3.0 * maxSize * ratio;
        }
      }
      const canvasHiRes = document.createElement('canvas');
      canvasHiRes.height = image.height;
      canvasHiRes.width = image.width;
      const ctxHiRes = canvasHiRes.getContext('2d');
      if (ctxHiRes) ctxHiRes.drawImage(image, 0, 0, image.width, image.height);

      if (Math.max(image.width, image.height) > maxSize) {
        if (config.default.squareImage) {
          image.height = maxSize;
          image.width = maxSize;
        } else {
          image.width = ratio <= 1 ? maxSize : 1.0 * maxSize / ratio;
          image.height = ratio >= 1 ? maxSize : 1.0 * maxSize * ratio;
        }
      }
      const canvasNorm = document.createElement('canvas');
      canvasNorm.height = image.height;
      canvasNorm.width = image.width;
      const ctxNorm = canvasNorm.getContext('2d');
      if (ctxNorm) ctxNorm.drawImage(image, 0, 0, image.width, image.height);
      const data = ctxNorm ? ctxNorm.getImageData(0, 0, image.width, image.height) : null;

      if (Math.max(image.width, image.height) > config.default.renderThumbnail) {
        if (config.default.squareImage) {
          image.height = config.default.renderThumbnail;
          image.width = config.default.renderThumbnail;
        } else {
          image.width = ratio <= 1 ? config.default.renderThumbnail : 1.0 * config.default.renderThumbnail / ratio;
          image.height = ratio >= 1 ? config.default.renderThumbnail : 1.0 * config.default.renderThumbnail * ratio;
        }
      }
      const canvasThumb = document.createElement('canvas');
      canvasThumb.height = image.height;
      canvasThumb.width = image.width;
      const ctxThumb = canvasThumb.getContext('2d');
      if (ctxThumb) ctxThumb.drawImage(image, 0, 0, image.width, image.height);
      const thumbnail = canvasThumb.toDataURL('image/jpeg', 0.8);

      resolve({ image, canvas: canvasNorm, hires: canvasHiRes, data, naturalHeight: image.naturalHeight, naturalWidth: image.naturalWidth, thumbnail });
    });
    image.src = url;
  });
}

export async function process(name) {
  await tf.engine().startScope();
  const mem = tf.memory();
  log.div('process-state', false, `Engine state: ${mem.numBytes.toLocaleString()} bytes ${mem.numTensors.toLocaleString()} tensors ${mem.numDataBuffers.toLocaleString()} buffers ${mem.numBytesInGPU ? mem.numBytesInGPU.toLocaleString() : '0'} GPU bytes`);
  const obj:any = {};
  obj.image = name;
  let model;

  const t0 = performance.now();

  // load & preprocess image
  const ti0 = performance.now();
  const image = await getImage(name, config.default.maxSize) as any;
  obj.processedSize = { width: image.canvas.width, height: image.canvas.height };
  obj.naturalSize = { width: image.naturalWidth, height: image.naturalHeight };
  obj.pixels = image.naturalHeight * image.naturalWidth;
  obj.thumbnail = image.thumbnail;
  const ti1 = performance.now();

  log.debug(`Processing: ${name} size: ${obj.naturalSize.width} x ${obj.naturalSize.height} input: ${obj.processedSize.width} x ${obj.processedSize.height}`);

  // image perception hash
  obj.phash = await hash.data(image.data);

  // start image classification
  obj.classify = [];
  const tc0 = performance.now();
  const promisesClassify:Array<any> = [];
  try {
    if (!error && models.classify) {
      for (const m of models.classify) {
        model = m;
        if (config.default.batchProcessing === 1) promisesClassify.push(await modelClassify.classify(model, image.canvas));
        else promisesClassify.push(modelClassify.classify(model, image.canvas));
      }
    }
  } catch (err) {
    error = err;
    error.where = 'classify';
  }
  let resClassify:Array<any> = [];
  try {
    resClassify = await Promise.all(promisesClassify);
  } catch (err) {
    error = err;
    error.where = 'classify promise';
  }
  for (const i in resClassify) obj.classify.push(...resClassify[i]); // merge all classification results from specific model
  const tc1 = performance.now();
  // end image classification

  // start object detection
  obj.detect = [];
  const td0 = performance.now();
  const promisesDetect:Array<any> = [];
  try {
    if (!error && models.detect) {
      for (const m of models.detect) {
        model = m;
        if (config.default.batchProcessing === 1) promisesDetect.push(await modelDetect.detect(model, image.canvas));
        else promisesDetect.push(modelDetect.detect(model, image.canvas));
      }
    }
  } catch (err) {
    error = err;
    error.where = 'detect';
  }
  const td1 = performance.now();
  let resDetect:Array<any> = [];
  try {
    resDetect = await Promise.all(promisesDetect);
  } catch (err) {
    error = err;
    error.where = 'detect promise';
  }
  for (const i in resDetect) obj.detect.push(...resDetect[i]); // merge all detection results from specific model
  // end object detection

  // start human detection
  const tp0 = performance.now();
  try {
    if (!error && models.human) {
      obj.person = [];
      const res = await models.human.detect(image.hires, config.default.models.person);
      if (res && res.face) {
        for (const person of res.face) {
          obj.person.push({
            score: person.score,
            boxRaw: person.boxRaw,
            meshRaw: person.meshRaw,
            iris: person.iris,
            age: person.age,
            gender: person.gender,
            genderScore: person.genderScore,
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
  const tp1 = performance.now();
  // end human detection

  await tf.engine().endScope();

  const t1 = performance.now();
  obj.perf = { total: Math.round(t1 - t0), load: Math.round(ti1 - ti0), classify: Math.round(tc1 - tc0), detect: Math.round(td1 - td0), person: Math.round(tp1 - tp0) };

  // handle errors
  if (error) {
    log.div('process-log', true, `Error processing: <span style="color: lightcoral">${name}</span> Natural size: ${obj.naturalSize.width} x ${obj.naturalSize.height} Process size: ${obj.processedSize.width} x ${obj.processedSize.height}`);
    // eslint-disable-next-line no-console
    console.error('Error processing:', name, obj);
    log.div('process-log', true, `Error during: ${error?.where} model: ${model?.name} error type: <span style="color: lightcoral">${error?.name}</span> message: <span style="color: lightcoral">${error?.message}</span>`);
    // log.div('process-log', true, `Error stack: <pre style="color: lightcoral">${error.stack}</pre>`);
    log.server(`Error processing: ${name} during: ${error?.where} model: ${model?.name} error:${error?.name} ${error?.message}`);
    // ignore NudeNet TypeError: Cannot read property '0' of undefined
    if (model?.name !== 'NudeNet') obj.error = true;
    else error = null;
    if (!error) log.div('process-log', true, 'Continuing processing due to non-critical error');
  }

  // post results to server
  if (!error) {
    fetch('/api/record/put', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })
      .then((post) => post.json())
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        log.div('process-log', true, `Error posting: ${obj.image} size: ${JSON.stringify(obj).length}`);
      });
  }
  return obj;
}
