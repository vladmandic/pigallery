// @ts-nocheck

import $ from 'jquery';
import { tf } from '../shared/tf.js';
import panzoom from '../../assets/panzoom.js';
import * as log from '../shared/log.js';
import * as user from '../shared/user.js';
import * as run from './run.js';
import Menu from '../shared/menu.js';
import * as shared from '../shared/config.js';

const config = shared.default;
let perfMonitor;

// using window globals for debugging purposes
const objects = { perf: { }, models: [], canvases: [], detected: [], menus: {} };

async function cameraStart(play = true) {
  document.getElementById('status').innerText = 'starting camera';
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.getElementById('status').innerHTML = 'no camera access';
    document.getElementById('video-start').style.display = 'block';
    document.getElementById('video-start').classList.remove('fa-play-circle');
    document.getElementById('video-start').classList.add('fa-times-circle');
    return;
  }
  const video = document.getElementById('video');
  const constraints = {
    audio: false,
    video: { width: { ideal: window.innerWidth, max: 3840 }, height: { ideal: window.innerHeight, max: 3840 }, facingMode: config.facing ? 'user' : 'environment' },
  };
  // const devices = await navigator.mediaDevices.enumerateDevices();
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const track = stream.getVideoTracks()[0];
  if (track.getCapabilities && track.getCapabilities().resizeMode) await track.applyConstraints({ resizeMode: '0' });
  video.srcObject = stream;
  if (play) {
    panzoom(document.getElementById('video'), { zoomSpeed: 0.025, minZoom: 0.5, maxZoom: 2.0 });
    document.getElementById('menu-startstop').classList.remove('fa-play-circle');
    document.getElementById('menu-startstop').classList.add('fa-pause-circle');
    $('#btn-startstop').text('stop');
    // catch block for overlapping events
    video.play().then(() => {}).catch(() => {});
  }
}

async function cameraStop() {
  document.getElementById('status').innerText = 'paused';
  if (perfMonitor) clearInterval(perfMonitor);
  const video = document.getElementById('video');
  video.pause();
  const tracks = video.srcObject ? video.srcObject.getTracks() : null;
  if (tracks) tracks.forEach((track) => track.stop());
  document.getElementById('menu-startstop').classList.remove('fa-pause-circle');
  document.getElementById('menu-startstop').classList.add('fa-play-circle');
  $('#btn-startstop').text('play');
}

let resizeTimer;
async function cameraResize() {
  document.getElementById('status').innerText = 'resizing';
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(async () => {
    const video = document.getElementById('video');
    const live = !video.paused && (video.srcObject ? (video.srcObject.getVideoTracks()[0].readyState === 'live') : false);
    log.div('div', true, `Resize display: ${video.offsetWidth} x ${video.offsetHeight}`);
    await cameraStop();
    run.clear(objects.canvases);
    document.getElementById('canvases').innerHTML = '';
    cameraStart(live);
  }, 200);
}

async function cameraRestart() {
  const video = document.getElementById('video');
  const live = !video.paused && (video.srcObject ? (video.srcObject.getVideoTracks()[0].readyState === 'live') : false);
  document.getElementById('video-start').style.display = live ? 'block' : 'none';
  if (!live) await cameraStart();
  else await cameraStop();
}

async function cameraSetup() {
  const video = document.getElementById('video');
  video.addEventListener('loadeddata', (event) => {
    const track = video.srcObject.getVideoTracks()[0];
    const settings = video.srcObject.getVideoTracks()[0].getSettings();
    log.div('div', true, `Start video: ${track.label} camera ${settings.width} x ${settings.height} display ${video.offsetWidth} x ${video.offsetHeight} facing ${settings.facingMode}`);
    log.debug('Camera Settings: ', settings);
    event.stopPropagation();
    run.main(config, objects);
    document.getElementById('status').innerText = 'loading model: Human ...';
  }, true);
}

async function menuSetup() {
  objects.menus.model = new Menu(document.body, '', null, { background: 'var(--body)' });
  objects.menus.model.addLabel('Human Detection');
  objects.menus.model.addBool('Human Detection', config.human, 'enabled');
  objects.menus.model.addBool('Face Detect', config.human.face, 'enabled');
  objects.menus.model.addBool('Face Mesh', config.human.face.mesh, 'enabled');
  objects.menus.model.addBool('Face Iris', config.human.face.iris, 'enabled');
  objects.menus.model.addBool('Face Age', config.human.face.age, 'enabled');
  objects.menus.model.addBool('Face Gender', config.human.face.gender, 'enabled');
  objects.menus.model.addBool('Face Emotion', config.human.face.emotion, 'enabled');
  objects.menus.model.addBool('Body Pose', config.human.body, 'enabled');
  objects.menus.model.addBool('Hand Pose', config.human.hand, 'enabled');

  objects.menus.model.addLabel('Object Detection');
  for (const m of config.models.detect) objects.menus.model.addBool(m.name, config.detect, m.name);
  objects.menus.model.addLabel('Image Classification');
  for (const m of config.models.classify) objects.menus.model.addBool(m.name, config.classify, m.name);
  for (const m of config.models.various) objects.menus.model.addBool(m.name, config.classify, m.name);

  objects.menus.model.toggle();

  objects.menus.params = new Menu(document.body, '');
  objects.menus.params.addLabel('Model parameters');
  objects.menus.params.addBool('WebGL Memory Limit', config, 'memory', (val) => {
    log.debug('Changing WebGL: WEBGL_DELETE_TEXTURE_THRESHOLD:', val);
    tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', val ? 0 : -1);
  });
  objects.menus.params.addRange('Max Objects', config.human.face.detector, 'maxFaces', 0, 50, 1, (val) => {
    config.human.face.detector.maxFaces = parseInt(val);
    config.human.body.maxDetections = parseInt(val);
    config.human.hand.maxHands = parseInt(val);
    config.detect.maxObjects = parseInt(val);
  });
  objects.menus.params.addRange('Skip Frames', config.human.face.detector, 'skipFrames', 0, 50, 1, (val) => {
    config.human.face.detector.skipFrames = parseInt(val);
    config.human.face.emotion.skipFrames = parseInt(val);
    config.human.face.age.skipFrames = parseInt(val);
    config.human.hand.skipFrames = parseInt(val);
  });
  objects.menus.params.addRange('Min Confidence', config.human.face.detector, 'minConfidence', 0.0, 1.0, 0.05, (val) => {
    config.human.face.detector.minConfidence = parseFloat(val);
    config.human.face.emotion.minConfidence = parseFloat(val);
    config.human.hand.minConfidence = parseFloat(val);
  });
  objects.menus.params.addRange('Score Threshold', config.human.face.detector, 'scoreThreshold', 0.1, 1.0, 0.05, (val) => {
    config.human.face.detector.scoreThreshold = parseFloat(val);
    config.human.hand.scoreThreshold = parseFloat(val);
    config.human.body.scoreThreshold = parseFloat(val);
    config.detect.minThreshold = parseFloat(val);
    config.classify.minThreshold = parseFloat(val);
  });
  objects.menus.params.addRange('IOU Threshold', config.human.face.detector, 'iouThreshold', 0.1, 1.0, 0.05, (val) => {
    config.human.face.detector.iouThreshold = parseFloat(val);
    config.human.hand.iouThreshold = parseFloat(val);
  });
  objects.menus.params.addHTML('<hr style="min-width: 200px; border-style: inset; border-color: dimgray">');
  objects.menus.params.addLabel('Display options');
  objects.menus.params.addRange('Scale Resolution', config.ui, 'scale', 10, 100, 5);
  objects.menus.params.addBool('Show Text', config.ui, 'text');
  objects.menus.params.addBool('Use 3D Depth', config.ui, 'useDepth');
  objects.menus.params.addBool('Hide Overlay', config.ui, 'overlay');
  objects.menus.params.addBool('Draw Boxes', config.ui, 'drawBoxes');
  objects.menus.params.addBool('Draw Points', config.ui, 'drawPoints');
  objects.menus.params.addBool('Draw Polygons', config.ui, 'drawPolygons');
  objects.menus.params.addBool('Fill Polygons', config.ui, 'fillPolygons');
  objects.menus.params.toggle();

  objects.menus.filters = new Menu(document.body, '');
  objects.menus.filters.addRange('Brightness', config.human.filter, 'brightness', -1.0, 1.0, 0.05, (val) => config.human.filter.brightness = parseFloat(val));
  objects.menus.filters.addRange('Contrast', config.human.filter, 'contrast', -1.0, 1.0, 0.05, (val) => config.human.filter.contrast = parseFloat(val));
  objects.menus.filters.addRange('Sharpness', config.human.filter, 'sharpness', 0, 1.0, 0.05, (val) => config.human.filter.sharpness = parseFloat(val));
  objects.menus.filters.addRange('Blur', config.human.filter, 'blur', 0, 20, 1, (val) => config.human.filter.blur = parseInt(val));
  objects.menus.filters.addRange('Saturation', config.human.filter, 'saturation', -1.0, 1.0, 0.05, (val) => config.human.filter.saturation = parseFloat(val));
  objects.menus.filters.addRange('Hue', config.human.filter, 'hue', 0, 360, 5, (val) => config.human.filter.hue = parseInt(val));
  objects.menus.filters.addRange('Pixelate', config.human.filter, 'pixelate', 0, 32, 1, (val) => config.human.filter.pixelate = parseInt(val));
  objects.menus.filters.addBool('negative', config.human.filter, 'negative');
  objects.menus.filters.addBool('sepia', config.human.filter, 'sepia');
  objects.menus.filters.addBool('vintage', config.human.filter, 'vintage');
  objects.menus.filters.addBool('kodachrome', config.human.filter, 'kodachrome');
  objects.menus.filters.addBool('technicolor', config.human.filter, 'technicolor');
  objects.menus.filters.addBool('polaroid', config.human.filter, 'polaroid');
  objects.menus.filters.toggle();

  objects.menus.perf = new Menu(document.body, '');
  objects.menus.perf.toggle();
  objects.menus.perf.addChart('FPS', 'FPS', 200, 40, 'lightblue', 'rgb(100, 100, 100)');

  const click = ('ontouchstart' in window) ? 'touchstart' : 'click';
  document.addEventListener(click, (evt) => {
    // if (evt.target.id !== 'menu-models') objects.menus.model.hide();
    // if (evt.target.id !== 'menu-parameters') objects.menus.params.hide();
    // if (evt.target.id !== 'menu-filters') objects.menus.filters.hide();
    switch (evt.target.id) {
      case 'video-start': cameraRestart(); break;
      case 'menu-startstop': cameraRestart(); break;
      case 'menu-facing': config.facing = !config.facing; cameraRestart(); break;
      case 'menu-models': objects.menus.model.toggle(evt); break;
      case 'menu-parameters': objects.menus.params.toggle(evt); break;
      case 'menu-filters': objects.menus.filters.toggle(evt); break;
      case 'menu-performance': objects.menus.perf.toggle(evt); break;
      default:
    }
  });
}

// eslint-disable-next-line no-unused-vars
async function xhrFetch(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }));
    xhr.onerror = (err) => reject(new TypeError(err));
    xhr.open('GET', url);
    xhr.send(null);
  });
}

async function main() {
  log.debug(window.location.href);
  await user.get();
  await shared.theme();
  await shared.done();
  await menuSetup();
  await cameraSetup();
  await run.init(config);
}

window.onload = main;
window.onresize = cameraResize;
