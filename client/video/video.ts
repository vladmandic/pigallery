// css-imports used by esbuild
import '../pigallery.css';
import '../../assets/bootstrap.css';
import '../../assets/fontawesome.css';

import $ from 'jquery';
import { tf } from '../shared/tf';
// eslint-disable-next-line import/order
import Human from '@vladmandic/human/dist/human.esm-nobundle';
import panzoom from '../../assets/panzoom';
import * as log from '../shared/log';
import * as user from '../shared/user';
import * as run from './run';
import Menu from '../shared/menu';
import * as config from '../shared/config';

let perfMonitor;

// using window globals for debugging purposes
const menus:{ filters: null | Menu, params: null | Menu, model: null | Menu, perf: null | Menu } = { filters: null, params: null, model: null, perf: null };
const objects = { perf: { }, models: [], canvases: [], detected: [], menus };

async function updateDiv(name, text) {
  const div = document.getElementById(name);
  if (div) div.innerText = text;
}

async function cameraStart(play = true) {
  updateDiv('status', 'starting camera');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    updateDiv('status', 'no camera access');
    const div = document.getElementById('video-start');
    if (div) div.style.display = 'block';
    $('#btn-startstop').text('camera error');
    return;
  }
  const video = document.getElementById('video') as HTMLVideoElement;
  const constraints = {
    audio: false,
    video: { width: { ideal: window.innerWidth, max: 3840 }, height: { ideal: window.innerHeight, max: 3840 }, facingMode: config.default.facing ? 'user' : 'environment' },
  };
  // const devices = await navigator.mediaDevices.enumerateDevices();
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const track = stream.getVideoTracks()[0];
  if (track.getCapabilities && track.getCapabilities().resizeMode) await track.applyConstraints({ resizeMode: '0' });
  if (!video) return;
  video.srcObject = stream;
  updateDiv('status', 'ready');
  if (play) {
    panzoom(document.getElementById('video'), { zoomSpeed: 0.025, minZoom: 0.5, maxZoom: 2.0 });
    $('#btn-startstop').text('stop camera');
    // catch block for overlapping events
    video.play().then((res) => res).catch((err) => err);
  }
}

async function cameraStop() {
  updateDiv('status', 'paused');
  if (perfMonitor) clearInterval(perfMonitor);
  const video = document.getElementById('video') as HTMLVideoElement;
  video.pause();
  const tracks = video.srcObject ? (video.srcObject as MediaStream).getTracks() : null;
  if (tracks) tracks.forEach((track) => track.stop());
  $('#btn-startstop').text('start camera');
}

let resizeTimer;
async function cameraResize() {
  updateDiv('status', 'resizing');
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(async () => {
    const video = document.getElementById('video') as HTMLVideoElement;
    const live = !video.paused && (video.srcObject ? ((video.srcObject as MediaStream).getVideoTracks()[0].readyState === 'live') : false);
    log.div('div', true, `Resize display: ${video.offsetWidth} x ${video.offsetHeight}`);
    await cameraStop();
    run.clear(objects.canvases);
    updateDiv('canvases', '');
    cameraStart(live);
  }, 200);
}

async function cameraRestart() {
  const video = document.getElementById('video') as HTMLVideoElement;
  const live = !video.paused && (video.srcObject ? ((video.srcObject as MediaStream).getVideoTracks()[0].readyState === 'live') : false);
  const div = document.getElementById('video-start');
  if (div) div.style.display = live ? 'block' : 'none';
  if (!live) await cameraStart();
  else await cameraStop();
}

async function cameraSetup() {
  const video = document.getElementById('video') as HTMLVideoElement;
  video.addEventListener('loadeddata', (event) => {
    const track = (video.srcObject as MediaStream).getVideoTracks()[0];
    const settings = (video.srcObject as MediaStream).getVideoTracks()[0].getSettings();
    log.div('div', true, `Start video: ${track.label} camera ${settings.width} x ${settings.height} display ${video.offsetWidth} x ${video.offsetHeight} facing ${settings.facingMode}`);
    log.debug('Camera Settings: ', settings);
    event.stopPropagation();
    run.main(config.default, objects);
    // document.getElementById('status').innerText = 'loading model: Human ...';
  }, true);
}

function initHumanConfig() {
  const myConfig = {
    modelBasePath: '',
    face: {
      enabled: false,
      detector: { modelPath: '@vladmandic/human/models/blazeface-back.json' },
      mesh: { modelPath: '@vladmandic/human/models/facemesh.json' },
      iris: { modelPath: '@vladmandic/human/models/iris.json' },
      description: { modelPath: '@vladmandic/human/models/faceres.json' },
      emotion: { modelPath: '@vladmandic/human/models/emotion.json' },
    },
    body: {
      enabled: false,
      modelPath: '@vladmandic/human/models/posenet.json',
    },
    hand: {
      enabled: false,
      detector: { modelPath: '@vladmandic/human/models/handdetect.json' },
      skeleton: { modelPath: '@vladmandic/human/models/handskeleton.json' },
    },
    gesture: {
      enabled: true,
    },
  };
  const human = new Human(myConfig);
  config.default.human = JSON.parse(JSON.stringify(human.config));
}

async function menuSetup() {
  if (config.default.models.initial) {
    const req = await fetch('/api/models/get');
    if (req && req.ok) config.default.models = await req.json();
  }
  initHumanConfig();

  const top = `${(document.getElementById('navbar')?.offsetHeight || 0) - 3}px`;
  const x = [
    `${document.getElementById('menu-models')?.offsetLeft || 0}px`,
    `${document.getElementById('menu-parameters')?.offsetLeft || 0}px`,
    `${document.getElementById('menu-filters')?.offsetLeft || 0}px`,
    `${document.getElementById('menu-performance')?.offsetLeft || 0}px`,
  ];

  objects.menus.model = new Menu(document.body, '', { top, left: x[0] });
  objects.menus.model.addLabel('Human Detection');
  // objects.menus.model.addBool('Human Detection', config.default.human, 'enabled');
  objects.menus.model.addBool('Face Detect', config.default.human.face, 'enabled');
  objects.menus.model.addBool('Face Mesh', config.default.human.face.mesh, 'enabled');
  objects.menus.model.addBool('Face Iris', config.default.human.face.iris, 'enabled');
  objects.menus.model.addBool('Face Description', config.default.human.face.description, 'enabled');
  objects.menus.model.addBool('Face Emotion', config.default.human.face.emotion, 'enabled');
  objects.menus.model.addBool('Body Pose', config.default.human.body, 'enabled');
  objects.menus.model.addBool('Hand Pose', config.default.human.hand, 'enabled');

  objects.menus.model.addLabel('Object Detection');
  for (const m of config.default.models.detect) objects.menus.model.addBool(m.name, config.default.detect, m.name);
  objects.menus.model.addLabel('Image Classification');
  for (const m of config.default.models.classify) objects.menus.model.addBool(m.name, config.default.classify, m.name);
  for (const m of config.default.models.various) objects.menus.model.addBool(m.name, config.default.classify, m.name);

  objects.menus.model.toggle();

  objects.menus.params = new Menu(document.body, '', { top, left: x[1] });
  objects.menus.params.addLabel('Model parameters');
  objects.menus.params.addBool('WebGL Memory Limit', config.default, 'memory', (val) => {
    log.debug('Setting WebGL:  Memory Limit:', config.default.memory);
    tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', val ? 0 : -1);
  });
  objects.menus.params.addRange('Max Objects', config.default.human.face.detector, 'maxFaces', 0, 50, 1, (val) => {
    config.default.human.face.detector.maxFaces = parseInt(val);
    config.default.human.body.maxDetections = parseInt(val);
    config.default.human.hand.maxHands = parseInt(val);
    config.default.detect.maxObjects = parseInt(val);
  });
  objects.menus.params.addRange('Skip Frames', config.default.human.face.detector, 'skipFrames', 0, 50, 1, (val) => {
    config.default.human.face.detector.skipFrames = parseInt(val);
    config.default.human.face.emotion.skipFrames = parseInt(val);
    config.default.human.face.age.skipFrames = parseInt(val);
    config.default.human.hand.skipFrames = parseInt(val);
  });
  objects.menus.params.addRange('Min Confidence', config.default.human.face.detector, 'minConfidence', 0.0, 1.0, 0.05, (val) => {
    config.default.human.face.detector.minConfidence = parseFloat(val);
    config.default.human.face.emotion.minConfidence = parseFloat(val);
    config.default.human.hand.minConfidence = parseFloat(val);
  });
  objects.menus.params.addRange('Score Threshold', config.default.human.face.detector, 'scoreThreshold', 0.1, 1.0, 0.05, (val) => {
    config.default.human.face.detector.scoreThreshold = parseFloat(val);
    config.default.human.hand.scoreThreshold = parseFloat(val);
    config.default.human.body.scoreThreshold = parseFloat(val);
    config.default.detect.minThreshold = parseFloat(val);
    config.default.classify.minThreshold = parseFloat(val);
  });
  objects.menus.params.addRange('IOU Threshold', config.default.human.face.detector, 'iouThreshold', 0.1, 1.0, 0.05, (val) => {
    config.default.human.face.detector.iouThreshold = parseFloat(val);
    config.default.human.hand.iouThreshold = parseFloat(val);
  });
  objects.menus.params.addHTML('<hr style="min-width: 200px; border-style: inset; border-color: dimgray">');
  objects.menus.params.addLabel('Display options');
  objects.menus.params.addRange('Scale Resolution', config.default.ui, 'scale', 10, 100, 5);
  objects.menus.params.addBool('Show Text', config.default.ui, 'text');
  objects.menus.params.addBool('Use 3D Depth', config.default.ui, 'useDepth');
  objects.menus.params.addBool('Hide Overlay', config.default.ui, 'overlay');
  objects.menus.params.addBool('Draw Boxes', config.default.ui, 'drawBoxes');
  objects.menus.params.addBool('Draw Points', config.default.ui, 'drawPoints');
  objects.menus.params.addBool('Draw Polygons', config.default.ui, 'drawPolygons');
  objects.menus.params.addBool('Fill Polygons', config.default.ui, 'fillPolygons');
  objects.menus.params.toggle();

  objects.menus.filters = new Menu(document.body, '', { top, left: x[2] });
  objects.menus.filters.addRange('Brightness', config.default.human.filter, 'brightness', -1.0, 1.0, 0.05, (val) => { config.default.human.filter.brightness = parseFloat(val); });
  objects.menus.filters.addRange('Contrast', config.default.human.filter, 'contrast', -1.0, 1.0, 0.05, (val) => { config.default.human.filter.contrast = parseFloat(val); });
  objects.menus.filters.addRange('Sharpness', config.default.human.filter, 'sharpness', 0, 1.0, 0.05, (val) => { config.default.human.filter.sharpness = parseFloat(val); });
  objects.menus.filters.addRange('Blur', config.default.human.filter, 'blur', 0, 20, 1, (val) => { config.default.human.filter.blur = parseInt(val); });
  objects.menus.filters.addRange('Saturation', config.default.human.filter, 'saturation', -1.0, 1.0, 0.05, (val) => { config.default.human.filter.saturation = parseFloat(val); });
  objects.menus.filters.addRange('Hue', config.default.human.filter, 'hue', 0, 360, 5, (val) => { config.default.human.filter.hue = parseInt(val); });
  objects.menus.filters.addRange('Pixelate', config.default.human.filter, 'pixelate', 0, 32, 1, (val) => { config.default.human.filter.pixelate = parseInt(val); });
  objects.menus.filters.addBool('negative', config.default.human.filter, 'negative');
  objects.menus.filters.addBool('sepia', config.default.human.filter, 'sepia');
  objects.menus.filters.addBool('vintage', config.default.human.filter, 'vintage');
  objects.menus.filters.addBool('kodachrome', config.default.human.filter, 'kodachrome');
  objects.menus.filters.addBool('technicolor', config.default.human.filter, 'technicolor');
  objects.menus.filters.addBool('polaroid', config.default.human.filter, 'polaroid');
  objects.menus.filters.toggle();

  objects.menus.perf = new Menu(document.body, '', { top, left: x[3] });
  objects.menus.perf.toggle();
  objects.menus.perf.addChart('FPS', 'FPS', 200, 40, 'lightblue');

  const click = ('ontouchstart' in window) ? 'touchstart' : 'click';
  document.addEventListener(click, (evt) => {
    // if (evt.target.id !== 'menu-models') objects.menus.model.hide();
    // if (evt.target.id !== 'menu-parameters') objects.menus.params.hide();
    // if (evt.target.id !== 'menu-filters') objects.menus.filters.hide();
    switch ((evt.target as HTMLElement)?.id) {
      case 'video-start': cameraRestart(); break;
      case 'menu-startstop': cameraRestart(); break;
      case 'menu-facing': config.default.facing = !config.default.facing; cameraRestart(); break;
      case 'menu-models': objects.menus.model?.toggle(); break;
      case 'menu-parameters': objects.menus.params?.toggle(); break;
      case 'menu-filters': objects.menus.filters?.toggle(); break;
      case 'menu-performance': objects.menus.perf?.toggle(); break;
      default:
    }
  });
}

async function main() {
  log.debug(location.href);
  await user.get();
  await config.setTheme();
  await config.done();
  await menuSetup();
  await cameraSetup();
  await run.init(config.default);
}

window.onload = main;
window.onresize = cameraResize;
