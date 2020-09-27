/* global tf, log, models, canvases, perf, params, results, extracted, detected, faceapi */

window.tf = require('@tensorflow/tfjs/dist/tf.es2017.js');
window.faceapi = require('@vladmandic/face-api');
const facemesh = require('@tensorflow-models/facemesh/dist/facemesh.js');
const handpose = require('@tensorflow-models/handpose/dist/handpose.js');
const cocossd = require('@tensorflow-models/coco-ssd/dist/coco-ssd.js');
const posenet = require('@tensorflow-models/posenet/dist/posenet.js');
const draw = require('./draw.js');
const gesture = require('./gesture.js');
const fx = require('../../assets/webgl-image-filter.js');
const definitions = require('../shared/models.js').models;

let fxFilter = null;

// using window globals for debugging purposes
window.perf = { Frame: 0 }; // global performance counters
window.models = []; // global list of all loaded modeles
window.canvases = []; // global list of all per-model canvases
window.extracted = [];
window.detected = [];
const fps = [];

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
  if (!canvases.posenet) {
    canvases.posenet = document.createElement('canvas', { desynchronized: true });
    canvases.posenet.style.position = 'relative';
    canvases.posenet.id = 'canvas-posenet';
    canvases.posenet.style.position = 'absolute';
    canvases.posenet.style.top = 0;
    canvases.posenet.width = video.offsetWidth;
    canvases.posenet.height = video.offsetHeight;
    document.getElementById('drawcanvas').appendChild(canvases.posenet);
  }
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
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)' });
      points.length = 0;
      line.length = 0;
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightElbow'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightWrist'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.posenet.width / image.width, point.position.y * canvases.posenet.height / image.height]);
      }
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)' });
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
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)' });
      points.length = 0;
      line.length = 0;
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftHip'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftKnee'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'leftAnkle'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.posenet.width / image.width, point.position.y * canvases.posenet.height / image.height]);
      }
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)' });
      points.length = 0;
      line.length = 0;
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightShoulder'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightHip'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightKnee'));
      points.push(poses[pose].keypoints.find((a) => a.part === 'rightAnkle'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.posenet.width / image.width, point.position.y * canvases.posenet.height / image.height]);
      }
      draw.spline({ canvas: canvases.posenet, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)' });
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
  if (!canvases.facemesh) {
    canvases.facemesh = document.createElement('canvas', { desynchronized: true });
    canvases.facemesh.style.position = 'relative';
    canvases.facemesh.id = 'canvas-facemesh';
    canvases.facemesh.style.position = 'absolute';
    canvases.facemesh.style.top = 0;
    canvases.facemesh.width = video.offsetWidth;
    canvases.facemesh.height = video.offsetHeight;
    document.getElementById('drawcanvas').appendChild(canvases.facemesh);
  }
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
  if (!canvases.cocossd) {
    canvases.cocossd = document.createElement('canvas', { desynchronized: true });
    canvases.cocossd.style.position = 'relative';
    canvases.cocossd.id = 'canvas-cocossd';
    canvases.cocossd.style.position = 'absolute';
    canvases.cocossd.style.top = 0;
    canvases.cocossd.width = video.offsetWidth;
    canvases.cocossd.height = video.offsetHeight;
    document.getElementById('drawcanvas').appendChild(canvases.cocossd);
  }
  const objects = await models.cocossd.detect(image, params.maxObjects, params.minThreshold);
  const t1 = performance.now();
  perf.CocoSSD = Math.trunc(t1 - t0);
  if ((perf.Frame === 0) || !canvases.cocossd) return { cocossd: objects };
  canvases.cocossd.getContext('2d').clearRect(0, 0, canvases.cocossd.width, canvases.cocossd.height);
  for (const object of objects) {
    const x = object.bbox[0] * canvases.cocossd.width / image.width;
    const y = object.bbox[1] * canvases.cocossd.height / image.height;
    const width = object.bbox[2] * canvases.cocossd.width / image.width;
    const height = object.bbox[3] * canvases.cocossd.height / image.height;
    if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(image, x, y, width, height, { title: object.class }));
    const label = `${(100 * object.score).toFixed(1)}% ${object.class}`;
    detected.push(label);
    draw.rect({ canvas: canvases.cocossd, x, y, width, height, lineWidth: 4, color: 'rgba(125, 255, 255, 0.4)', title: label });
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
  if (!canvases.handpose) {
    canvases.handpose = document.createElement('canvas', { desynchronized: true });
    canvases.handpose.style.position = 'relative';
    canvases.handpose.id = 'canvas-handpose';
    canvases.handpose.style.position = 'absolute';
    canvases.handpose.style.top = 0;
    canvases.handpose.width = video.offsetWidth;
    canvases.handpose.height = video.offsetHeight;
    document.getElementById('drawcanvas').appendChild(canvases.handpose);
  }
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
      if (lines) draw.spline({ canvas: canvases.handpose, color: 'rgba(125, 255, 255, 0.2)', points, lineWidth: 10, tension: 0.5 });
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
  if (!canvases.faceapi) {
    canvases.faceapi = document.createElement('canvas', { desynchronized: true });
    canvases.faceapi.style.position = 'relative';
    canvases.faceapi.id = 'canvas-faceapi';
    canvases.faceapi.style.position = 'absolute';
    canvases.faceapi.style.top = 0;
    canvases.faceapi.width = video.offsetWidth;
    canvases.faceapi.height = video.offsetHeight;
    document.getElementById('drawcanvas').appendChild(canvases.faceapi);
  }
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
    if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(image, x, y, width, height, { title: 'faceapi' }));
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

function getCameraImage(video) {
  const t0 = performance.now();
  let matrix = video.style.transform.match(/[+-]?\d+(\.\d+)?/g);
  if (!matrix || matrix.length !== 6) matrix = [1.0, 1.0, 0, 0];
  else matrix = matrix.map((a) => parseFloat(a));

  const width = ((params.resolution && params.resolution.width > 0) ? params.resolution.width : video.videoWidth);
  const height = ((params.resolution && params.resolution.height > 0) ? params.resolution.height : video.videoHeight);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0 - matrix[4] / matrix[0], 0 - matrix[5] / matrix[3], video.videoWidth / matrix[0], video.videoHeight / matrix[3], 0, 0, canvas.width, canvas.height);

  if (!fxFilter) fxFilter = new fx.Canvas();
  else fxFilter.reset();
  fxFilter.addFilter('brightness', params.imageBrightness);
  fxFilter.addFilter('contrast', params.imageContrast);
  fxFilter.addFilter('sharpen', params.imageSharpness);
  fxFilter.addFilter('blur', params.imageBlur);
  fxFilter.addFilter('saturation', params.imageSaturation);
  fxFilter.addFilter('hue', params.imageHue);
  const filtered = fxFilter.apply(canvas);

  if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(canvas, 0, 0, canvas.width, canvas.height, { title: 'original' }));
  if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(filtered, 0, 0, filtered.width, filtered.height, { title: 'filtered' }));
  const t1 = performance.now();
  perf.Image = Math.trunc(t1 - t0);
  return filtered;
}

async function drawOverlay(image, video) {
  if (!canvases.process) {
    canvases.process = document.createElement('canvas', { desynchronized: true });
    canvases.process.id = 'canvas-process';
    canvases.process.width = video.offsetWidth;
    canvases.process.height = video.offsetHeight;
    canvases.process.style.position = 'absolute';
    canvases.process.style.top = 0;
    canvases.process.style.filter = 'opacity(0.5) grayscale(1)';
    document.getElementById('drawcanvas').appendChild(canvases.process);
  }
  canvases.process.getContext('2d').drawImage(image, 0, 0, canvases.process.width, canvases.process.height);
}

async function clearAll() {
  for (const canvas of Object.values(canvases)) {
    log.debug('Clear canvas', canvas);
    draw.clear(canvas);
  }
}

async function main() {
  const video = document.getElementById('videocanvas');
  if (video.paused || video.ended) {
    log.div('log', true, `Video status: paused:${video.paused} ended:${video.ended} ready:${video.readyState}`);
    return;
  }
  if (video.readyState > 2) {
    const t0 = performance.now();
    const promises = [];
    detected.length = 0;
    perf.Canvas = 0;

    const image = getCameraImage(video);

    if (perf.Frame === 0) {
      tf.setBackend('webgl');
      tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true);
      await tf.ready();
      await tf.enableProdMode();
      log.div('log', true, `Using TensorFlow/JS: ${tf.version_core} Backend: ${tf.getBackend().toUpperCase()}`);
      fps.length = 0;
    }

    if (document.getElementById('menu-overlay').checked) await drawOverlay(image, video);
    else draw.clear(canvases.process);

    if (document.getElementById('model-facemesh').checked) {
      if (params.async) promises.push(runFaceMesh(image, video));
      else promises.push(await runFaceMesh(image, video));
    } else draw.clear(canvases.facemesh);

    if (document.getElementById('model-posenet').checked) {
      if (params.async) promises.push(runPoseNet(image, video));
      else promises.push(await runPoseNet(image, video));
    } else draw.clear(canvases.posenet);

    if (document.getElementById('model-cocossd').checked) {
      if (params.async) promises.push(runCocoSSD(image, video));
      else promises.push(await runCocoSSD(image, video));
    } else draw.clear(canvases.cocossd);

    if (document.getElementById('model-handpose').checked) {
      if (params.async) promises.push(runHandPose(image, video));
      promises.push(await runHandPose(image, video));
    } else draw.clear(canvases.handpose);

    if (document.getElementById('model-faceapi').checked) {
      if (params.async) promises.push(runFaceApi(image, video));
      promises.push(await runFaceApi(image, video));
    } else draw.clear(canvases.faceapi);

    window.results = params.async ? await Promise.all(promises) : promises;

    const objects = document.getElementById('objects');
    objects.innerHTML = '';
    for (const object of extracted) objects.appendChild(object);
    extracted.length = 0;

    if (perf.Frame === 0) {
      const engine = await tf.engine();
      log.div('log', true, `TF State: ${engine.state.numBytes.toLocaleString()} bytes ${engine.state.numDataBuffers.toLocaleString()} buffers ${engine.state.numTensors.toLocaleString()} tensors`);
      log.div('log', true, `TF GPU Memory: used ${engine.backendInstance.numBytesInGPU.toLocaleString()} bytes free ${Math.floor(1000 * engine.backendInstance.numMBBeforeWarning).toLocaleString()} bytes`);
      // eslint-disable-next-line no-console
      log.debug('TF Flags:', engine.ENV.flags);
      // eslint-disable-next-line no-console
      log.debug('TF Models:', models);
      // eslint-disable-next-line no-console
      for (const result of results) log.debug('TF Results: ', result);
    }

    const gestures = await gesture.analyze(window.results);

    const t1 = performance.now();
    perf.Total = Math.trunc(t1 - t0);
    perf.Frame += 1;
    perf.Canvas = Math.round(perf.Canvas);
    fps.push(Math.round(10000 / (t1 - t0)) / 10);
    const avg = Math.round(10 * fps.reduce((a, b) => (a + b)) / fps.length) / 10;
    document.getElementById('status').innerText = `FPS: ${Math.round(10000 / (t1 - t0)) / 10} AVG: ${avg}`;
    document.getElementById('detected').innerText = `Detected: ${log.str([...detected, ...gestures])}`;
    document.getElementById('perf').innerText = document.getElementById('menu-log').checked ? `Performance: ${log.str(perf)}` : '';
  }
  requestAnimationFrame(main);
}

exports.main = main;
exports.clear = clearAll;
