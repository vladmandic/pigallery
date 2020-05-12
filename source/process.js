/* eslint-disable no-underscore-dangle */

import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import modelClassify from './modelClassify.js';
import modelDetect from './modelDetect.js';
import log from './log.js';

let wordNet = {};
const models = {};
let id = 0;

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"/g, '').replace(/,/g, ', ');
}

function searchClasses(wnid) {
  const res = [];
  // eslint-disable-next-line consistent-return
  function recursive(obj) {
    for (const item of obj) {
      if (item._wnid === wnid) return res.push({ id: item._wnid, name: item._words, desc: item._gloss });
      if (item.synset && recursive(item.synset, id)) return res.push({ id: item._wnid, name: item._words, desc: item._gloss });
    }
  }
  recursive(wordNet.ImageNetStructure.synset[0].synset);
  return res;
}

async function loadModels() {
  log.result('Starting Image Analsys');
  log.result(`Initializing TensorFlow/JS version ${tf.version.tfjs}`);
  await tf.setBackend(window.config.backEnd);
  await tf.enableProdMode();
  if (!window.config.floatPrecision) await tf.webgl.forceHalfFloat();
  log.result(`Configured Backend: ${tf.getBackend().toUpperCase()}`);
  log.result('Configuration:');
  log.result(`&nbsp Parallel processing: ${window.config.batchProcessing} parallel images`);
  log.result(`&nbsp Forced image resize: ${window.config.maxSize}px maximum shape: ${window.config.squareImage ? 'square' : 'native'}`);
  log.result(`&nbsp Flaoat Precision: ${window.config.floatPrecision ? '32bit' : '16bit'}`);
  log.result(`&nbsp Classify: ${JSONtoStr(window.config.classify)}`);
  log.result(`&nbsp Detect: ${JSONtoStr(window.config.detect)}`);
  log.result(`&nbsp Person: ${JSONtoStr(window.config.person)}`);

  log.result('Loading models...');
  const t0 = window.performance.now();

  if (window.config.classify) {
    log.result(`&nbsp Model: ${window.config.classify.name}`);
    models.classify = await modelClassify.load(window.config.classify);
  }

  if (window.config.detect) {
    log.result(`&nbsp Model: ${window.config.detect.name}`);
    models.detect = await modelDetect.load(window.config.detect);
  }

  if (window.config.person) {
    log.result(`&nbsp Model: ${window.config.person.name}`);
    switch (window.config.person.type) {
      case 'tinyFaceDetector':
        await faceapi.nets.tinyFaceDetector.load(window.config.person.modelPath);
        faceapi.options = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: window.config.person.score, inputSize: 416 });
        break;
      case 'ssdMobilenetv1':
        await faceapi.nets.ssdMobilenetv1.load(window.config.person.modelPath);
        faceapi.options = new faceapi.SsdMobilenetv1Options({ minConfidence: window.config.person.score, maxResults: window.config.person.topK });
        break;
      case 'tinyYolov2':
        await faceapi.nets.tinyYolov2.load(window.config.person.modelPath);
        faceapi.options = new faceapi.TinyYolov2Options({ scoreThreshold: window.config.person.score, inputSize: 416 });
        break;
      case 'mtcnn':
        await faceapi.nets.mtcnn.load(window.config.person.modelPath);
        faceapi.options = new faceapi.MtcnnOptions({ minFaceSize: 100, scaleFactor: 0.8 });
        break;
      default:
    }
    await faceapi.nets.ageGenderNet.load(window.config.person.modelPath);
    await faceapi.nets.faceLandmark68Net.load(window.config.person.modelPath);
    await faceapi.nets.faceRecognitionNet.load(window.config.person.modelPath);
    await faceapi.nets.faceExpressionNet.load(window.config.person.modelPath);
    models.faceapi = faceapi;
  }

  /* working but unreliable
  log.result('&nbsp Model: DarkNet/Yolo-v3');
  models.yolo = await yolo.v1tiny('/models/yolo-v1-tiny/model.json');
  models.yolo = await yolo.v2tiny('/models/yolo-v2-tiny/model.json');
  models.yolo = await yolo.v3tiny('/models/yolo-v3-tiny/model.json');
  models.yolo = await yolo.v3('/models/yolo-v3-full/model.json');
  */

  /* working but unreliable
  log.result('&nbsp Model: NSFW');
  models.nsfw = await nsfwjs.load('/models/nsfw-mini/', { size: 224, type: 'layers' });
  models.nsfw = await nsfwjs.load('/models/nsfw-inception-v3/', { size: 299, type: 'layers' });
  */

  log.result(`Models loaded in ${(window.performance.now() - t0).toLocaleString()}ms`);
  const engine = await tf.engine();
  log.result(`Engine State: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);

  log.result('Loading WordNet classification classes ...');
  const res = await fetch('/assets/WordNet-Synset.json');
  wordNet = await res.json();
}

faceapi.classify = async (image) => {
  const result = await faceapi.detectSingleFace(image, faceapi.options)
    .withFaceLandmarks()
    // .withFaceDescriptor()
    .withFaceExpressions()
    .withAgeAndGender();
  if (result) {
    // const faceMatcher = new faceapi.FaceMatcher(result);
    // const bestMatch = faceMatcher.findBestMatch(result.descriptor);
    // console.log.result(faceMatcher, bestMatch);
    let emotion = Object.entries(result.expressions)
      .reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    emotion = { label: emotion && emotion[0] ? emotion[0] : '', confidence: emotion && emotion[1] ? emotion[1] : 0 };
    return { gender: { confidence: result.genderProbability, label: result.gender }, age: result.age, emotion: { confidence: emotion.confidence, label: emotion.label }, detection: result };
  }
  return null;
};

async function getImage(url, maxSize) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      if (Math.max(image.width, image.height) > maxSize) {
        if (window.config.squareImage) {
          image.height = maxSize;
          image.width = maxSize;
        } else {
          const ratio = 1.0 * image.height / image.width;
          image.width = ratio < 1 ? maxSize : maxSize / ratio;
          image.height = ratio > 1 ? maxSize : maxSize * ratio;
        }
      }
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.height = image.height;
      offscreenCanvas.width = image.width;
      const ctx = offscreenCanvas.getContext('2d');
      ctx.drawImage(image, 0, 0, image.width, image.height);
      resolve({ image, canvas: offscreenCanvas });
    });
    image.src = url;
  });
}

async function processImage(name) {
  log.active(`Loading: ${name}`);
  const t0 = window.performance.now();

  const ti0 = window.performance.now();
  const image = await getImage(name, window.config.maxSize);
  const ti1 = window.performance.now();

  const res = {};

  log.active(`Classifying: ${name}`);
  const tc0 = window.performance.now();
  try {
    if (models.classify) res.classify = await models.classify.classify(image.canvas);
  } catch (err) {
    log.result(`Errror in MobileNet for ${name}: ${err}`);
  }
  const tc1 = window.performance.now();

  log.active(`Detecting: ${name}`);
  const td0 = window.performance.now();
  try {
    if (models.detect) res.detect = await models.detect.detect(image.canvas);
  } catch (err) {
    log.result(`Errror in CocoSSD for ${name}: ${err}`);
  }
  const td1 = window.performance.now();

  // const detect = await models.yolo.predict(image.canvas, { maxBoxes: 3, scoreThreshold: 0.3 });
  // res.detect = detect.map((a) => ({ score: a.score, class: a.class }));

  const tp0 = window.performance.now();
  if (res.detect && res.detect.find((a) => a.class === 'person')) {
    log.active(`NSFW Detection: ${name}`);
    try {
      if (models.nsfw) res.nsfw = await models.nsfw.classify(image.canvas, 1);
    } catch (err) {
      log.result(`Errror in NSFW for ${name}: ${err}`);
    }
    log.active(`Face Detection: ${name}`);
    try {
      if (models.faceapi) res.face = await models.faceapi.classify(image.canvas, 1);
    } catch (err) {
      log.result(`Errror in FaceAPI for ${name}: ${err}`);
    }
    res.person = {
      scoreGender: (res.face && res.face.gender) ? res.face.gender.confidence : null,
      gender: (res.face && res.face.gender) ? res.face.gender.label : null,
      age: (res.face && res.face.age) ? res.face.age : null,
      scoreEmotion: (res.face && res.face.emotion) ? res.face.emotion.confidence : null,
      emotion: (res.face && res.face.emotion) ? res.face.emotion.label : null,
      scoreClass: (res.nsfw && res.nsfw[0]) ? res.nsfw[0].probability : null,
      class: (res.nsfw && res.nsfw[0]) ? res.nsfw[0].className : null,
      detections: res.face,
    };
  }
  const tp1 = window.performance.now();

  const tw0 = window.performance.now();
  if (res.classify) {
    log.active(`WordNet Lookup: ${name}`);
    res.descriptions = [];
    for (const guess of res.classify) {
      const descriptions = searchClasses(guess.wnid);
      const lines = [];
      for (const description of descriptions) {
        lines.push({ name: description.name, desc: description.desc });
      }
      res.descriptions.push(lines);
    }
  }
  const tw1 = window.performance.now();

  const te0 = window.performance.now();
  log.active(`Metadata Extraction: ${name}`);
  const exif = await fetch(`exif?image=${encodeURI(name)}`);
  if (exif.ok) {
    res.exif = await exif.json();
  }
  const te1 = window.performance.now();

  const t1 = window.performance.now();

  const obj = {
    id: id++,
    image: name,
    size: { width: image.canvas.width, height: image.canvas.height },
    exif: res.exif,
    classify: res.classify,
    detect: res.detect,
    person: res.person,
    descriptions: res.descriptions,
    perf: { total: t1 - t0, load: ti1 - ti0, classify: tc1 - tc0, detect: td1 - td0, person: tp1 - tp0, wordnet: tw1 - tw0, exif: te1 - te0 },
  };
  log.active(`Done: ${name}`);
  return obj;
}

exports.load = loadModels;
exports.process = processImage;
exports.getImage = getImage;
