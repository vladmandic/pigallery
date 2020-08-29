const modelDetect = require('./modelDetect.js');
const log = require('./log.js');
const config = require('./config.js').default;

let tf = window.tf;
let faceapi = window.faceapi;

const models = {};
let offscreenCanvas;

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"/g, '').replace(/,/g, ', ');
}

async function loadModels() {
  tf = window.tf;
  faceapi = window.faceapi;
  const detect = $('#detect')[0].value;
  if (detect === 'OpenImages with SSD/MobileNet v2') config.detect = { name: detect, modelPath: 'models/ssd-mobilenet-v2/model.json', score: 0.2, topK: 6, useFloat: true, scoreScale: 1, classes: 'assets/OpenImage-Labels.json', exec: modelDetect.detectSSD };
  if (detect === 'CoCo with SSD/MobileNet v2') config.detect = { name: 'Coco/SSD v2', modelPath: 'models/cocossd-v2/model.json', score: 0.4, topK: 6, overlap: 0.1 };

  const person = $('#person')[0].value;
  if (person === 'FaceAPI SSD/MobileNet v1') config.person = { name: person, modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'ssdMobilenetv1' };
  if (person === 'FaceAPI SSD/TinyYolo v3') config.person = { name: person, modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyFaceDetector' };

  log.div('log', true, 'Starting Video Analsys');
  log.div('log', true, `Initializing TensorFlow/JS version ${tf.version.tfjs}`);
  await tf.setBackend(config.backEnd);
  await tf.enableProdMode();
  if (!config.floatPrecision) await tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true);
  log.div('log', true, `Configured Backend: ${tf.getBackend().toUpperCase()}`);
  log.div('log', true, 'Configuration:');
  log.div('log', true, `  Float Precision: ${config.floatPrecision ? '32bit' : '16bit'}`);
  log.div('log', true, `  Detect: ${JSONtoStr(config.detect)}`);
  log.div('log', true, `  Person: ${JSONtoStr(config.person)}`);

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
      default:
    }
    await faceapi.nets.ageGenderNet.load(config.person.modelPath);
    await faceapi.nets.faceLandmark68Net.load(config.person.modelPath);
    await faceapi.nets.faceRecognitionNet.load(config.person.modelPath);
    await faceapi.nets.faceExpressionNet.load(config.person.modelPath);
  }

  const engine = await tf.engine();
  return { bytes: engine.state.numBytes, tensors: engine.state.numTensors };
  // log.div('log', true, `Engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);
}

async function getImage(stream) {
  const video = stream;
  const ratio = 1.0 * video.height / video.width;
  let width = video.width;
  let height = video.height;
  if (Math.max(video.width, video.height) > config.maxSize) {
    width = ratio <= 1 ? config.maxSize : 1.0 * config.maxSize / ratio;
    height = ratio >= 1 ? config.maxSize : 1.0 * config.maxSize * ratio;
  }
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.height = height;
    offscreenCanvas.width = width;
  }
  const ctx = offscreenCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);
  return offscreenCanvas;
}

async function processVideo(video) {
  const res = {};
  const screenshot = await getImage(video);
  const t0 = window.performance.now();
  res.detect = await modelDetect.exec(models.detect, screenshot);
  const t1 = window.performance.now();
  res.face = await faceapi.detectAllFaces(screenshot, faceapi.options).withFaceLandmarks().withAgeAndGender();
  const t2 = window.performance.now();
  res.canvas = screenshot;
  res.timeDetect = t1 - t0;
  res.timeFace = t2 - t1;
  return res;
}

exports.load = loadModels;
exports.process = processVideo;
exports.models = models;
