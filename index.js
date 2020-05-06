/* eslint-disable no-use-before-define */

import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-backend-cpu';
// import '@tensorflow/tfjs-backend-webgl';
// import '@tensorflow/tfjs-backend-wasm';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as faceapi from 'face-api.js';
import * as nsfwjs from 'nsfwjs';
import yolo from 'tfjs-yolo';
import Jimp from 'jimp';
import labels from './assets/imagenet.json';

const config = { maxSize: 800, modelsPrefix: 'models', samplesPrefix: 'samples' };
const models = {};
const images = [];

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function loadModels(gpu = 'webgl') {
  log('Starting Image Analsys');
  log(`Initializing TensorFlow/JS version ${tf.version.tfjs}`);
  // tf.wasm.setWasmPath('assets/');
  await tf.setBackend(gpu);
  log(`Using ${tf.getBackend().toUpperCase()} back-end for processing`);
  log('Loading models...');
  const t0 = window.performance.now();

  log('&nbsp Model: MobileNet-v1-100');
  models.mobileNetV1 = await mobilenet.load({ version: 1, alpha: 1.0, modelUrl: `${config.modelsPrefix}/mobilenet-v1/model.json` });
  log('&nbsp Model: MobileNet-v2-100');
  models.mobileNetv2 = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: `${config.modelsPrefix}/mobilenet-v2/model.json` });
  log('&nbsp Model: CocoSSD-v2');
  models.cocoSsd = await cocoSsd.load({ base: 'mobilenet_v2', modelUrl: `${config.modelsPrefix}/cocossd-v2/model.json` });
  log('&nbsp Model: DarkNet/Yolo-v3');
  models.yolo = await yolo.v3(`${config.modelsPrefix}/yolo-v3/model.json`);
  log('&nbsp Model: NSFW');
  models.nsfw = await nsfwjs.load(`${config.modelsPrefix}/nsfw/`);

  log('&nbsp Model: FaceAPI');
  await faceapi.nets.ssdMobilenetv1.load(`${config.modelsPrefix}/faceapi/`);
  await faceapi.loadFaceLandmarkModel(`${config.modelsPrefix}/faceapi/`);
  await faceapi.nets.ageGenderNet.load(`${config.modelsPrefix}/faceapi/`);
  await faceapi.loadFaceExpressionModel(`${config.modelsPrefix}/faceapi/`);
  models.faceapi = faceapi;

  log('&nbsp Model: Resnet-10');
  models.resnet101 = await tf.loadLayersModel(`${config.modelsPrefix}/resnet10/model.json`);
  models.resnet101.classify = async (image) => {
    const img = await imgURItoTensor(image.src);
    const predictions = await models.resnet101.predict(img);
    const prediction = predictions.argMax([-1]).dataSync();
    return { score: Math.max(...predictions.dataSync()), class: labels[prediction[0]] };
  };
  log('&nbsp Model: Resnet-15');
  models.resnet152 = await tf.loadLayersModel(`${config.modelsPrefix}/resnet15/model.json`);
  models.resnet152.classify = async (image) => {
    const img = await imgURItoTensor(image.src);
    const predictions = await models.resnet152.predict(img);
    const prediction = predictions.argMax([-1]).dataSync();
    return { score: Math.max(...predictions.dataSync()), class: labels[prediction[0]] };
  };
  log('&nbsp Model: Resnet-50');
  models.resnet50 = await tf.loadLayersModel(`${config.modelsPrefix}/resnet50/model.json`);
  models.resnet50.classify = async (image) => {
    const img = await imgURItoTensor(image.src);
    const predictions = await models.resnet50.predict(img);
    const prediction = predictions.argMax([-1]).dataSync();
    return { score: Math.max(...predictions.dataSync()), class: labels[prediction[0]] };
  };

  log(`Models loaded in ${(window.performance.now() - t0).toLocaleString()}ms`);
  log(`Forced image resize to max ${config.maxSize}px`);
}

const imgURItoTensor = async (imgURI) => Jimp.read(imgURI).then((img) => {
  img.resize(224, 224);
  const p = [];
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function test(x, y, idx) {
    p.push(this.bitmap.data[idx + 0]);
    p.push(this.bitmap.data[idx + 1]);
    p.push(this.bitmap.data[idx + 2]);
  });
  return tf.tensor4d(p, [1, img.bitmap.width, img.bitmap.height, 3]);
});

async function loadImage(imageUrl) {
  return new Promise((resolve) => {
    try {
      const image = new Image();
      // image.onLoad = () => {
      image.loading = 'eager';
      image.onerror = () => log(`Error loading image: ${imageUrl}`);
      image.addEventListener('load', () => {
        const ratio = image.height / image.width;
        if (image.width > config.maxSize) {
          image.width = config.maxSize;
          image.height = image.width * ratio;
        }
        if (image.height > config.maxSize) {
          image.height = config.maxSize;
          image.width = image.height / ratio;
        }
        resolve(image);
      });
      image.src = imageUrl;
    } catch (err) {
      log(`Error loading image: ${imageUrl} ${err}`);
      resolve(null);
    }
  });
}

faceapi.classify = async (image) => {
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
  const result = await faceapi.detectSingleFace(image, options)
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

async function processImage(image) {
  log(`&nbsp Processing image: ${image.src} size: ${image.width}x${image.height}`);
  try {
    const t0 = window.performance.now();
    const res = [];
    for (const [name, func] of Object.entries(models)) {
      let result;
      const t2 = window.performance.now();
      if (func.classify) result = await func.classify(image);
      else if (func.detect) result = await func.detect(image);
      else if (func.predict) result = await func.predict(image);
      const t3 = window.performance.now();
      res.push({ name, time: t3 - t2, result });
    }
    const t1 = window.performance.now();
    const found = images.find((a) => a.image === image.src);
    if (found) found.results.push(res);
    else images.push({ image: image.src, time: t1 - t0, results: res });
  } catch (err) {
    log(`&nbsp Error processing image: ${image.src}: ${err}`);
  }
}

function printObject(objects) {
  if (!objects) return '';
  let text = '';
  const arr = Array.isArray(objects) ? objects : [objects];
  for (const obj of arr) {
    const confidence = (obj.probability || obj.score || 0);
    const label = (obj.className || obj.class || '').split(',')[0];
    if (obj.age) text += ` | ${(100 * (obj.gender.confidence).toFixed(2))}% ${obj.gender.label} age: ${obj.age.toFixed(1)}y emotion: ${(100 * (obj.emotion.confidence).toFixed(2))}% ${obj.emotion.label}`;
    else if (confidence > 0.15) text += ` | ${(100 * confidence).toFixed(2)}% ${label}`;
  }
  return text;
}
async function printResults() {
  log('Printing results...');
  let text = '';
  for (const img of images) {
    text += '<div class="row">';
    text += ` <div class="col" style="height: 150px; min-width: 150px; max-width: 150px"><img src="${img.image}" width="140" height="140"></div>`;
    text += ' <div class="col">';
    text += `  <div>Image | ${img.image} | processed in ${img.time.toLocaleString()}ms </div>`;
    for (const res of img.results) {
      text += `${res.name} in ${res.time.toLocaleString()}ms ${printObject(res.result)}<br>`;
    }
    text += ' </div>';
    text += '</div>';
  }
  document.getElementById('result').innerHTML = text;
}

async function loadGallery(count) {
  log(`Queued ${count} images for processing...`);
  const t0 = window.performance.now();
  for (let i = 1; i <= count; i++) {
    const image = await loadImage(`${config.samplesPrefix}/test%20(${i}).jpg`);
    if (image) {
      await processImage(image);
      image.remove();
    }
  }
  const t1 = window.performance.now();
  log(`Finished processed ${count} images: total: ${(t1 - t0).toLocaleString()}ms average: ${((t1 - t0) / count).toLocaleString()}ms / image`);
}

async function main() {
  await loadModels('webgl'); // webgl, wasm, cpu
  await loadGallery(5); // max=93
  await printResults();
}

window.onload = main;
