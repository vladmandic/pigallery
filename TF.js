/* global tf, mobilenet, cocoSsd, faceapi */

const config = { maxSize: 1500, person: false };
let classifierV1;
let classifierV2;
let detector;
const images = [];

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

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

async function loadModels(gpu = 'webgl') {
  log('Starting Image Analsys');
  log(`Initializing TensorFlow/JS version ${tf.version.tfjs}`);
  // tf.wasm.setWasmPath('assets/');
  await tf.setBackend(gpu);
  log(`Using ${tf.getBackend().toUpperCase()} back-end for processing`);
  log('Loading models: MobileNet-v1, MobileNet-v2, CocoSSD, FaceAPI...');
  const t0 = window.performance.now();
  classifierV1 = await mobilenet.load({ version: 1, alpha: 1.0, modelUrl: 'models/mobilenet-v1/model.json' });
  classifierV2 = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: 'models/mobilenet-v2/model.json' });
  detector = await cocoSsd.load({ base: 'mobilenet_v2', modelUrl: 'models/cocossd-v2/model.json' });
  await faceapi.nets.ssdMobilenetv1.load('models/faceapi/');
  await faceapi.loadFaceLandmarkModel('models/faceapi/');
  await faceapi.nets.ageGenderNet.load('models/faceapi/');
  await faceapi.loadFaceExpressionModel('models/faceapi/');
  log(`Models loaded in ${(window.performance.now() - t0).toLocaleString()}ms`);
  log(`Forced image resize to max ${config.maxSize}px`);
}

async function processPerson(image) {
  if (!config.person) return null;
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
}

async function processImage(image) {
  log(`&nbsp Processing image: ${image.src} size: ${image.width}x${image.height}`);
  try {
    const t0 = window.performance.now();
    const res = {};
    res.classifiedV1 = classifierV1 ? await classifierV1.classify(image) : null;
    res.classifiedV2 = classifierV2 ? await classifierV2.classify(image) : null;
    // res.detected = detector ? await detector.detect(image) : null;
    const found = res.detected ? res.detected.find((a) => a.class === 'person') : null;
    if (found) res.person = await processPerson(image);
    images.push({
      image: image.src,
      time: (window.performance.now() - t0),
      classifiedV1: res.classifiedV1 || null,
      classifiedV2: res.classifiedV2 || null,
      detected: res.detected || null,
      person: res.person || null,
    });
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
    if (obj.age) text += `${(100 * (obj.gender.confidence).toFixed(2))}% ${obj.gender.label} age: ${obj.age.toFixed(1)}y emotion: ${(100 * (obj.emotion.confidence).toFixed(2))}% ${obj.emotion.label}`;
    else if (confidence > 0.15) text += `${(100 * confidence).toFixed(2)}% ${label} | `;
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
    text += `  <div>Image ${img.image} processed in ${img.time.toLocaleString()}ms </div>`;
    text += `  <div>ClassificationV1: ${printObject(img.classifiedV1)}</div>`;
    text += `  <div>ClassificationV2: ${printObject(img.classifiedV2)}</div>`;
    text += `  <div>Detected: ${printObject(img.detected)}</div>`;
    text += `  <div>Person: ${printObject(img.person)}</div>`;
    text += ' </div>';
    text += '</div>';
  }
  document.getElementById('result').innerHTML = text;
}

async function loadGallery(count) {
  log(`Queued ${count} images for processing...`);
  const t0 = window.performance.now();
  for (let i = 1; i <= count; i++) {
    const image = await loadImage(`/samples/test%20(${i}).jpg`);
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
  await loadGallery(93); // max=93
  await printResults();
}

main();
