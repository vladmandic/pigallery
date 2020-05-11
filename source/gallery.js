/* eslint-disable no-underscore-dangle */

import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
// import * as nsfwjs from 'nsfwjs';
import modelClassify from './modelClassify.js';
import modelDetect from './modelDetect.js';
// import yolo from './modelYolo.js';

const config = {
  backEnd: 'webgl', // can be webgl, cpu, wasm
  maxSize: 780, // maximum image width or height before resizing is required
  batchProcessing: 20, // how many images to process in parallel
  squareImage: false, // resize proportional to original image or to square image
  floatPrecision: true, // use float32 or float16 for WebGL tensors
  // Default models
  classify: { name: 'Inception v3', modelPath: 'models/inception-v3/model.json', score: 0.2, topK: 3 },
  detect: { name: 'Coco/SSD v2', modelPath: 'models/cocossd-v2/model.json', score: 0.4, topK: 6, overlap: 0.1 },
  person: { name: 'FaceAPI SSD', modelPath: 'models/faceapi/', score: 0.4, topK: 1, type: 'ssdMobilenetv1' },

  // alternative face-api models
  /*
  person: { name: 'FaceAPI SSD', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'ssdMobilenetv1' },
  person: { name: 'FaceAPI Yolo', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyYolov2' },
  person: { name: 'FaceAPI Tiny', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyFaceDetector' },
  person: { name: 'FaceAPI MTCNN', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'mtcnn' },
  */

  // alternative classification models
  /*
  classify: { name: 'MobileNet v1', modelPath: '/models/mobilenet-v1/model.json' },
  classify: { name: 'MobileNet v2', modelPath: '/models/mobilenet-v2/model.json' },
  classify: { name: 'Inception v1', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v1/classification/3/default/1' },
  classify: { name: 'Inception v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v2/classification/3/default/1' },
  classify: { name: 'Inception v3', modelPath: '/models/inception-v3/model.json' },
  classify: { name: 'Inception ResNet v2', modelPath: '/models/inception-resnet-v2/model.json' },
  classify: { name: 'ResNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/resnet_v2_101/classification/3/default/1' },
  classify: { name: 'NasNet Mobile', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/nasnet_mobile/classification/3/default/1' },
  */
};
const results = [];
let wordNet = {};
const models = {};
let id = 0;

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function active(msg) {
  const div = document.getElementById('active');
  const mem = await tf.memory();
  div.innerHTML = `${msg}<br>Memory State: Bytes:${mem.numBytes.toLocaleString()} Buffers:${mem.numDataBuffers.toLocaleString()} Tensors:${mem.numTensors.toLocaleString()}`;
}

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

function drawBoxes(img, object) {
  const canvas = document.getElementById('canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = img.offsetLeft;
  canvas.style.top = img.offsetTop;
  canvas.width = img.width;
  canvas.height = img.height;

  // draw faces
  let faceDetails;
  if (object.person && object.person.detection) {
    const displaySize = { width: canvas.width, height: canvas.height };
    faceapi.matchDimensions(canvas, displaySize);
    const resized = faceapi.resizeResults(object.person.detection, displaySize);
    new faceapi.draw.DrawBox(resized.detection.box, { boxColor: 'lightskyblue' }).draw(canvas);
    new faceapi.draw.DrawFaceLandmarks(resized.landmarks, { lineColor: 'skyblue', pointColor: 'deepskyblue' }).draw(canvas);
    const jaw = resized.landmarks.getJawOutline() || [];
    const nose = resized.landmarks.getNose() || [];
    const mouth = resized.landmarks.getMouth() || [];
    const leftEye = resized.landmarks.getLeftEye() || [];
    const rightEye = resized.landmarks.getRightEye() || [];
    const leftEyeBrow = resized.landmarks.getLeftEyeBrow() || [];
    const rightEyeBrow = resized.landmarks.getRightEyeBrow() || [];
    faceDetails = `Points jaw:${jaw.length} mouth:${mouth.length} nose:${nose.length} left-eye:${leftEye.length} right-eye:${rightEye.length} left-eyebrow:${leftEyeBrow.length} right-eyebrow:${rightEyeBrow.length}`;
  }

  // draw objects
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'lightyellow';
  ctx.linewidth = 2;
  if (object.detect) {
    for (const obj of object.detect) {
      ctx.beginPath();
      const x = obj.box[0] * img.width / object.size.width;
      const y = obj.box[1] * img.height / object.size.height;
      const width = obj.box[2] * img.width / object.size.width;
      const height = obj.box[3] * img.height / object.size.height;
      ctx.rect(x, y, width, height);
      ctx.stroke();
      ctx.fillStyle = 'lightyellow';
      ctx.font = '16px Roboto';
      ctx.fillText(`${(100 * obj.score).toFixed(0)}% ${obj.class}`, x + 2, y + 18);
    }
  }

  return faceDetails;
}

function showDetails(i) {
  const object = results[i];

  const img = document.getElementById('details-image');
  img.addEventListener('load', () => {
    let classified = 'Classified ';
    if (object.classify) for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;

    let detected = 'Detected ';
    if (object.detect) for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;

    let person = '';
    if (object.person && object.person.age) {
      person = `Person | 
        Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} | 
        Age: ${object.person.age.toFixed(1)} | 
        Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
    }

    let nsfw = '';
    if (object.person && object.person.class) {
      nsfw = `Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class} `;
    }

    let desc = '<h2>Description:</h2><ul>';
    if (object.classify) {
      for (const guess of object.classify) {
        const descriptions = object.classify && object.classify[0] ? searchClasses(guess.wnid) : [];
        for (const description of descriptions) {
          desc += `<li><b>${description.name}</b>: <i>${description.desc}</i></li>`;
        }
        desc += '<br>';
      }
    }
    desc += '</ul>';

    const faceDetails = drawBoxes(img, object) || '';

    document.getElementById('details-result').innerHTML = `
      <h2>Image: ${object.image}</h2>
      Image size: ${img.naturalWidth} x ${img.naturalHeight}
        Processed in ${object.perf.total.toFixed(0)}ms<br>
        Classified using ${config.classify ? config.classify.name : 'N/A'} in ${object.perf.classify.toFixed(0)}ms<br>
        Detected using ${config.detect ? config.detect.name : 'N/A'} in ${object.perf.detect.toFixed(0)}ms<br>
        Person using ${config.person ? config.person.name : 'N/A'} in ${object.perf.person.toFixed(0)}ms<br>
      <h2>${classified}</h2>
      <h2>${detected}</h2>
      <h2>${person} ${nsfw}</h2>
      ${faceDetails}<br>
      ${desc}<br>
      </div>
    `;

    const div = document.getElementById('details');
    div.addEventListener('click', () => { div.style.display = 'none'; });
    div.style.display = 'flex';
  });
  img.src = object.image;
}

async function loadModels() {
  log('Starting Image Analsys');
  log(`Initializing TensorFlow/JS version ${tf.version.tfjs}`);
  await tf.setBackend(config.backEnd);
  await tf.enableProdMode();
  if (!config.floatPrecision) await tf.webgl.forceHalfFloat();
  log(`Configured Backend: ${tf.getBackend().toUpperCase()}`);
  log('Configuration:');
  log(`&nbsp Parallel processing: ${config.batchProcessing} parallel images`);
  log(`&nbsp Forced image resize: ${config.maxSize}px maximum shape: ${config.squareImage ? 'square' : 'native'}`);
  log(`&nbsp Flaoat Precision: ${config.floatPrecision ? '32bit' : '16bit'}`);
  log(`&nbsp Classify: ${JSONtoStr(config.classify)}`);
  log(`&nbsp Detect: ${JSONtoStr(config.detect)}`);
  log(`&nbsp Person: ${JSONtoStr(config.person)}`);

  log('Loading models...');
  const t0 = window.performance.now();

  if (config.classify) {
    log(`&nbsp Model: ${config.classify.name}`);
    models.classify = await modelClassify.load(config.classify);
  }

  if (config.detect) {
    log(`&nbsp Model: ${config.detect.name}`);
    models.detect = await modelDetect.load(config.detect);
  }

  if (config.person) {
    log(`&nbsp Model: ${config.person.name}`);
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
  log('&nbsp Model: DarkNet/Yolo-v3');
  models.yolo = await yolo.v1tiny('/models/yolo-v1-tiny/model.json');
  models.yolo = await yolo.v2tiny('/models/yolo-v2-tiny/model.json');
  models.yolo = await yolo.v3tiny('/models/yolo-v3-tiny/model.json');
  models.yolo = await yolo.v3('/models/yolo-v3-full/model.json');
  */

  /* working but unreliable
  log('&nbsp Model: NSFW');
  models.nsfw = await nsfwjs.load('/models/nsfw-mini/', { size: 224, type: 'layers' });
  models.nsfw = await nsfwjs.load('/models/nsfw-inception-v3/', { size: 299, type: 'layers' });
  */

  log(`Models loaded in ${(window.performance.now() - t0).toLocaleString()}ms`);
  const engine = await tf.engine();
  log(`Engine State: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);

  log('Loading WordNet classification classes ...');
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
    // console.log(faceMatcher, bestMatch);
    let emotion = Object.entries(result.expressions)
      .reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    emotion = { label: emotion && emotion[0] ? emotion[0] : '', confidence: emotion && emotion[1] ? emotion[1] : 0 };
    return { gender: { confidence: result.genderProbability, label: result.gender }, age: result.age, emotion: { confidence: emotion.confidence, label: emotion.label }, detection: result };
  }
  return null;
};

async function printResult(object, image) {
  let classified = '';
  if (object.classify) for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let detected = '';
  if (object.detect) for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let person = '';
  let nsfw = '';
  if (object.person && object.person.age) {
    person = `Person in ${object.perf.person.toFixed(0)}ms | 
      Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} 
      Age: ${object.person.age.toFixed(1)} 
      Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
  }
  if (object.person && object.person.class) {
    nsfw = `Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class} `;
  }
  const div = document.createElement('div');
  div.class = 'col';
  div.style = 'display: flex';
  const canvas = document.createElement('canvas');
  canvas.height = 110;
  canvas.width = 110;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image.image, 0, 0, 110, 110);
  const imageData = canvas.toDataURL('image/jpeg', 0.5);
  div.innerHTML = `
    <div class="col" style="height: 114x; min-width: 114px; max-width: 114px"><img id="thumbnail" src="${imageData}" width="106px" height="106px"></div>
    <div class="col" style="height: 114px; min-width: 575px; max-width: 575px">
      Image ${decodeURI(object.image)} processed in ${object.perf.total.toFixed(0)}ms src:${image.image.naturalWidth}x${image.image.naturalHeight} tgt:${image.canvas.width}x${image.canvas.height}<br>
      Classified in ${object.perf.classify.toFixed(0)}ms ${classified}<br>
      Detected in ${object.perf.detect.toFixed(0)}ms ${detected}<br>
      ${person} ${nsfw}<br>
    </div>
  `;
  await document.getElementById('result').appendChild(div);
  const thumbnail = document.getElementById('thumbnail');
  thumbnail.id = object.id;
  thumbnail.addEventListener('click', (evt) => showDetails(evt.currentTarget.id));
}

async function getImage(img) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => {
      if (Math.max(image.width, image.height) > config.maxSize) {
        if (config.squareImage) {
          image.height = config.maxSize;
          image.width = config.maxSize;
        } else {
          const ratio = 1.0 * image.height / image.width;
          image.width = ratio < 1 ? config.maxSize : config.maxSize / ratio;
          image.height = ratio > 1 ? config.maxSize : config.maxSize * ratio;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.height = image.height;
      canvas.width = image.width;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, image.width, image.height);
      resolve({ image, canvas });
    });
    image.src = img;
  });
}

async function processImage(name) {
  active(`Loading: ${name}`);
  const t0 = window.performance.now();
  const image = await getImage(name);
  const res = {};

  active(`Classifying: ${name}`);
  const tc0 = window.performance.now();
  try {
    if (models.classify) res.classify = await models.classify.classify(image.canvas);
  } catch (err) {
    log(`Errror in MobileNet for ${name}: ${err}`);
  }
  const tc1 = window.performance.now();

  active(`Detecting: ${name}`);
  const td0 = window.performance.now();
  try {
    if (models.detect) res.detect = await models.detect.detect(image.canvas);
  } catch (err) {
    log(`Errror in CocoSSD for ${name}: ${err}`);
  }
  const td1 = window.performance.now();

  // const detect = await models.yolo.predict(image.canvas, { maxBoxes: 3, scoreThreshold: 0.3 });
  // res.detect = detect.map((a) => ({ score: a.score, class: a.class }));

  const tp0 = window.performance.now();
  if (res.detect && res.detect.find((a) => a.class === 'person')) {
    active(`NSFW Detection: ${name}`);
    try {
      if (models.nsfw) res.nsfw = await models.nsfw.classify(image.canvas, 1);
    } catch (err) {
      log(`Errror in NSFW for ${name}: ${err}`);
    }
    active(`Face Detection: ${name}`);
    try {
      if (models.faceapi) res.face = await models.faceapi.classify(image.canvas, 1);
    } catch (err) {
      log(`Errror in FaceAPI for ${name}: ${err}`);
    }
    res.person = {
      scoreGender: (res.face && res.face.gender) ? res.face.gender.confidence : null,
      gender: (res.face && res.face.gender) ? res.face.gender.label : null,
      age: (res.face && res.face.age) ? res.face.age : null,
      scoreEmotion: (res.face && res.face.emotion) ? res.face.emotion.confidence : null,
      emotion: (res.face && res.face.emotion) ? res.face.emotion.label : null,
      scoreClass: (res.nsfw && res.nsfw[0]) ? res.nsfw[0].probability : null,
      class: (res.nsfw && res.nsfw[0]) ? res.nsfw[0].className : null,
      detection: (res.face && res.face.detection) ? res.face.detection : null,
    };
  }
  const tp1 = window.performance.now();

  const t1 = window.performance.now();

  const obj = {
    id: id++,
    image: name,
    size: { width: image.canvas.width, height: image.canvas.height },
    classify: res.classify,
    detect: res.detect,
    person: res.person,
    perf: { total: t1 - t0, classify: tc1 - tc0, detect: td1 - td0, person: tp1 - tp0 },
  };
  results.push(obj);
  active(`Printing: ${name}`);
  printResult(obj, image);
  active(`Done: ${name}`);
  return obj;
}

async function loadGallery(what) {
  active(`Fetching list: ${what}`);
  const res = await fetch(`/list/${what}`);
  const dir = await res.json();
  log(`Queued: ${dir.files.length} images from ${dir.folder}/${what} ...`);
  const t0 = window.performance.now();
  const promises = [];
  for (const f of dir.files) {
    promises.push(processImage(`${dir.folder}/${f}`));
    if (promises.length >= config.batchProcessing) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  if (promises.length > 0) await Promise.all(promises);
  const t1 = window.performance.now();
  log(`Finished processed ${dir.files.length} images from ${dir.folder}/${what}: total: ${(t1 - t0).toLocaleString()}ms average: ${((t1 - t0) / dir.files.length).toLocaleString()}ms / image`);
  active('Idle...');
}

async function warmupModels() {
  log('Models warming up ...');
  const t0 = window.performance.now();
  await processImage('/samples/warmup.jpg');
  const t1 = window.performance.now();
  log(`Models warmed up in ${(t1 - t0).toFixed(0)}ms`);
}

async function main() {
  await loadModels();
  await warmupModels();

  await loadGallery('objects');
  await loadGallery('people');
  await loadGallery('large');
}

window.onload = main;
