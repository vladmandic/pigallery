import jQuery from 'jquery';
import panzoom from '../../assets/panzoom.js';
import * as log from '../shared/log.js';
import * as user from '../shared/user.js';
import * as detect from './detect.js';
import Menu from './menu.js';
import shared from '../shared/config.js';

const config = shared.default;
let perfMonitor;
let menuPerf;
const fps = [];

// using window globals for debugging purposes
const objects = { perf: { }, models: [], canvases: [], detected: [] };

async function updatePerf() {
  if (objects.perf.Total) fps.push(1000 / objects.perf.Total);
  if (fps.length > config.ui.maxFrames) fps.shift();
  if (menuPerf.visible) {
    if (menuPerf) menuPerf.updateChart('FPS', fps);
    for (const key of Object.keys(objects.perf)) menuPerf.updateValue(key, objects.perf[key], 'ms');
  }
}

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
  if (track.getCapabilities && track.getCapabilities().resizeMode) await track.applyConstraints({ resizeMode: 0 });
  video.srcObject = stream;
  if (play) {
    panzoom(document.getElementById('video'), { zoomSpeed: 0.025, minZoom: 0.5, maxZoom: 2.0 });
    document.getElementById('menu-startstop').classList.remove('fa-play-circle');
    document.getElementById('menu-startstop').classList.add('fa-pause-circle');
    $('#btn-startstop').text('stop');
    // catch block for overlapping events
    video.play().then(() => {}).catch(() => {});
    perfMonitor = setInterval(updatePerf, 250);
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
    detect.clear(objects.canvases);
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
    detect.init(config);
    detect.main(config, objects);
  }, true);
}

async function menuSetup() {
  const menuModels = new Menu(document.body, '');
  menuModels.addLabel('Human Detection');
  menuModels.addBool('Face Detect', config.human.face, 'enabled');
  menuModels.addBool('Face Mesh', config.human.face.mesh, 'enabled');
  menuModels.addBool('Face Iris', config.human.face.iris, 'enabled');
  menuModels.addBool('Face Age', config.human.face.age, 'enabled');
  menuModels.addBool('Face Gender', config.human.face.gender, 'enabled');
  menuModels.addBool('Face Emotion', config.human.face.emotion, 'enabled');
  menuModels.addBool('Body Pose', config.human.body, 'enabled');
  menuModels.addBool('Hand Pose', config.human.hand, 'enabled');

  menuModels.addLabel('Object Detection');
  menuModels.addBool('COCO Objects', config.detect, 'coco');

  menuModels.addLabel('Image Detection');
  menuModels.addBool('ImageNet', config.classify, 'imagenet');
  menuModels.addBool('DeepDetect', config.classify, 'deepdetect');
  menuModels.addBool('NSFW Detect', config.classify, 'nsfw');
  menuModels.addBool('Food Items', config.classify, 'food');
  menuModels.addBool('Nature: Plants', config.classify, 'plants');
  menuModels.addBool('Nature: Birds', config.classify, 'birds');
  menuModels.addBool('Nature: Insects', config.classify, 'insects');
  menuModels.toggle();

  const menuParams = new Menu(document.body, '');
  menuParams.addRange('Max Objects', config.human.face.detector, 'maxFaces', 0, 50, 1, (val) => {
    config.human.face.detector.maxFaces = parseInt(val);
    config.human.body.maxDetections = parseInt(val);
    config.human.hand.maxHands = parseInt(val);
    config.detect.maxObjects = parseInt(val);
  });
  menuParams.addRange('Skip Frames', config.human.face.detector, 'skipFrames', 0, 50, 1, (val) => {
    config.human.face.detector.skipFrames = parseInt(val);
    config.human.face.emotion.skipFrames = parseInt(val);
    config.human.face.age.skipFrames = parseInt(val);
    config.human.hand.skipFrames = parseInt(val);
  });
  menuParams.addRange('Min Confidence', config.human.face.detector, 'minConfidence', 0.0, 1.0, 0.05, (val) => {
    config.human.face.detector.minConfidence = parseFloat(val);
    config.human.face.emotion.minConfidence = parseFloat(val);
    config.human.hand.minConfidence = parseFloat(val);
  });
  menuParams.addRange('Score Threshold', config.human.face.detector, 'scoreThreshold', 0.1, 1.0, 0.05, (val) => {
    config.human.face.detector.scoreThreshold = parseFloat(val);
    config.human.hand.scoreThreshold = parseFloat(val);
    config.human.body.scoreThreshold = parseFloat(val);
    config.detect.minThreshold = parseFloat(val);
    config.classify.minThreshold = parseFloat(val);
  });
  menuParams.addRange('IOU Threshold', config.human.face.detector, 'iouThreshold', 0.1, 1.0, 0.05, (val) => {
    config.human.face.detector.iouThreshold = parseFloat(val);
    config.human.hand.iouThreshold = parseFloat(val);
  });
  menuParams.toggle();

  const menuFilters = new Menu(document.body, '');
  menuFilters.addBool('Enabled', config.human.filter, 'enabled');
  menuFilters.addRange('Brightness', config.human.filter, 'brightness', -1.0, 1.0, 0.05, (val) => config.human.filter.brightness = parseFloat(val));
  menuFilters.addRange('Contrast', config.human.filter, 'contrast', -1.0, 1.0, 0.05, (val) => config.human.filter.contrast = parseFloat(val));
  menuFilters.addRange('Sharpness', config.human.filter, 'sharpness', 0, 1.0, 0.05, (val) => config.human.filter.sharpness = parseFloat(val));
  menuFilters.addRange('Blur', config.human.filter, 'blur', 0, 20, 1, (val) => config.human.filter.blur = parseInt(val));
  menuFilters.addRange('Saturation', config.human.filter, 'saturation', -1.0, 1.0, 0.05, (val) => config.human.filter.saturation = parseFloat(val));
  menuFilters.addRange('Hue', config.human.filter, 'hue', 0, 360, 5, (val) => config.human.filter.hue = parseInt(val));
  menuFilters.addRange('Pixelate', config.human.filter, 'pixelate', 0, 32, 1, (val) => config.human.filter.pixelate = parseInt(val));
  menuFilters.addBool('negative', config.human.filter, 'negative');
  menuFilters.addBool('sepia', config.human.filter, 'sepia');
  menuFilters.addBool('vintage', config.human.filter, 'vintage');
  menuFilters.addBool('kodachrome', config.human.filter, 'kodachrome');
  menuFilters.addBool('technicolor', config.human.filter, 'technicolor');
  menuFilters.addBool('polaroid', config.human.filter, 'polaroid');
  menuFilters.toggle();

  const menuDisplay = new Menu(document.body, '');
  menuDisplay.addBool('Thumbnails', config.ui, 'thumbnails');
  menuDisplay.addBool('Use 3D Depth', config.ui, 'useDepth');
  menuDisplay.addBool('Hide Overlay', config.ui, 'overlay');
  menuDisplay.addBool('Draw Boxes', config.ui, 'drawBoxes');
  menuDisplay.addBool('Draw Points', config.ui, 'drawPoints');
  menuDisplay.addBool('Draw Polygons', config.ui, 'drawPolygons');
  menuDisplay.addBool('Fill Polygons', config.ui, 'fillPolygons');
  menuDisplay.toggle();

  menuPerf = new Menu(document.body, '');
  menuPerf.toggle();
  menuPerf.addChart('FPS', 'FPS');

  const click = ('ontouchstart' in window) ? 'touchstart' : 'click';
  document.addEventListener(click, (evt) => {
    if (evt.target.id !== 'menu-models') menuModels.hide();
    if (evt.target.id !== 'menu-parameters') menuParams.hide();
    if (evt.target.id !== 'menu-filters') menuFilters.hide();
    if (evt.target.id !== 'menu-display') menuDisplay.hide();
    switch (evt.target.id) {
      case 'video-start': cameraRestart(); break;
      case 'menu-startstop': cameraRestart(); break;
      case 'menu-facing': config.facing = !config.facing; cameraRestart(); break;
      case 'menu-models': menuModels.toggle(evt); break;
      case 'menu-parameters': menuParams.toggle(evt); break;
      case 'menu-filters': menuFilters.toggle(evt); break;
      case 'menu-display': menuDisplay.toggle(evt); break;
      case 'menu-performance': menuPerf.toggle(evt); break;
      default:
    }
  });

  document.getElementById('detected').style.width = `${document.getElementById('btn-user').offsetLeft - 10}px`;
}

async function main() {
  log.debug(window.location.href);
  window.$ = jQuery;
  await user.get();
  await shared.theme();
  await shared.done();
  await menuSetup();
  await cameraSetup();
  // cameraStartStop();
}

window.onload = main;
window.onresize = cameraResize;

/*
  human: draw
  classify: test
  detect: switch to centernet
*/
