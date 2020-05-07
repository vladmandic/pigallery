import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as faceapi from 'face-api.js';
import * as nsfwjs from 'nsfwjs';
import yolo from 'tfjs-yolo';
import Jimp from 'jimp';

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
  await tf.setBackend(gpu);
  await tf.enableProdMode();
  log(`Using ${tf.getBackend().toUpperCase()} back-end for processing`);
  log('Loading models...');
  const t0 = window.performance.now();
  log('&nbsp Model: MobileNet-v1-100');
  models.mobilenet = await mobilenet.load({ version: 1, alpha: 1.0, modelUrl: `${config.modelsPrefix}/mobilenet-v1/model.json` });
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

  log(`Models loaded: ${tf.engine().state.numBytes.toLocaleString()} bytes in ${(window.performance.now() - t0).toLocaleString()}ms`);

  log(`Forced image resize to max ${config.maxSize}px`);
}

async function loadImage(imageUrl) {
  const image = await Jimp.read(imageUrl);
  image.quality(80);
  if (image.bitmap.width > image.bitmap.height) image.resize(config.maxSize, Jimp.AUTO);
  else await image.resize(Jimp.AUTO, config.maxSize);
  await image.resize(config.maxSize, Jimp.AUTO);
  const base64 = await image.getBase64Async(Jimp.MIME_JPEG);
  const img = new Image();
  img.src = base64;
  // img.width = image.width;
  // img.height = image.height;
  // console.log(img.width, img.heigh);
  return img;
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

async function printResult(img, image) {
  let classified = '';
  for (const obj of img.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let detected = '';
  for (const obj of img.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let person = ' | N/A';
  if (img.person && img.person.age) {
    person = ` | 
      Gender: ${(100 * img.person.scoreGender).toFixed(0)}% ${img.person.gender}
      Age: ${img.person.age.toFixed(1)} years
      Emotion: ${(100 * img.person.scoreEmotion).toFixed(0)}% ${img.person.emotion}
      Class: ${(100 * img.person.scoreClass).toFixed(0)}% ${img.person.class}
    `;
  }
  const div = document.createElement('div');
  div.class = 'col';
  div.style = 'display: flex';
  div.innerHTML = `
    <div class="col" style="height: 100px; min-width: 100px; max-width: 100px"><img src="${image.src}" width="92" height="92"></div>
    <div class="col" style="height: 100px; min-width: 550px; max-width: 550px">
      Image | ${decodeURI(img.image)} | processed in ${img.time.toLocaleString()}ms<br>
      Classified ${classified}<br>
      Detected ${detected}<br>
      Person ${person}<br>
    </div>
  `;
  document.getElementById('result').appendChild(div);
}

async function processImage(image, name) {
  try {
    const t0 = window.performance.now();
    let classify = await models.mobilenet.classify(image, 3);
    classify = classify.filter((a) => a.probability > 0.2);
    classify = classify.map((a) => ({ score: a.probability, class: a.className.split(',')[0] }));
    let detect = await models.yolo.predict(image, { maxBoxes: 3, scoreThreshold: 0.3 });
    detect = detect.map((a) => ({ score: a.score, class: a.class }));
    let person;
    if (detect.find((a) => a.class === 'person')) {
      const p_nsfw = models.nsfw.classify(image, 1);
      const p_face = models.faceapi.classify(image, 1);
      Promise.all([p_nsfw, p_face]);
      const nsfw = await p_nsfw;
      const face = await p_face;
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
    const t1 = window.performance.now();
    const img = { image: name, time: t1 - t0, classify, detect, person };
    images.push(img);
    printResult(img, image);
    return image;
  } catch (err) {
    log(`&nbsp Error processing image: ${image.src}: ${err}`);
    return image;
  }
}

async function loadGallery(count) {
  log(`Queued ${count} images for processing...`);
  const t0 = window.performance.now();
  for (let i = 1; i <= count; i++) {
    const image = await loadImage(`${config.samplesPrefix}/test%20(${i}).jpg`);
    await processImage(image, `test%20(${i}).jpg`);
    image.remove();
  }
  /*
  const promises = [];
  for (let i = 1; i <= count; i++) {
    promises.push(loadImage(`${config.samplesPrefix}/test%20(${i}).jpg`).then((image) => processImage(image).then((img) => img.remove())));
  }
  await Promise.all(promises);
  */
  const t1 = window.performance.now();
  log(`Finished processed ${count} images: total: ${(t1 - t0).toLocaleString()}ms average: ${((t1 - t0) / count).toLocaleString()}ms / image`);
}

async function main() {
  await loadModels('webgl');
  await loadGallery(93); // max=93
}

window.onload = main;
