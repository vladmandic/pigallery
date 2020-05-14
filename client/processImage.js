/* eslint-disable no-underscore-dangle */

import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import modelClassify from './modelClassify.js';
import modelDetect from './modelDetect.js';
import log from './log.js';
import config from './config.js';

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
  await tf.setBackend(config.backEnd);
  await tf.enableProdMode();
  if (!config.floatPrecision) await tf.webgl.forceHalfFloat();
  log.result(`Configured Backend: ${tf.getBackend().toUpperCase()}`);
  log.result('Configuration:');
  log.result(`  Parallel processing: ${config.batchProcessing} parallel images`);
  log.result(`  Forced image resize: ${config.maxSize}px maximum shape: ${config.squareImage ? 'square' : 'native'}`);
  log.result(`  Float Precision: ${config.floatPrecision ? '32bit' : '16bit'}`);
  log.result(`  Classify: ${JSONtoStr(config.classify)}`);
  log.result(`  Detect: ${JSONtoStr(config.detect)}`);
  log.result(`  Person: ${JSONtoStr(config.person)}`);

  log.result('Loading models...');
  const t0 = window.performance.now();

  if (config.classify) {
    log.result(`  Model: ${config.classify.name}`);
    models.classify = await modelClassify.load(config.classify);
  }

  if (config.detect) {
    log.result(`  Model: ${config.detect.name}`);
    models.detect = await modelDetect.load(config.detect);
  }

  if (config.person) {
    log.result(`  Model: ${config.person.name}`);
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
  log.result(`Engine State: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);

  log.result('Loading WordNet classification classes ...');
  const res = await fetch('/assets/WordNet-Synset.json');
  wordNet = await res.json();
}

function buildTags(object) {
  const tags = [];
  const filePart = object.image.split('/');
  for (const name of filePart) tags.push({ name: name.toLowerCase() });
  if (object.pixels) {
    let size;
    if (object.pixels / 1024 / 1024 > 40) size = 'huge';
    else if (object.pixels / 1024 / 1024 > 10) size = 'large';
    else if (object.pixels / 1024 / 1024 > 1) size = 'medium';
    else size = 'small';
    tags.push({ size });
  }
  if (object.classify) {
    tags.push({ property: 'classified' });
    for (const obj of object.classify) tags.push({ classified: obj.class });
  }
  if (object.detect) {
    tags.push({ property: 'detected' });
    for (const obj of object.detect) tags.push({ detected: obj.class });
  }
  if (object.descriptions) {
    tags.push({ property: 'described' });
    for (const description of object.descriptions) {
      for (const lines of description) tags.push({ description: lines.name });
    }
  }
  if (object.person && object.person.age) {
    let age;
    if (object.person.age < 10) age = 'kid';
    else if (object.person.age < 20) age = 'teen';
    else if (object.person.age < 30) age = '20ies';
    else if (object.person.age < 40) age = '30ies';
    else if (object.person.age < 50) age = '40ies';
    else if (object.person.age < 60) age = '50ies';
    else if (object.person.age < 100) age = 'old';
    else age = 'uknown';
    tags.push({ property: 'face' });
    tags.push({ gender: object.person.gender }, { emotion: object.person.emotion }, { age });
  }
  if (object.exif && object.exif.created) {
    tags.push({ property: 'exif' });
    if (object.exif.make) tags.push({ camera: object.exif.make.toLowerCase() });
    if (object.exif.model) tags.push({ camera: object.exif.model.toLowerCase() });
    if (object.exif.lens) tags.push({ lens: object.exif.lens.toLowerCase() });
    if (object.exif.created) tags.push({ created: new Date(1000 * object.exif.created) });
    if (object.exif.created) tags.push({ year: new Date(1000 * object.exif.created).getFullYear() });
    if (object.exif.modified) tags.push({ edited: new Date(1000 * object.exif.modified) });
    if (object.exif.software) tags.push({ software: object.exif.software.toLowerCase() });
    if (object.exif.city) {
      tags.push({ city: object.exif.city.toLowerCase() }, { country: object.exif.country.toLowerCase() }, { continent: object.exif.continent.toLowerCase() }, { near: object.exif.near.toLowerCase() });
    }
    if (object.exif.iso && object.exif.apperture && object.exif.exposure) {
      const conditions = object.exif.iso / (object.exif.apperture ** 2) * object.exif.exposure;
      if (conditions < 0.01) tags.push({ conditions: 'bright' }, { conditions: 'outdoors' });
      else if (conditions < 0.1) tags.push({ conditions: 'outdoors' });
      else if (conditions < 5) tags.push({ conditions: 'indoors' });
      else if (conditions < 20) tags.push({ conditions: 'night' });
      else tags.push({ conditions: 'night' }, { conditions: 'long' });
    }
    if (object.exif.fov) {
      if (object.exif.fov > 200) tags.push({ zoom: 'superzoom' }, { zoom: 'zoom' });
      else if (object.exif.fov > 100) tags.push({ zoom: 'zoom' });
      else if (object.exif.fov > 40) tags.push({ zoom: 'portrait' });
      else if (object.exif.fov > 20) tags.push({ zoom: 'wide' });
      else tags.push({ zoom: 'wide' }, { zoom: 'ultrawide' });
    }
  }
  return tags;
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

      if (Math.max(image.width, image.height) > config.thumbnail) {
        if (config.squareImage) {
          image.height = config.thumbnail;
          image.width = config.thumbnail;
        } else {
          image.width = ratio <= 1 ? config.thumbnail : 1.0 * config.thumbnail / ratio;
          image.height = ratio >= 1 ? config.thumbnail : 1.0 * config.thumbnail * ratio;
        }
      }
      const thumbnailCanvas = document.createElement('canvas');
      thumbnailCanvas.height = image.height;
      thumbnailCanvas.width = image.width;
      const thumbnailCtx = thumbnailCanvas.getContext('2d');
      thumbnailCtx.drawImage(image, 0, 0, image.width, image.height);
      const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.95);

      resolve({ image, canvas: offscreenCanvas, naturalHeight: image.naturalHeight, naturalWidth: image.naturalHeight, thumbnail });
    });
    image.src = url;
  });
}

async function processImage(name) {
  log.active(`Loading: ${name}`);
  const t0 = window.performance.now();

  const ti0 = window.performance.now();
  const image = await getImage(name);
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
      if (res.face && res.face.detection & res.face.detection.detections) { // remove unnecessary objects
        delete res.face.detection.detections.detection.alignedRect;
        delete res.face.detection.detections.detection.expressions;
        delete res.face.detection.detections.detection.unshiftedLandmarks;
      }
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
    processedSize: { width: image.canvas.width, height: image.canvas.height },
    pixels: image.naturalHeight * image.naturalWidth,
    naturalSize: { width: image.naturalHeight, height: image.naturalWidth },
    thumbnail: image.thumbnail,
    exif: res.exif,
    classify: res.classify,
    detect: res.detect,
    person: res.person,
    descriptions: res.descriptions,
    perf: { total: t1 - t0, load: ti1 - ti0, classify: tc1 - tc0, detect: td1 - td0, person: tp1 - tp0, wordnet: tw1 - tw0, exif: te1 - te0 },
  };
  obj.tags = buildTags(obj);
  log.active(`Done: ${name}`);
  return obj;
}

exports.load = loadModels;
exports.process = processImage;
exports.getImage = getImage;
exports.JSONtoStr = JSONtoStr;
