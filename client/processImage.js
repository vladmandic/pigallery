import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import modelClassify from './modelClassify.js';
import modelDetect from './modelDetect.js';
import log from './log.js';
import config from './config.js';

const models = {};

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"/g, '').replace(/,/g, ', ');
}

async function loadModels() {
  log.result('Starting Image Analsys');
  log.result(`Initializing TensorFlow/JS version ${tf.version.tfjs}`);
  await tf.setBackend(config.backEnd);
  await tf.enableProdMode();
  if (!config.floatPrecision) await tf.webgl.forceHalfFloat();
  log.result(`Configured Backend: ${tf.getBackend().toUpperCase()}`);
  log.result('Configuration:');
  log.result(`  Parallel processing: ${config.batchProcessing} parallel images`);
  log.result(`  Forced image resize: ${config.maxSize}px maximum shape: ${config.squareImage ? 'square' : 'native'}`);
  log.result(`  Float Precision: ${config.floatPrecision ? '32bit' : '16bit'}`);
  log.result(`  Classify: ${JSONtoStr(config.classify)}`);
  log.result(`  Alternate: ${JSONtoStr(config.alternative)}`);
  log.result(`  Detect: ${JSONtoStr(config.detect)}`);
  log.result(`  Person: ${JSONtoStr(config.person)}`);

  const t0 = window.performance.now();

  if (config.classify) {
    models.classify = await modelClassify.load(config.classify);
  }

  if (config.alternative) {
    models.alternative = await modelClassify.load(config.alternative);
  }

  if (config.detect) {
    models.detect = await modelDetect.load(config.detect);
  }

  if (config.person) {
    switch (config.person.type) {
      case 'tinyFaceDetector':
        await faceapi.nets.tinyFaceDetector.load(config.person.modelPath);
        faceapi.options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: config.person.score, inputSize: 416 });
        break;
      case 'ssdMobilenetv1':
        await faceapi.nets.ssdMobilenetv1.load(config.person.modelPath);
        faceapi.options = new faceapi.SsdMobilenetv1Options({ minConfidence: config.person.score, maxResults: config.person.topK });
        break;
      case 'tinyYolov2':
        await faceapi.nets.tinyYolov2.load(config.person.modelPath);
        faceapi.options = new faceapi.TinyYolov2Options({ scoreThreshold: config.person.score, inputSize: 416 });
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

  log.result(`Models loaded in ${(window.performance.now() - t0).toLocaleString()}ms`);
  const engine = await tf.engine();
  log.result(`Engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);
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
  // const result = await faceapi.detectSingleFace(image, faceapi.options)
  const results = await faceapi.detectAllFaces(image, faceapi.options)
    .withFaceLandmarks()
    // .withFaceDescriptor()
    .withFaceExpressions()
    .withAgeAndGender();
  const faces = [];
  for (const result of results) {
    const emotion = Object.entries(result.expressions).reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    const object = {
      scoreGender: result.genderProbability,
      gender: result.gender,
      age: result.age,
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

      resolve({ image, canvas: offscreenCanvas, naturalHeight: image.naturalHeight, naturalWidth: image.naturalWidth, thumbnail });
    });
    image.src = url;
  });
}

async function processImage(name) {
  log.active(`Loading: ${name}`);
  const obj = {};
  obj.image = name;

  const t0 = window.performance.now();

  // load & preprocess image
  const ti0 = window.performance.now();
  const image = await getImage(name);
  obj.processedSize = { width: image.canvas.width, height: image.canvas.height };
  obj.naturalSize = { width: image.naturalHeight, height: image.naturalWidth };
  obj.pixels = image.naturalHeight * image.naturalWidth;
  obj.thumbnail = image.thumbnail;
  const ti1 = window.performance.now();

  log.active(`Classifying: ${name}`);
  const tc0 = window.performance.now();
  try {
    if (models.classify) obj.classify = await modelClassify.classify(models.classify, image.canvas);
  } catch (err) {
    log.result(`Errror during primary classification for ${name}: ${err}`);
    const engine = await tf.engine();
    log.result(`Engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);
  }
  try {
    if (models.alternative) obj.alternative = await modelClassify.classify(models.alternative, image.canvas);
  } catch (err) {
    log.result(`Errror during alternate classification for ${name}: ${err}`);
    const engine = await tf.engine();
    log.result(`Engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);
  }
  const tc1 = window.performance.now();

  log.active(`Detecting: ${name}`);
  const td0 = window.performance.now();
  try {
    if (models.detect) obj.detect = await modelDetect.detect(models.detect, image.canvas);
  } catch (err) {
    log.result(`Errror during detection for ${name}: ${err}`);
    const engine = await tf.engine();
    log.result(`Engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);
  }
  const td1 = window.performance.now();

  // const detect = await models.yolo.predict(image.canvas, { maxBoxes: 3, scoreThreshold: 0.3 });
  // obj.detect = detect.map((a) => ({ score: a.score, class: a.class }));

  const tp0 = window.performance.now();
  if (obj.detect && obj.detect.find((a) => a.class === 'person')) {
    log.active(`Face Detection: ${name}`);
    try {
      if (models.faceapi) obj.person = await models.faceapi.classify(image.canvas, 1);
    } catch (err) {
      log.result(`Errror in FaceAPI for ${name}: ${err}`);
      const engine = await tf.engine();
      log.result(`Engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);
    }
    log.active(`NSFW Detection: ${name}`);
    let nsfw;
    try {
      if (models.nsfw) nsfw = await models.nsfw.classify(image.canvas, 1);
      obj.person.scoreClass = (nsfw && nsfw[0]) ? nsfw[0].probability : null;
      obj.person.class = (nsfw && nsfw[0]) ? nsfw[0].className : null;
    } catch (err) {
      log.result(`Errror in NSFW for ${name}: ${err}`);
    }
  }
  const tp1 = window.performance.now();

  const t1 = window.performance.now();
  obj.perf = { total: t1 - t0, load: ti1 - ti0, classify: tc1 - tc0, detect: td1 - td0, person: tp1 - tp0 };

  log.active(`Storing: ${name}`);
  fetch('/api/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  }).then((post) => post.json());
  log.active(`Done: ${name}`);
  return obj;
}

exports.load = loadModels;
exports.process = processImage;
exports.getImage = getImage;
exports.JSONtoStr = JSONtoStr;
