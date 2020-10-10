/* global models, canvases, perf, params, extracted, detected */

import * as tf from '@tensorflow/tfjs';
import piface from '@vladmandic/piface';
import * as cocossd from '@tensorflow-models/coco-ssd/dist/coco-ssd.es2017.js';
import * as log from '../shared/log.js';
import * as draw from './draw.js';
import * as modelClassify from '../process/modelClassify.js';
import * as definitions from '../shared/models.js';

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

async function runPiFace(image, video) {
  // https://github.com/@vladmandic/piface
  const t0 = performance.now();
  if (video.paused || video.ended) return {};
  if (!canvases.piface) appendCanvas('piface', video.offsetWidth, video.offsetHeight);
  const config = {
    face: {
      enabled: document.getElementById('model-face').checked,
      minConfidence: parseFloat(document.getElementById('menu-confidence').value),
      iouThreshold: parseFloat(document.getElementById('menu-overlap').value),
      scoreThreshold: parseFloat(document.getElementById('menu-threshold').value),
      detector: {
        maxFaces: parseInt(document.getElementById('menu-objects').value),
        skipFrames: parseInt(document.getElementById('menu-skip').value),
      },
      mesh: {
        enabled: document.getElementById('model-mesh').checked,
      },
      iris: {
        enabled: document.getElementById('model-iris').checked,
      },
      age: {
        enabled: document.getElementById('model-agegender').checked,
        skipFrames: parseInt(document.getElementById('menu-skip').value),
      },
      gender: {
        enabled: document.getElementById('model-agegender').checked,
      },
    },
    body: {
      enabled: document.getElementById('model-posenet').checked,
      maxDetections: parseInt(document.getElementById('menu-objects').value),
      scoreThreshold: parseFloat(document.getElementById('menu-threshold').value),
      nmsRadius: 20,
    },
    hand: {
      enabled: document.getElementById('model-handpose').checked,
      skipFrames: parseInt(document.getElementById('menu-skip').value),
      minConfidence: parseFloat(document.getElementById('menu-confidence').value),
      iouThreshold: parseFloat(document.getElementById('menu-overlap').value),
      scoreThreshold: parseFloat(document.getElementById('menu-threshold').value),
    },
  };
  const res = await piface.detect(image, config);
  const t1 = performance.now();
  perf.piface = Math.trunc(t1 - t0);
  if ((perf.Frame === 0) || !canvases.piface) return { piface: res };

  canvases.piface.getContext('2d').clearRect(0, 0, canvases.piface.width, canvases.piface.height);

  // conditionals
  const show = {
    labels: document.getElementById('menu-labels').checked,
    boxes: document.getElementById('menu-boxes').checked,
    mesh: document.getElementById('model-mesh').checked,
    lines: document.getElementById('menu-lines').checked,
    highlight: document.getElementById('menu-points').checked,
    grid: document.getElementById('menu-grid').checked,
  };

  // draw face elements
  for (const face of res.face) {
    const x = face.box[0];
    const y = face.box[1];
    const width = face.box[2];
    const height = face.box[3];
    // add face thumbnails
    if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(image, x, y, width, height, { title: 'face' }));
    let label = 'face';
    if (face.age && face.gender) label += ` ${face.gender} age: ${face.age}`;
    if (face.iris && (face.iris > 0)) label += ` iris: ${face.iris}`;
    detected.push(label);
    // draw border around detected faces
    if (show.boxes) {
      draw.rect({
        canvas: canvases.piface,
        x: x * canvases.piface.width / image.width,
        y: y * canvases.piface.height / image.height,
        width: width * canvases.piface.width / image.width,
        height: height * canvases.piface.height / image.height,
        lineWidth: 4,
        color: 'rgba(125, 255, 255, 0.4)',
        title: label,
      });
    }
    if (show.mesh && face.mesh && face.mesh.length > 0) {
      const z = face.mesh.map((a) => a[2]);
      const zfact = 255 / (Math.max(...z) - Math.min(...z) + 1); // get the range for colors
      // draw face lines
      if (show.grid) {
        const ctx = canvases.piface.getContext('2d');
        for (let i = 0; i < piface.triangulation.length / 3; i++) {
          const points = [
            piface.triangulation[i * 3 + 0],
            piface.triangulation[i * 3 + 1],
            piface.triangulation[i * 3 + 2],
          ].map((index) => face.mesh[index]);
          const path = new Path2D();
          path.moveTo(points[0][0] * canvases.piface.width / image.width, points[0][1] * canvases.piface.height / image.height);
          for (const point of points) {
            path.lineTo(point[0] * canvases.piface.width / image.width, point[1] * canvases.piface.height / image.height);
          }
          path.closePath();
          ctx.fillStyle = `rgba(${127.5 + (zfact * points[0][2])}, ${127.5 - (zfact * points[0][2])}, 255, 0.5)`;
          ctx.strokeStyle = `rgba(${127.5 + (zfact * points[0][2])}, ${127.5 - (zfact * points[0][2])}, 255, 0.5)`;
          ctx.stroke(path);
          if (document.getElementById('menu-fill').checked) ctx.fill(path);
        }
      } else if (document.getElementById('menu-mesh').checked) {
      // draw all face points
        for (const point of face.mesh) {
          draw.point({
            canvas: canvases.piface,
            x: point[0] * canvases.piface.width / image.width,
            y: point[1] * canvases.piface.height / image.height,
            color: `rgba(${127.5 + (zfact * point[2])}, ${127.5 - (zfact * point[2])}, 255, 0.5)`,
            blue: 255,
            radius: 1,
          });
        }
      }
      // draw & label key face points
      if (show.labels) {
        for (const [key, val] of Object.entries(face.annotations)) {
          for (const point in val) {
            draw.point({
              canvas: canvases.piface,
              x: val[point][0] * canvases.piface.width / image.width,
              y: val[point][1] * canvases.piface.height / image.height,
              color: `rgba(${127.5 + (zfact * val[point][2])}, ${127.5 - (zfact * val[point][2])}, 255, 0.5)`,
              radius: 2,
              alpha: 0.5,
              title: (point >= val.length - 1) ? key : null,
            });
          }
        }
      }
    }
  }

  // draw body elements
  for (const pose in res.body) {
    for (const point of res.body[pose].keypoints) {
      if (point.score > params.minThreshold) {
        const label = `${(100 * point.score).toFixed(1)} ${point.part}`;
        // detected.push(label);
        if (show.highlight) {
          draw.point({
            canvas: canvases.piface,
            x: point.position.x * canvases.piface.width / image.width,
            y: point.position.y * canvases.piface.height / image.height,
            color: 'rgba(0, 200, 255, 0.5)',
            radius: 4,
            title: show.labels ? label : null,
          });
        }
      }
    }
    if (show.lines) {
      const points = [];
      const line = [];
      points.length = 0;
      line.length = 0;
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftShoulder'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftElbow'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftWrist'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.piface.width / image.width, point.position.y * canvases.piface.height / image.height]);
      }
      draw.spline({ canvas: canvases.piface, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
      points.length = 0;
      line.length = 0;
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightShoulder'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightElbow'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightWrist'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.piface.width / image.width, point.position.y * canvases.piface.height / image.height]);
      }
      draw.spline({ canvas: canvases.piface, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
      points.length = 0;
      line.length = 0;
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftHip'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftShoulder'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightShoulder'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightHip'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftHip'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightHip'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.piface.width / image.width, point.position.y * canvases.piface.height / image.height]);
      }
      draw.spline({ canvas: canvases.piface, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
      points.length = 0;
      line.length = 0;
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftShoulder'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftHip'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftKnee'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'leftAnkle'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.piface.width / image.width, point.position.y * canvases.piface.height / image.height]);
      }
      draw.spline({ canvas: canvases.piface, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
      points.length = 0;
      line.length = 0;
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightShoulder'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightHip'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightKnee'));
      points.push(res.body[pose].keypoints.find((a) => a.part === 'rightAnkle'));
      for (const point of points) {
        if (point && point.score > params.minThreshold) line.push([point.position.x * canvases.piface.width / image.width, point.position.y * canvases.piface.height / image.height]);
      }
      draw.spline({ canvas: canvases.piface, points: line, lineWidth: 10, color: 'rgba(125, 255, 255, 0.2)', tension: params.lineTension });
    }
  }

  // draw hand elements
  for (const hand of res.hand) {
    const x = hand.box[0];
    const y = hand.box[1];
    const width = hand.box[2];
    const height = hand.box[3];
    if (document.getElementById('menu-extract').checked) extracted.push(draw.crop(image, x, y, width, height, { title: 'hand' }));
    // hand bounding box
    const label = `${(100 * hand.confidence).toFixed(1)}% hand`;
    detected.push(label);
    if (show.boxes) {
      draw.rect({
        canvas: canvases.piface,
        x: x * canvases.piface.width / image.width,
        y: y * canvases.piface.height / image.height,
        width: width * canvases.piface.width / image.width,
        height: height * canvases.piface.height / image.height,
        lineWidth: 4,
        color: 'rgba(125, 255, 255, 0.4)',
        title: label,
      });
    }
    const points = [];
    for (const [key, val] of Object.entries(hand.annotations)) {
      points.length = 0;
      for (const point in val) points.push([val[point][0] * canvases.piface.width / image.width, val[point][1] * canvases.piface.height / image.height, val[point][2]]);
      points.reverse();
      // draw connected line between finger points
      if (show.lines) {
        draw.spline({
          canvas: canvases.piface,
          color: 'rgba(125, 255, 255, 0.2)',
          points,
          lineWidth: 10,
          tension: params.lineTension,
        });
      }
      // draw all finger hand points
      if (show.highlight) {
        for (let point = 0; point < points.length; point++) {
          draw.point({
            canvas: canvases.piface,
            x: points[point][0],
            y: points[point][1],
            color: `rgba(${125 + 4 * points[point][2]}, ${125 - 4 * points[point][2]}, 255, 0.5)`,
            radius: 3,
            title: (show.labels && (point === 0)) ? key : null,
          });
        }
      }
    }
  }

  return { piface: res };
}

async function runCocoSSD(image, video) {
  // https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd
  const t0 = performance.now();
  if (!models.cocossd && !(video.paused || video.ended)) {
    perf.Frame = 0;
    document.getElementById('status').innerHTML = 'Loading models ...';
    const memory0 = await tf.memory();
    models.cocossd = await cocossd.load({ base: document.getElementById('menu-complex').checked ? 'mobilenet_v2' : 'lite_mobilenet_v2' });
    const memory1 = await tf.memory();
    log.div('log', true, `Loaded model CocoSSD: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!models.cocossd) {
    log.div('log', true, 'Model CocoSSD not loaded');
    return {};
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
  return { cocossd: objects };
}

async function runClassify(name, image, video) {
  const t0 = performance.now();
  if (!models[name] && !(video.paused || video.ended)) {
    perf.Frame = 0;
    document.getElementById('status').innerHTML = 'Loading models ...';
    const memory0 = await tf.memory();
    const opt = definitions.models.video[name];
    opt.score = params.minThreshold;
    $('#video-status').text(`Loading ${name} model ...`);
    models[name] = await modelClassify.load(opt);
    const memory1 = await tf.memory();
    log.div('log', true, `Loaded model ${name}: ${(memory1.numBytes - memory0.numBytes).toLocaleString()} bytes ${(memory1.numTensors - memory0.numTensors).toLocaleString()} tensors`);
  }
  if (!models[name]) {
    log.div('log', true, `Model ${name} not loaded`);
    return {};
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

// exports.facemesh = runFaceMesh;
exports.cocossd = runCocoSSD;
exports.piface = runPiFace;
exports.food = runFood;
exports.plants = runPlants;
exports.birds = runBirds;
exports.insects = runInsects;
exports.nsfw = runNSFW;
exports.imagenet = runImageNet;
exports.deepdetect = runDeepDetect;
