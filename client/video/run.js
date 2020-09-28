/* global tf, log, models, canvases, perf, params, extracted, detected */

const facemesh = require('@tensorflow-models/facemesh/dist/facemesh.js');
const handpose = require('@tensorflow-models/handpose/dist/handpose.js');
const cocossd = require('@tensorflow-models/coco-ssd/dist/coco-ssd.js');
const posenet = require('@tensorflow-models/posenet/dist/posenet.js');
const faceapi = require('@vladmandic/face-api');
const definitions = require('../shared/models.js').models;
const draw = require('./draw.js');
const modelClassify = require('../process/modelClassify.js');

function appendCanvas(name, width, height) {
  canvases[name] = document.createElement('canvas', { desynchronized: true });
  canvases[name].style.position = 'relative';
  canvases[name].id = `canvas-${name}`;
  canvases[name].style.position = 'absolute';
  canvases[name].style.top = 0;
  canvases[name].width = width;
  canvases[name].height = height;
  document.getElementById('drawcanvas').appendChild(canvases[name]);
}

async function runPoseNet(image, video) {
  // https://github.com/tensorflow/tfjs-models/tree/master/posenet
  const t0 = performance.now();
  if (!models.posenet) {
    document.getElementById('status').innerHTML = 'Loading models ...';
    const memory0 = await tf.memory();
    models.posenet = await posenet.load({
      architecture: document.getElementById('menu-complex').checked ? 'ResNet50' : 'MobileNetV1',
      outputStride: 16,
      multiplier: document.getElementById('menu-complex').checked ? 1 : 0.75,
      quantBytes: params.quantBytes,
      // inputResolution: { width: image.width, height: image.height },
    });
    const memory1 = await tf.memory();
    log.div('log', true, `Loaded model PoseNet: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!canvases.posenet) appendCanvas('posenet', video.offsetWidth, video.offsetHeight);
  const poses = await models.posenet.estimateMultiplePoses(image, {
    maxDetections: params.maxObjects,
    scoreThreshold: params.minThreshold,
    nmsRadius: 20,
  });
  const t1 = performance.now();
  perf.PoseNet = Math.trunc(t1 - t0);
  if ((perf.Frame === 0) || !canvases.posenet) return { posenet: poses };
  canvases.posenet.getContext('2d').clearRect(0, 0, canvases.posenet.width, canvases.posenet.height);
  const labels = document.getElementById('menu-labels').checked;
  const lines = document.getElementById('menu-lines').checked;
  const highlight = document.getElementById('menu-points').checked;
  for (const pose in poses) {
    for (const point of poses[pose].keypoints) {
      if (point.score > params.minThreshold) {
        const label = `${(100 * point.score).toFixed(1)} ${point.part}`;
        // detected.push(label);
        if (highlight) {
          draw.point({
            canvas: canvases.posenet,
            x: point.position.x * canvases.posenet.width / image.width,
            y: point.position.y * canvases.posenet.height / image.height,
            color: 'rgba(0, 200, 255, 0.5)',
            radius: 4,
            title: labels ? label : null,
          });
        }
      }
    }
    if (lines) {
      const points = [];
      const line = [];
      points.length = 0;
      line.length = 0;
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftElbow'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftWrist'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.posenet.width / image.width, point.position.y * canvases.posenet.height / image.height]);
      }
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
      points.length = 0;
      line.length = 0;
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightElbow'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightWrist'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.posenet.width / image.width, point.position.y * canvases.posenet.height / image.height]);
      }
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
      points.length = 0;
      line.length = 0;
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftEye'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftEar'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightEye'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightEar'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftEye'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.posenet.width / image.width, point.position.y * canvases.posenet.height / image.height]);
      }
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
      points.length = 0;
      line.length = 0;
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftHip'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftKnee'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftAnkle'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.posenet.width / image.width, point.position.y * canvases.posenet.height / image.height]);
      }
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
      points.length = 0;
      line.length = 0;
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightHip'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightKnee'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightAnkle'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.posenet.width / image.width, point.position.y * canvases.posenet.height / image.height]);
      }
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
    }
  }
  const t2 = performance.now();
  perf.Canvas += t2 - t1;
  return { posenet: poses };
}

async function runFaceMesh(image, video) {
  // https://github.com/tensorflow/tfjs-models/tree/master/facemesh
  const t0 = performance.now();
  if (!models.facemesh) {
    document.getElementById('status').innerHTML = 'Loading models ...';
    const memory0 = await tf.memory();
    models.facemesh = await facemesh.load({
      maxContinuousChecks: params.skipFrames,
      detectionConfidence: params.minThreshold,
      maxFaces: params.maxObjects,
      iouThreshold: params.minThreshold,
      scoreThreshold: params.minThreshold,
    });
    const memory1 = await tf.memory();
    log.div('log', true, `Loaded model FaceMesh: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!canvases.facemesh) appendCanvas('facemesh', video.offsetWidth, video.offsetHeight);
  const faces = await models.facemesh.estimateFaces(image);
  const t1 = performance.now();
  perf.FaceMesh = Math.trunc(t1 - t0);
  if ((perf.Frame === 0) || !canvases.facemesh) return { facemesh: faces };
  canvases.facemesh.getContext('2d').clearRect(0, 0, canvases.facemesh.width, canvases.facemesh.height);
  const labels = document.getElementById('menu-labels').checked;
  const boxes = document.getElementById('menu-boxes').checked;
  for (const face of faces) {
    const x = face.boundingBox.topLeft[0];
    const y = face.boundingBox.topLeft[1];
    const width = face.boundingBox.bottomRight[0] - face.boundingBox.topLeft[0];
    const height = face.boundingBox.bottomRight[1] - face.boundingBox.topLeft[1];
    // add face thumbnails
    if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(image, x, y, width, height, { title: 'face' }));
    const label = `${(100 * face.faceInViewConfidence).toFixed(1)}% face`;
    detected.push(label);
    // draw border around detected faces
    if (boxes) {
      draw.rect({
        canvas: canvases.facemesh,
        x: x * canvases.facemesh.width / image.width,
        y: y * canvases.facemesh.height / image.height,
        width: width * canvases.facemesh.width / image.width,
        height: height * canvases.facemesh.height / image.height,
        lineWidth: 4,
        color: 'rgba(125, 255, 255, 0.4)',
        title: label,
      });
    }
    // draw & label key face points
    for (const [key, val] of Object.entries(face.annotations)) {
      for (const point in val) {
        draw.point({
          canvas: canvases.facemesh,
          x: val[point][0] * canvases.facemesh.width / image.width,
          y: val[point][1] * canvases.facemesh.height / image.height,
          color: `rgba(${125 + 2 * val[point][2]}, ${255 - 2 * val[point][2]}, 255, 0.5)`,
          radius: 2,
          alpha: 0.5,
          title: ((point >= val.length - 1) && labels) ? key : null,
        });
      }
    }
    // draw all face points
    if (document.getElementById('menu-mesh').checked) {
      for (const point of face.scaledMesh) {
        draw.point({
          canvas: canvases.facemesh,
          x: point[0] * canvases.facemesh.width / image.width,
          y: point[1] * canvases.facemesh.height / image.height,
          color: `rgba(${125 + 2 * point[2]}, ${255 - 2 * point[2]}, 255, 0.5)`,
          blue: 255,
          radius: 1,
        });
      }
    }
  }
  const t2 = performance.now();
  perf.Canvas += t2 - t1;
  return { facemesh: faces };
}

async function runCocoSSD(image, video) {
  // https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd
  const t0 = performance.now();
  if (!models.cocossd) {
    document.getElementById('status').innerHTML = 'Loading models ...';
    const memory0 = await tf.memory();
    models.cocossd = await cocossd.load({ base: document.getElementById('menu-complex').checked ? 'mobilenet_v2' : 'lite_mobilenet_v2' });
    const memory1 = await tf.memory();
    log.div('log', true, `Loaded model CocoSSD: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!canvases.cocossd) appendCanvas('cocossd', video.offsetWidth, video.offsetHeight);
  const objects = await models.cocossd.detect(image, params.maxObjects, params.minThreshold);
  const t1 = performance.now();
  perf.CocoSSD = Math.trunc(t1 - t0);
  if ((perf.Frame === 0) || !canvases.cocossd) return { cocossd: objects };
  canvases.cocossd.getContext('2d').clearRect(0, 0, canvases.cocossd.width, canvases.cocossd.height);
  for (const object of objects) {
    const x = object.bbox[0];
    const y = object.bbox[1];
    const width = object.bbox[2];
    const height = object.bbox[3];
    if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(image, x, y, width, height, { title: object.class }));
    const label = `${(100 * object.score).toFixed(1)}% ${object.class}`;
    detected.push(label);
    draw.rect({
      canvas: canvases.cocossd,
      x: x * canvases.cocossd.width / image.width,
      y: y * canvases.cocossd.height / image.height,
      width: width * canvases.cocossd.width / image.width,
      height: height * canvases.cocossd.height / image.height,
      lineWidth: 4,
      color: 'rgba(125, 255, 255, 0.4)',
      title: label });
  }
  const t2 = performance.now();
  perf.Canvas += t2 - t1;
  return { cocossd: objects };
}

async function runHandPose(image, video) {
  // https://github.com/tensorflow/tfjs-models/tree/master/handpose
  const t0 = performance.now();
  if (!models.handpose) {
    document.getElementById('status').innerHTML = 'Loading models ...';
    const memory0 = await tf.memory();
    models.handpose = await handpose.load({
      maxContinuousChecks: params.skipFrames,
      detectionConfidence: params.minThreshold,
      iouThreshold: params.minThreshold,
      scoreThreshold: params.minThreshold,
    });
    const memory1 = await tf.memory();
    log.div('log', true, `Loaded model HandPose: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!canvases.handpose) appendCanvas('handpose', video.offsetWidth, video.offsetHeight);
  const hands = await models.handpose.estimateHands(image);
  const t1 = performance.now();
  perf.HandPose = Math.trunc(t1 - t0);
  if ((perf.Frame === 0) || !canvases.handpose) return { handpose: hands };
  canvases.handpose.getContext('2d').clearRect(0, 0, canvases.handpose.width, canvases.handpose.height);
  const labels = document.getElementById('menu-labels').checked;
  const lines = document.getElementById('menu-lines').checked;
  const highlight = document.getElementById('menu-points').checked;
  const boxes = document.getElementById('menu-boxes').checked;
  for (const hand of hands) {
    const x = hand.boundingBox.topLeft[0];
    const y = hand.boundingBox.topLeft[1];
    const width = hand.boundingBox.bottomRight[0] - hand.boundingBox.topLeft[0];
    const height = hand.boundingBox.bottomRight[1] - hand.boundingBox.topLeft[1];
    if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(image, x, y, width, height, { title: 'hand' }));
    // hand bounding box
    const label = `${(100 * hand.handInViewConfidence).toFixed(1)}% hand`;
    detected.push(label);
    if (boxes) {
      draw.rect({
        canvas: canvases.handpose,
        x: x * canvases.handpose.width / image.width,
        y: y * canvases.handpose.height / image.height,
        width: width * canvases.handpose.width / image.width,
        height: height * canvases.handpose.height / image.height,
        lineWidth: 4,
        color: 'rgba(125, 255, 255, 0.4)',
        title: label,
      });
    }
    const points = [];
    for (const [key, val] of Object.entries(hand.annotations)) {
      points.length = 0;
      for (const point in val) points.push([val[point][0] * canvases.handpose.width / image.width, val[point][1] * canvases.handpose.height / image.height, val[point][2]]);
      points.reverse();
      // draw connected line between finger points
      if (lines) draw.spline({ canvas: canvases.handpose, color: 'rgba(125, 255, 255, 0.2)', points, lineWidth: 10, tension: params.lineTension });
      // draw all finger hand points
      if (highlight) {
        for (let point = 0; point < points.length; point++) {
          draw.point({
            canvas: canvases.handpose,
            x: points[point][0],
            y: points[point][1],
            color: `rgba(${125 + 4 * points[point][2]}, ${125 - 4 * points[point][2]}, 255, 0.5)`,
            radius: 3,
            title: (labels && (point === 0)) ? key : null,
          });
        }
      }
    }
  }
  const t2 = performance.now();
  perf.Canvas += t2 - t1;
  return { handpose: hands };
}

async function runFaceApi(image, video) {
  // https://github.com/vladmandic/face-api
  const t0 = performance.now();
  if (!models.faceapi) {
    document.getElementById('status').innerHTML = 'Loading models ...';
    const memory0 = await tf.memory();
    const opt = definitions.video.person;
    $('#video-status').text('Loading Face Recognition model ...');
    const complex = document.getElementById('menu-complex').checked;
    if (complex) await faceapi.nets.ssdMobilenetv1.load(opt.modelPath);
    else await faceapi.nets.tinyFaceDetector.load(opt.modelPath);
    await faceapi.nets.ageGenderNet.load(opt.modelPath);
    // await faceapi.nets.faceLandmark68Net.load(opt.modelPath);
    if (complex) models.faceapi = new faceapi.SsdMobilenetv1Options({ minConfidence: params.minThreshold, maxResults: params.maxObjects });
    else models.faceapi = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: params.minThreshold, inputSize: opt.tensorSize });
    const memory1 = await tf.memory();
    log.div('log', true, `Loaded model FaceAPI: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!canvases.faceapi) appendCanvas('faceapi', video.offsetWidth, video.offsetHeight);
  const tensor = tf.browser.fromPixels(image);
  const faces = await faceapi.detectAllFaces(tensor, models.faceapi).withAgeAndGender();
  const t1 = performance.now();
  perf.FaceAPI = Math.trunc(t1 - t0);
  if ((perf.Frame === 0) || !canvases.faceapi) return { faceapi: faces };
  canvases.faceapi.getContext('2d').clearRect(0, 0, canvases.faceapi.width, canvases.faceapi.height);
  const boxes = document.getElementById('menu-boxes').checked;
  for (const face of faces) {
    const x = face.detection.box.x;
    const y = face.detection.box.y;
    const width = face.detection.box.width;
    const height = face.detection.box.height;
    if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(image, x, y, width, height, { title: `${face.gender} ${face.age.toFixed(1)}y` }));
    const title = `${(100 * face.genderProbability).toFixed(1)}% ${face.gender} ${face.age.toFixed(1)}y`;
    detected.push(title);
    if (boxes) {
      draw.rect({
        canvas: canvases.faceapi,
        x: x * canvases.faceapi.width / image.width,
        y: y * canvases.faceapi.height / image.height,
        width: width * canvases.faceapi.width / image.width,
        height: height * canvases.faceapi.height / image.height,
        lineWidth: 4,
        color: 'rgba(125, 255, 255, 0.4)',
        title,
      });
    }
  }
  const t2 = performance.now();
  perf.Canvas += t2 - t1;
  return { faceapi: faces };
}

async function runClassify(name, image, video) {
  const t0 = performance.now();
  if (!models[name]) {
    document.getElementById('status').innerHTML = 'Loading models ...';
    const memory0 = await tf.memory();
    const opt = definitions.video[name];
    opt.score = params.minThreshold;
    $('#video-status').text(`Loading ${name} model ...`);
    models[name] = await modelClassify.load(opt);
    const memory1 = await tf.memory();
    log.div('log', true, `Loaded model ${name}: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!canvases[name]) appendCanvas(name, video.offsetWidth, video.offsetHeight);
  const res = await modelClassify.classify(models[name], image);
  if (res && res[0]) {
    const title = `${(100 * res[0].score).toFixed(1)}% ${name}:${res[0].class}`;
    detected.push(title);
    extracted.push(draw.crop(image, 0, 0, image.width, image.height, { title }));
  }
  const t1 = performance.now();
  perf[name] = Math.trunc(t1 - t0);
  const obj = {};
  obj[name] = res;
  return obj;
}

async function runFood(image, video) {
  // https://tfhub.dev/google/aiy/vision/classifier/food_V1/1
  return runClassify('food', image, video);
}

async function runPlants(image, video) {
  // https://tfhub.dev/google/aiy/vision/classifier/plants_V1/1
  return runClassify('plants', image, video);
}

async function runBirds(image, video) {
  // https://tfhub.dev/google/aiy/vision/classifier/birds_V1/1
  return runClassify('birds', image, video);
}

async function runInsects(image, video) {
  // https://tfhub.dev/google/aiy/vision/classifier/insects_V1/1
  return runClassify('insects', image, video);
}

async function runNSFW(image, video) {
  // https://github.com/infinitered/nsfwjs
  return runClassify('nsfw', image, video);
}

async function runImageNet(image, video) {
  // https://tfhub.dev/tensorflow/efficientnet/b0/classification/1
  return runClassify('imagenet', image, video);
}

async function runDeepDetect(image, video) {
  return runClassify('deepdetect', image, video);
}

exports.cocossd = runCocoSSD;
exports.faceapi = runFaceApi;
exports.facemesh = runFaceMesh;
exports.handpose = runHandPose;
exports.posenet = runPoseNet;
exports.food = runFood;
exports.plants = runPlants;
exports.birds = runBirds;
exports.insects = runInsects;
exports.nsfw = runNSFW;
exports.imagenet = runImageNet;
exports.deepdetect = runDeepDetect;
