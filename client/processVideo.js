const tf = require('@tensorflow/tfjs');
const faceapi = require('face-api.js');
const modelDetect = require('./modelDetect.js');
const log = require('./log.js');
const config = require('./config.js').default;

const models = {};
let offscreenCanvas;

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"/g, '').replace(/,/g, ', ');
}

async function loadModels() {
  log.result('Starting Video Analsys');
  log.result(`Initializing TensorFlow/JS version ${tf.version.tfjs}`);
  await tf.setBackend(config.backEnd);
  await tf.enableProdMode();
  if (!config.floatPrecision) await tf.webgl.forceHalfFloat();
  log.result(`Configured Backend: ${tf.getBackend().toUpperCase()}`);
  log.result('Configuration:');
  log.result(`  Float Precision: ${config.floatPrecision ? '32bit' : '16bit'}`);
  log.result(`  Detect: ${JSONtoStr(config.detect)}`);
  log.result(`  Person: ${JSONtoStr(config.person)}`);

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
  }

  const engine = await tf.engine();
  log.result(`Engine state: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);
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
  res.detect = await modelDetect.exec(models.detect, screenshot);
  res.face = await faceapi.detectAllFaces(screenshot).withFaceLandmarks().withAgeAndGender();
  res.canvas = screenshot;
  return res;
}

exports.load = loadModels;
exports.process = processVideo;
