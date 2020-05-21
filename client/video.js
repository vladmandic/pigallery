// import * as nsfwjs from 'nsfwjs';
// import yolo from './modelYolo.js';
import * as faceapi from 'face-api.js';
import config from './config.js';
import * as tf from './processVideo.js';

window.config = config;
let video;
let parent;
let front = true;
let ready = false;

// draw boxes for detected objects, faces and face elements
async function drawDetectionBoxes(object, alpha = 1, existing) {
  if (!object) return;
  let canvas;
  let ctx;
  if (existing) {
    canvas = existing;
    ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else {
    canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = 0; // video.offsetTop;
    canvas.style.left = 0; // video.offsetLeft;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx = canvas.getContext('2d');
    parent.appendChild(canvas);
  }
  ctx.globalAlpha = alpha;
  // draw detected objects
  if (object.detect && object.detect[0] && object.detect[0].box) {
    ctx.strokeStyle = 'lightyellow';
    ctx.fillStyle = 'lightyellow';
    ctx.linewidth = 2;
    ctx.font = '16px Roboto';
    for (const obj of object.detect) {
      ctx.beginPath();
      const x = obj.box[0] * canvas.width / video.videoWidth;
      const y = obj.box[1] * canvas.height / video.videoHeight;
      const width = obj.box[2] * canvas.width / video.videoWidth;
      const height = obj.box[3] * canvas.height / video.videoHeight;
      ctx.rect(x, y, width, height);
      ctx.stroke();
      ctx.fillText(`${(100 * obj.score).toFixed(0)}% ${obj.class}`, x + 2, y + 18);
    }
  }
  // fade out a ghost at a delay
  if (ctx.globalAlpha > 0) {
    setTimeout(() => {
      drawDetectionBoxes(object, alpha - 0.2, canvas);
    }, 25);
  } else {
    parent.removeChild(canvas);
  }
}

async function drawFaces(object) {
  if (!object) return;
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = 0; // video.offsetTop;
  canvas.style.left = 0; // video.offsetLeft;
  canvas.width = video.width;
  canvas.height = video.height;
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  // draw faces
  if (object.person && object.person.detections) {
    const displaySize = { width: canvas.width, height: canvas.height };
    faceapi.matchDimensions(canvas, displaySize);
    const resized = faceapi.resizeResults(object.person.detections.detection, displaySize);
    new faceapi.draw.DrawBox(resized.detection.box, { boxColor: 'lightskyblue' }).draw(canvas);
    new faceapi.draw.DrawFaceLandmarks(resized.landmarks, { lineColor: 'skyblue', pointColor: 'deepskyblue' }).draw(canvas);
  }
  // delete after delay
  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parent.removeChild(canvas);
  }, 100);
}

async function showDetails(object) {
  if (!object) return;

  let classified = '';
  if (object.classify) {
    for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  }

  let detected = '';
  if (object.detect) {
    for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  }

  let person = '';
  if (object.person && object.person.age) {
    person = ` | Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} | 
        Age: ${object.person.age.toFixed(1)} | 
        Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
  }

  const html = `Classified ${classified}<br>Detected ${detected}<br>Person ${person}`;
  $('#analysis').html(html);
}

async function getCameraStream() {
  // eslint-disable-next-line no-use-before-define
  video.addEventListener('loadeddata', startProcessing);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('#active').text('Camera not supported');
    return;
  }
  video.srcObject = null;
  const constraints = {
    audio: false,
    video: {
      width: { min: 480, ideal: 1920, max: 3840 },
      height: { min: 480, ideal: 1920, max: 3840 },
      facingMode: front ? 'user' : 'environment',
    },
  };
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
  });
  await video.play();
  $('#text-resolution').text(`${video.videoWidth} x ${video.videoHeight}`);
  // console.log(await navigator.mediaDevices.enumerateDevices());
  // console.log(navigator.mediaDevices.getSupportedConstraints());
}

async function sleep(period) {
  return new Promise((resolve) => setTimeout(resolve(), period));
}

function time(t0) {
  const t1 = window.performance.now();
  return Math.round(t1 - t0).toLocaleString();
}

async function loadModels() {
  let t0;
  $('#active').text('Preparing models');
  t0 = window.performance.now();
  await tf.load();
  $('#active').text(`Models loaded: ${time(t0)} ms`);
  t0 = window.performance.now();
  await tf.process(video);
  $('#active').text(`Models warmed up: ${time(t0)} ms`);
  ready = true;
}

async function startProcessing() {
  video.removeEventListener('loadeddata', startProcessing);
  if (!ready) await loadModels();
  while (!video.paused) {
    const t0 = window.performance.now();
    const object = video.readyState > 1 ? await tf.process(video) : null;
    $('#active').text(`Detection: ${time(t0)} ms`);
    showDetails(object);
    drawDetectionBoxes(object);
    drawFaces(object);
    await sleep(500);
  }
  $('#active').text('Idle ...');
}

async function main() {
  $('#active').text('Starting ...');
  video = document.getElementById('video');
  video.width = window.innerWidth;
  video.height = window.innerHeight;
  parent = document.getElementById('main');

  getCameraStream();

  $('#btn-facing').click(() => {
    front = !front;
    $('#text-facing').text(front ? 'Front' : 'Back');
    getCameraStream();
  });

  $('#btn-pause').click(() => {
    $('#btn-pause').toggleClass('fa-pause-circle fa-play-circle');
    $('#text-pause').text(video.paused ? 'Play' : 'Pause');
    if (video.paused) {
      video.play();
      getCameraStream();
    } else {
      video.pause();
    }
  });

  // video.src = 'media/video-appartment.mp4'; video.width = 512; video.height = 1090;
  // video.src = 'media/video-dash.mp4'; video.width = 1280; video.height = 800;
  // video.src = 'media/video-r1.mp4'; video.width = 320; video.height = 240;
  // video.src = 'media/video-jen.mp4'; video.width = 582; video.height = 1034;

  // transcode rtsp from camera to m3u8
  // ffmpeg -hide_banner -y -i rtsp://admin:Mon1900@reolink-black:554/h264Preview_01_main -vcodec copy reolink.m3u8
  // video.src = 'media/reolink.m3u8'; video.width = 720; video.height = 480;
}

window.onload = main;
