/* eslint-disable no-underscore-dangle */

import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import modelClassify from './modelClassify.js';
import modelDetect from './modelDetect.js';
import log from './log.js';

const models = {};

function JSONtoStr(json) {
  if (json) return JSON.stringify(json).replace(/{|}|"/g, '').replace(/,/g, ', ');
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

  log.result(`Models loaded in ${(window.performance.now() - t0).toLocaleString()}ms`);
  const engine = await tf.engine();
  log.result(`Engine State: Bytes: ${engine.state.numBytes.toLocaleString()} Buffers:${engine.state.numDataBuffers.toLocaleString()} Tensors:${engine.state.numTensors.toLocaleString()}`);
}

faceapi.classify = async (image) => {
  const result = await faceapi.detectSingleFace(image, faceapi.options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender();
  if (result) {
    let emotion = Object.entries(result.expressions)
      .reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    emotion = { label: emotion && emotion[0] ? emotion[0] : '', confidence: emotion && emotion[1] ? emotion[1] : 0 };
    return { gender: { confidence: result.genderProbability, label: result.gender }, age: result.age, emotion: { confidence: emotion.confidence, label: emotion.label }, detection: result };
  }
  return null;
};

async function processVideo(video) {
  const res = {};

  if (models.classify) res.classify = await models.classify.classify(video);
  if (models.detect) res.detect = await models.detect.detect(video);
  if (res.detect && res.detect.find((a) => a.class === 'person')) {
    if (models.faceapi) res.face = await models.faceapi.classify(video, 1);
    if (res.face && res.face.detection & res.face.detection.detections) { // remove unnecessary objects
      delete res.face.detection.detections.detection.alignedRect;
      delete res.face.detection.detections.detection.expressions;
      delete res.face.detection.detections.detection.unshiftedLandmarks;
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

  const obj = {
    classify: res.classify,
    detect: res.detect,
    person: res.person,
  };
  return obj;
}

exports.load = loadModels;
exports.process = processVideo;
