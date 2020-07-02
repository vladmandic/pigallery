const tf = require('@tensorflow/tfjs');
/*
const tf = require('@tensorflow/tfjs-core');
require('@tensorflow/tfjs-data');
require('@tensorflow/tfjs-layers');
require('@tensorflow/tfjs-backend-cpu');
require('@tensorflow/tfjs-backend-webgl');
require('@tensorflow/tfjs-converter');
*/
const faceapi = require('face-api.js');
const modelClassify = require('./modelClassify.js');
const modelDetect = require('./modelDetect.js');
const log = require('./log.js');
const config = require('./config.js').default;
const hash = require('./blockhash.js');

const models = {};
let error = false;

function JSONtoStr(json) {
  if (!json) return '';
  let res = '';
  if (Array.isArray(json)) {
    // eslint-disable-next-line prefer-template
    for (const item of json) res += JSON.stringify(item).replace(/{|}|"/g, '').replace(/,/g, ', ');
  } else {
    res = JSON.stringify(json).replace(/{|}|"/g, '').replace(/,/g, ', ');
  }
  return res;
}

async function loadModels() {
  tf.ENV.set('WEBGL_PACK', false);
  tf.ENV.set('WEBGL_CONV_IM2COL', false);

  log.result('Starting Image Analsys');
  log.result(`Initializing TensorFlow/JS version ${tf.version_core}`);
  await tf.setBackend(config.backEnd);
  await tf.enableProdMode();
  await tf.dispose();
  // await tf.engine().startScope();
  if (!config.floatPrecision) await tf.webgl.forceHalfFloat();
  log.result(`Configured Backend: ${tf.getBackend().toUpperCase()}`);
  log.result('Configuration:');
  log.result(`  Parallel processing: ${config.batchProcessing} parallel images`);
  log.result(`  Forced image resize: ${config.maxSize}px maximum shape: ${config.squareImage ? 'square' : 'native'}`);
  log.result(`  Float Precision: ${config.floatPrecision ? '32bit' : '16bit'}`);
  log.result('Image Classification models:');
  for (const model of config.classify) {
    log.result(`  ${JSONtoStr(model)}`);
  }
  log.result('Object Detection models:');
  for (const model of config.detect) {
    log.result(`  ${JSONtoStr(model)}`);
  }
  log.result('Face Detection model:');
  log.result(`  ${JSONtoStr(config.person)}`);
  const t0 = window.performance.now();

  models.classify = [];
  if (config.classify && config.classify.length > 0) {
    for (const cfg of config.classify) {
      const res = await modelClassify.load(cfg);
      models.classify.push(res);
    }
  }

  models.detect = [];
  if (config.detect && config.detect.length > 0) {
    for (const cfg of config.detect) {
      const res = await modelDetect.load(cfg);
      models.detect.push(res);
    }
  }

  if (config.person) {
    switch (config.person.type) {
      case 'tinyFaceDetector':
        await faceapi.nets.tinyFaceDetector.load(config.person.modelPath);
        faceapi.options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: config.person.score, inputSize: config.person.size });
        break;
      case 'ssdMobilenetv1':
        await faceapi.nets.ssdMobilenetv1.load(config.person.modelPath);
        faceapi.options = new faceapi.SsdMobilenetv1Options({ minConfidence: config.person.score, maxResults: config.person.topK });
        break;
      case 'tinyYolov2':
        await faceapi.nets.tinyYolov2.load(config.person.modelPath);
        faceapi.options = new faceapi.TinyYolov2Options({ scoreThreshold: config.person.score, inputSize: config.person.size });
        break;
      case 'mtcnn':
        await faceapi.nets.mtcnn.load(config.person.modelPath);
        faceapi.options = new faceapi.MtcnnOptions({ minFaceSize: 100, scaleFactor: 0.8 });
        break;
      default:
    }
    await faceapi.nets.ageGenderNet.load(config.person.modelPath);
    await faceapi.nets.faceLandmark68Net.load(config.person.modelPath);
    await faceapi.nets.faceRecognitionNet.load(config.person.modelPath);
    await faceapi.nets.faceExpressionNet.load(config.person.modelPath);
    models.faceapi = faceapi;
  }

  /* working but unreliable
  log.result('  Model: DarkNet/Yolo-v3');
  models.yolo = await yolo.v1tiny('/models/yolo-v1-tiny/model.json');
  models.yolo = await yolo.v2tiny('/models/yolo-v2-tiny/model.json');
  models.yolo = await yolo.v3tiny('/models/yolo-v3-tiny/model.json');
  models.yolo = await yolo.v3('/models/yolo-v3-full/model.json');
  */

  /* working but unreliable
  log.result('  Model: NSFW');
  models.nsfw = await nsfwjs.load('/models/nsfw-mini/', { size: 224, type: 'layers' });
  models.nsfw = await nsfwjs.load('/models/nsfw-inception-v3/', { size: 299, type: 'layers' });
  */

  const t1 = window.performance.now();
  log.result(`TensorFlow models loaded: ${Math.round(t1 - t0).toLocaleString().toLocaleString()}ms`);
  const engine = await tf.engine();
  log.result(`TensorFlow engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers: ${engine.state.numDataBuffers.toLocaleString()} Tensors: ${engine.state.numTensors.toLocaleString()}`);
}

function flattenObject(object) {
  const stripped = {};
  for (const key of Object.keys(object)) {
    if (key[0] === '_') stripped[key.substr(1)] = object[key];
    else stripped[key] = object[key];
  }
  return stripped;
}

faceapi.classify = async (image) => {
  const results = await faceapi.detectAllFaces(image, faceapi.options)
    // .withFaceDescriptor()
    .withFaceLandmarks()
    .withFaceExpressions()
    .withFaceDescriptors()
    .withAgeAndGender();
  const faces = [];
  for (const result of results) {
    const emotion = Object.entries(result.expressions).reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    const object = {
      scoreGender: result.genderProbability,
      gender: result.gender,
      age: result.age,
      descriptor: result.descriptor,
      scoreEmotion: emotion && emotion[1] ? emotion[1] : 0,
      emotion: emotion && emotion[0] ? emotion[0] : '',
      box: flattenObject(result.detection.box),
      points: result.landmarks.positions.map((a) => flattenObject(a)),
    };
    faces.push(object);
  }
  return faces;
};

async function getImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const ratio = 1.0 * image.height / image.width;
      if (Math.max(image.width, image.height) > config.maxSize) {
        if (config.squareImage) {
          image.height = config.maxSize;
          image.width = config.maxSize;
        } else {
          image.width = ratio <= 1 ? config.maxSize : 1.0 * config.maxSize / ratio;
          image.height = ratio >= 1 ? config.maxSize : 1.0 * config.maxSize * ratio;
        }
      }
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.height = image.height;
      offscreenCanvas.width = image.width;
      const ctx = offscreenCanvas.getContext('2d');
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
      thumbnailCtx.drawImage(image, 0, 0, image.width, image.height);
      const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.8);

      resolve({ image, canvas: offscreenCanvas, data, naturalHeight: image.naturalHeight, naturalWidth: image.naturalWidth, thumbnail });
    });
    image.src = url;
  });
}

async function processImage(name) {
  log.active(`Loading: ${name}`);
  tf.engine().startScope();
  log.state(`Engine state: ${tf.memory().numBytes.toLocaleString()} bytes ${tf.memory().numTensors.toLocaleString()} 
    tensors ${tf.memory().numDataBuffers.toLocaleString()} buffers ${tf.memory().numBytesInGPU ? tf.memory().numBytesInGPU.toLocaleString() : '0'} GPU bytes`);
  const obj = {};
  obj.image = name;

  const t0 = window.performance.now();

  // load & preprocess image
  const ti0 = window.performance.now();
  const image = await getImage(name);
  obj.processedSize = { width: image.canvas.width, height: image.canvas.height };
  obj.naturalSize = { width: image.naturalWidth, height: image.naturalHeight };
  obj.pixels = image.naturalHeight * image.naturalWidth;
  obj.thumbnail = image.thumbnail;
  const ti1 = window.performance.now();

  log.active(`Classifying: ${name}`);
  obj.classify = [];
  const tc0 = window.performance.now();
  try {
    if (!error) {
      for (const model of models.classify) {
        const res = await modelClassify.classify(model, image.canvas);
        if (res) obj.classify.push(...res);
      }
    }
  } catch (err) {
    log.result(`Error during classification for ${name}: ${err}`);
    error = true;
  }
  const tc1 = window.performance.now();

  log.active(`Detecting: ${name}`);
  obj.detect = [];
  const td0 = window.performance.now();
  try {
    if (!error) {
      for (const model of models.detect) {
        const res = await modelDetect.exec(model, image.canvas);
        if (res) obj.detect.push(...res);
      }
    }
  } catch (err) {
    log.result(`Error during detection for ${name}: ${err}`);
    error = true;
  }
  const td1 = window.performance.now();

  obj.phash = await hash.data(image.data);

  const tp0 = window.performance.now();
  log.active(`Face Detection: ${name}`);
  try {
    if (!error && models.faceapi) obj.person = await models.faceapi.classify(image.canvas, 1);
  } catch (err) {
    log.result(`Error in FaceAPI for ${name}: ${err}`);
    error = true;
  }
  const tp1 = window.performance.now();

  const t1 = window.performance.now();
  obj.perf = { total: t1 - t0, load: ti1 - ti0, classify: tc1 - tc0, detect: td1 - td0, person: tp1 - tp0 };
  if (error) obj.error = error;
  tf.engine().endScope();

  if (!error) {
    log.active(`Storing: ${name}`);
    fetch('/api/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    }).then((post) => post.json());
    log.active(`Done: ${name}`);
  }
  return obj;
}

exports.load = loadModels;
exports.process = processImage;
exports.getImage = getImage;
exports.JSONtoStr = JSONtoStr;
