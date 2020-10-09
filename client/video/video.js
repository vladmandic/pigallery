/* global params */

import jQuery from 'jquery';
import panzoom from '../../assets/panzoom.js';
import * as log from '../shared/log.js';
import * as user from '../shared/user.js';
import * as detect from './detect.js';
import config from '../shared/config.js';

window.params = {
  facing: true,
  minThreshold: 0.4,
  maxObjects: 5,
  quantBytes: 4,
  skipFrames: 20,
  async: false, // slightly faster, but atomic per-model performance and memory consumption is unreliable
  resolution: { width: 0, height: 0 }, // if 0, use camera resolution
  extractSize: 100, // width of extracted image, height is autocalculated
  imageContrast: 0,
  imageBlur: 0,
  imageSharpness: 0,
  imageSaturation: 0,
  imageBrightness: 0,
  imageHue: 0,
  lineTension: 0.25,
};

async function cameraStart(play = true) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.getElementById('status').innerHTML = 'no camera access';
    document.getElementById('video-start').style.display = 'block';
    document.getElementById('video-start').classList.remove('fa-play-circle');
    document.getElementById('video-start').classList.add('fa-times-circle');
    return;
  }
  log.div('div', true, 'Model parameters: ', document.getElementById('menu-complex').checked ? ' full models ' : ' simple models ', params);
  const video = document.getElementById('videocanvas');
  const constraints = {
    audio: false,
    video: { width: { ideal: window.innerWidth, max: 3840 }, height: { ideal: window.innerHeight, max: 3840 }, facingMode: params.facing ? 'user' : 'environment' },
  };
  // const devices = await navigator.mediaDevices.enumerateDevices();
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const track = stream.getVideoTracks()[0];
  if (track.getCapabilities && track.getCapabilities().resizeMode) await track.applyConstraints({ resizeMode: 0 });
  video.srcObject = stream;
  if (play) {
    panzoom(document.getElementById('videocanvas'), { zoomSpeed: 0.025, minZoom: 0.5, maxZoom: 2.0 });
    document.getElementById('menu-startstop').classList.remove('fa-play-circle');
    document.getElementById('menu-startstop').classList.add('fa-pause-circle');
    $('#btn-startstop').text('stop');
    video.play().then(() => {}).catch(() => {});
  }
}

async function cameraStop() {
  const video = document.getElementById('videocanvas');
  video.pause();
  const tracks = video.srcObject ? video.srcObject.getTracks() : null;
  if (tracks) tracks.forEach((track) => track.stop());
  document.getElementById('menu-startstop').classList.remove('fa-pause-circle');
  document.getElementById('menu-startstop').classList.add('fa-play-circle');
  $('#btn-startstop').text('play');
}

async function cameraResize() {
  clearTimeout(window.resizeTimer);
  window.resizeTimer = setTimeout(async () => {
    const video = document.getElementById('videocanvas');
    const live = !video.paused && (video.srcObject ? (video.srcObject.getVideoTracks()[0].readyState === 'live') : false);
    log.div('div', true, `Resize display: ${video.offsetWidth} x ${video.offsetHeight}`);
    await cameraStop();
    detect.clear();
    window.canvases = [];
    document.getElementById('drawcanvas').innerHTML = '';
    cameraStart(live);
  }, 200);
}

async function cameraStartStop() {
  const video = document.getElementById('videocanvas');
  const live = !video.paused && (video.srcObject ? (video.srcObject.getVideoTracks()[0].readyState === 'live') : false);
  document.getElementById('video-start').style.display = live ? 'block' : 'none';
  if (!live) await cameraStart();
  else await cameraStop();
}

async function cameraFacing() {
  params.facing = !params.facing;
  $('#btn-facing').text(params.facing ? 'front' : 'back');
  const video = document.getElementById('videocanvas');
  const live = video.srcObject ? ((video.srcObject.getVideoTracks()[0].readyState === 'live') && (video.readyState > 2) && (!video.paused)) : false;
  await cameraStop();
  detect.clear();
  await cameraStart(live);
}

async function modelsReload() {
  log.div('div', true, `Changing to ${document.getElementById('menu-complex').checked ? 'full' : 'simple'} models`);
  window.models = [];
  window.canvases = [];
  window.perf = { Frame: 0 };
  document.getElementById('drawcanvas').innerHTML = '';
}

async function cameraListen() {
  const video = document.getElementById('videocanvas');
  video.addEventListener('loadeddata', (event) => {
    const track = video.srcObject.getVideoTracks()[0];
    const settings = video.srcObject.getVideoTracks()[0].getSettings();
    log.div('div', true, `Start video: ${track.label} camera ${settings.width} x ${settings.height} display ${video.offsetWidth} x ${video.offsetHeight} facing ${settings.facingMode}`);
    log.debug('Camera Settings: ', settings);
    document.getElementById('objects').style.top = `${video.offsetTop + video.offsetHeight}px`;
    event.stopPropagation();
    detect.main();
  }, true);
}

async function initControls() {
  document.getElementById('log').style.display = document.getElementById('menu-log').checked ? 'block' : 'none';
  for (const el of document.getElementsByClassName('range')) el.dataset.value = el.value;
  document.addEventListener('resize', () => cameraResize(false));
  document.addEventListener('change', (evt) => {
    if (evt.target.classList.contains('range')) evt.target.dataset.value = evt.target.value;
    switch (evt.target.id) {
      case 'menu-complex': modelsReload(); break;
      case 'menu-objects': params.maxObjects = parseInt(evt.target.value); break;
      case 'menu-log': $('#log').slideToggle(); break;
      case 'menu-threshold': params.minThreshold = parseFloat(evt.target.value); break;
      case 'menu-tension': params.lineTension = parseFloat(evt.target.value); break;
      case 'menu-brightness': params.imageBrightness = parseFloat(evt.target.value); break;
      case 'menu-contrast': params.imageContrast = parseFloat(evt.target.value); break;
      case 'menu-sharpness': params.imageSharpness = parseFloat(evt.target.value); break;
      case 'menu-blur': params.imageBlur = parseInt(evt.target.value); break;
      case 'menu-saturation': params.imageSaturation = parseFloat(evt.target.value); break;
      case 'menu-hue': params.imageHue = parseInt(evt.target.value); break;
      default:
    }
  });
  const click = ('ontouchstart' in window) ? 'touchstart' : 'click';
  document.addEventListener(click, (evt) => {
    switch (evt.target.id) {
      case 'video-start': cameraStartStop(); break;
      case 'menu-startstop': cameraStartStop(); break;
      case 'menu-facing': cameraFacing(); break;
      case 'menu-models':
        $('#pull-options').hide();
        $('#pull-models').slideToggle();
        break;
      case 'menu-options':
        $('#pull-models').hide();
        $('#pull-options').slideToggle();
        break;
      default:
    }
  });
}

async function main() {
  await cameraListen();
  await initControls();
  // cameraStartStop();
}

async function init() {
  log.debug(window.location.href);
  window.$ = jQuery;
  await user.get();
  await config.theme();
  await config.done();
  await main();
}

window.onload = init;
