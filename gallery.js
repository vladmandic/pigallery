import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import * as nsfwjs from 'nsfwjs';
import yolo from 'tfjs-yolo';
import MobileNet from './mobileNet.js';
import CocoSsd from './cocoSsd.js';

const config = {
  maxSize: 800, // maximum image width or height before resizing is required
  batch: 1, // how many images to process in parallel
  square: true, // resize proportional or to square image
};

const models = {};

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function loadModels(gpu = 'webgl') {
  log('Starting Image Analsys');
  log(`Initializing TensorFlow/JS version ${tf.version.tfjs}`);
  await tf.setBackend(gpu);
  await tf.enableProdMode();
  log(`Backend: ${tf.getBackend().toUpperCase()}`);

  log('Loading models...');
  const t0 = window.performance.now();

  log('&nbsp Model: MobileNet-v2');
  models.mobilenet = new MobileNet({ modelPath: '/models/mobilenet-v2/model.json' });
  await models.mobilenet.load();

  log('&nbsp Model: CocoSSD-v2');
  models.cocossd = new CocoSsd({ modelPath: '/models/cocossd-v2/model.json' });
  await models.cocossd.load();

  log('&nbsp Model: DarkNet/Yolo-v3');
  models.yolo = await yolo.v3('/models/yolo-v3/model.json');

  log('&nbsp Model: NSFW');
  models.nsfw = await nsfwjs.load('/models/untested/nsfw/');

  log('&nbsp Model: FaceAPI');
  await faceapi.nets.ssdMobilenetv1.load('/models/faceapi/');
  await faceapi.loadFaceLandmarkModel('/models/faceapi/');
  await faceapi.nets.ageGenderNet.load('/models/faceapi/');
  await faceapi.loadFaceExpressionModel('/models/faceapi/');
  models.faceapi = faceapi;

  log(`Models loaded: ${tf.engine().state.numBytes.toLocaleString()} bytes in ${(window.performance.now() - t0).toLocaleString()}ms`);
  log(`Parallel processing: ${config.batch} parallel images`);
  log(`Forced image resize: ${config.maxSize}px maximum shape: ${config.square ? 'square' : 'native'}`);
}

faceapi.classify = async (image) => {
  if (!faceapi.options) faceapi.options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
  const result = await faceapi.detectSingleFace(image, faceapi.options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender();
  if (result) {
    let emotion = Object.entries(result.expressions)
      .reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    emotion = { label: emotion && emotion[0] ? emotion[0] : '', confidence: emotion && emotion[1] ? emotion[1] : 0 };
    return { gender: { confidence: result.genderProbability, label: result.gender }, age: result.age, emotion: { confidence: emotion.confidence, label: emotion.label } };
  }
  return null;
};

async function printResult(object, image) {
  let classified = '';
  for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let detected1 = '';
  for (const obj of object.detect1) detected1 += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let detected2 = '';
  for (const obj of object.detect2) detected2 += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let person = '';
  if (object.person && object.person.age) {
    person = `Person in ${object.perf.person.toFixed(0)}ms | 
      Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender}
      Age: ${object.person.age.toFixed(1)}
      Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}
      Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class}
      <br>
    `;
  }
  const div = document.createElement('div');
  div.class = 'col';
  div.style = 'display: flex';
  div.innerHTML = `
    <div class="col" style="height: 114x; min-width: 114px; max-width: 114px"><img src="${image.src}" width="106px" height="106px"></div>
    <div class="col" style="height: 114px; min-width: 575px; max-width: 575px">
      Image ${decodeURI(object.image)} processed in ${object.perf.total.toFixed(0)}ms<br>
      Classified in ${object.perf.classify.toFixed(0)}ms ${classified}<br>
      Detected-Coco in ${object.perf.detect1.toFixed(0)}ms ${detected1}<br>
      Detected-Yolo in ${object.perf.detect2.toFixed(0)}ms ${detected2}<br>
      ${person}
    </div>
  `;
  document.getElementById('result').appendChild(div);
}

async function getImage(img) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      if (config.square) {
        if (image.width > config.maxSize || image.height > config.maxSize) {
          image.height = config.maxSize;
          image.width = config.maxSize;
        }
      } else {
        const ratio = image.height / image.width;
        if (image.width > config.maxSize) {
          image.width = config.maxSize;
          image.height = image.width * ratio;
        }
        if (image.height > config.maxSize) {
          image.height = config.maxSize;
          image.width = image.height / ratio;
        }
      }
      resolve(image);
    });
    image.src = img;
  });
}

async function processImage(name) {
  try {
    const t0 = window.performance.now();

    const image = await getImage(name);

    const tc0 = window.performance.now();
    let classify = await models.mobilenet.classify(image, { maxBoxes: 3, scoreThreshold: 0.3 });
    classify = classify.map((a) => ({ score: a.score, class: a.class }));
    const tc1 = window.performance.now();

    const td0 = window.performance.now();
    let detect1 = await models.cocossd.detect(image);
    detect1 = detect1.map((a) => ({ score: a.score, class: a.class }));
    const td1 = window.performance.now();

    const td2 = window.performance.now();
    let detect2 = await models.yolo.predict(image, { maxBoxes: 3, scoreThreshold: 0.3 });
    detect2 = detect2.map((a) => ({ score: a.score, class: a.class }));
    const td3 = window.performance.now();

    const tp0 = window.performance.now();
    let person;
    if (detect1.find((a) => a.class === 'person')) {
      const nsfw = await models.nsfw.classify(image, 1);
      const face = await models.faceapi.classify(image, 1);
      person = {
        scoreGender: (face && face.gender) ? face.gender.confidence : null,
        gender: (face && face.gender) ? face.gender.label : null,
        age: (face && face.age) ? face.age : null,
        scoreEmotion: (face && face.emotion) ? face.emotion.confidence : null,
        emotion: (face && face.emotion) ? face.emotion.label : null,
        scoreClass: (nsfw && nsfw[0]) ? nsfw[0].probability : null,
        class: (nsfw && nsfw[0]) ? nsfw[0].className : null,
      };
    }
    const tp1 = window.performance.now();

    const t1 = window.performance.now();

    const obj = {
      image: name,
      classify,
      detect1,
      detect2,
      person,
      perf: { total: t1 - t0, classify: tc1 - tc0, detect1: td1 - td0, detect2: td3 - td2, person: tp1 - tp0 },
    };
    printResult(obj, image);
    image.remove();
    return obj;
  } catch (err) {
    log(`&nbsp Error processing image: ${name}: ${err}`);
    return null;
  }
}

async function loadGallery(what) {
  const res = await fetch(`/list/${what}`);
  const dir = await res.json();
  log(`Queued: ${dir.files.length} images from ${dir.folder}/${what} ...`);
  const t0 = window.performance.now();
  const promises = [];
  for (const f of dir.files) {
    promises.push(processImage(`${dir.folder}/${f}`));
    if (promises.length >= config.batch) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  if (promises.length > 0) await Promise.all(promises);
  const t1 = window.performance.now();
  log(`Finished processed ${dir.files.length} images from ${dir.folder}/${what}: total: ${(t1 - t0).toLocaleString()}ms average: ${((t1 - t0) / dir.files.length).toLocaleString()}ms / image`);
}

async function main() {
  await loadModels('webgl');
  // await loadGallery('people');
  await loadGallery('objects');
  // await loadGallery('large');
  // await loadGallery('test');
}

window.onload = main;
