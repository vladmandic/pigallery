import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as faceapi from 'face-api.js';
import * as nsfwjs from 'nsfwjs';
import yolo from 'tfjs-yolo';
import Jimp from 'jimp';

const config = {
  maxSize: 800, // maximum image width or height before resizing is required
  modelsPrefix: '/models', // path prefix for loading tf models, if empty models will be fetched from the internet using default values
  jimp: false, // use jimp for image loading and resizing
  batch: 10, // how many images to process in parallel
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

  log('&nbsp Model: MobileNet-v1-100');
  if (config.modelsPrefix) models.mobilenet = await mobilenet.load({ version: 1, alpha: 1.0, modelUrl: `${config.modelsPrefix}/mobilenet-v1/model.json` });
  else models.mobilenet = await mobilenet.load();

  log('&nbsp Model: DarkNet/Yolo-v3');
  if (config.modelsPrefix) models.yolo = await yolo.v3(`${config.modelsPrefix}/yolo-v3/model.json`);
  else models.yolo = await yolo.v3();

  log('&nbsp Model: NSFW');
  if (config.modelsPrefix) models.nsfw = await nsfwjs.load(`${config.modelsPrefix}/nsfw/`);
  else models.nsfw = nsfwjs.load();

  log('&nbsp Model: FaceAPI');
  if (config.modelsPrefix) {
    await faceapi.nets.ssdMobilenetv1.load(`${config.modelsPrefix}/faceapi/`);
    await faceapi.loadFaceLandmarkModel(`${config.modelsPrefix}/faceapi/`);
    await faceapi.nets.ageGenderNet.load(`${config.modelsPrefix}/faceapi/`);
    await faceapi.loadFaceExpressionModel(`${config.modelsPrefix}/faceapi/`);
  } else {
    await faceapi.nets.ssdMobilenetv1.load();
    await faceapi.loadFaceLandmarkModel();
    await faceapi.nets.ageGenderNet.load();
    await faceapi.loadFaceExpressionModel();
  }
  models.faceapi = faceapi;

  log(`Models loaded: ${tf.engine().state.numBytes.toLocaleString()} bytes in ${(window.performance.now() - t0).toLocaleString()}ms`);
}

async function loadImage(imageUrl) {
  const image = await Jimp.read(imageUrl);
  image.quality(80);
  if (image.bitmap.width > config.maxSize || image.bitmap.height > config.maxSize) {
    if (config.square) image.resize(config.maxSize, config.maxSize);
    else {
      // eslint-disable-next-line no-lonely-if
      if (image.bitmap.width > image.bitmap.height) image.resize(config.maxSize, Jimp.AUTO);
      else await image.resize(Jimp.AUTO, config.maxSize);
    }
  }
  return image;
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
  let detected = '';
  for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
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
  let data;
  if (image.resize) {
    await image.resize(106, 106);
    data = await image.getBase64Async(Jimp.MIME_JPEG);
  } else {
    data = image.src;
  }
  div.innerHTML = `
    <div class="col" style="height: 114x; min-width: 114px; max-width: 114px"><img src="${data}" width="106px" height="106px"></div>
    <div class="col" style="height: 114px; min-width: 575px; max-width: 575px">
      Image ${decodeURI(object.image)} processed in ${object.perf.total.toFixed(0)}ms<br>
      Loaded in ${object.perf.load.toFixed(0)}ms<br>
      Classified in ${object.perf.classify.toFixed(0)}ms ${classified}<br>
      Detected in ${object.perf.detect.toFixed(0)}ms ${detected}<br>
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
    if (img.getBase64Async) img.getBase64Async(Jimp.MIME_JPEG).then((base64) => { image.src = base64; });
    else image.src = img;
  });
}

async function processImage(name) {
  try {
    const t0 = window.performance.now();

    const tl0 = window.performance.now();
    let image;
    let imgJimp;
    if (config.jimp) {
      imgJimp = await loadImage(name);
      image = await getImage(imgJimp);
    } else {
      image = await getImage(name);
    }
    const tl1 = window.performance.now();

    const tc0 = window.performance.now();
    let classify = await models.mobilenet.classify(image, 3);
    classify = classify.filter((a) => a.probability > 0.2);
    classify = classify.map((a) => ({ score: a.probability, class: a.className.split(',')[0] }));
    const tc1 = window.performance.now();

    const td0 = window.performance.now();
    let detect = await models.yolo.predict(image, { maxBoxes: 3, scoreThreshold: 0.3 });
    detect = detect.map((a) => ({ score: a.score, class: a.class }));
    const td1 = window.performance.now();

    const tp0 = window.performance.now();
    let person;
    if (detect.find((a) => a.class === 'person')) {
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
      detect,
      person,
      perf: { total: t1 - t0, load: tl1 - tl0, classify: tc1 - tc0, detect: td1 - td0, person: tp1 - tp0 },
    };
    if (imgJimp) printResult(obj, imgJimp);
    else printResult(obj, image);
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
  log(`Forced image resize: ${config.maxSize}px maximum`);
  log(`Parallel processing: ${config.batch} parallel images`);
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
  await loadGallery('people');
  await loadGallery('objects');
  await loadGallery('large');
}

window.onload = main;
