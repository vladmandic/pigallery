// import * as nsfwjs from 'nsfwjs';
// import yolo from './modelYolo.js';

const config = require('./config.js').default;
const tf = require('./processVideo.js');

window.config = config;
const ghost = 500;
let video;
let parent;
let front = true;

function createCanvas() {
  const canvas = document.createElement('canvas');
  const left = $('#video').offset().left;
  canvas.style.left = `${left}px`;
  const top = $('#video').offset().top;
  canvas.style.top = `${top}px`;
  canvas.width = $('#video').width();
  canvas.height = $('#video').height();
  canvas.style.position = 'absolute';
  canvas.style.border = 'px solid';
  return canvas;
}
async function drawDetectionBoxes(object) {
  if (!object || !object.detect || object.detect.length === 0) return;
  const canvas = createCanvas();
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'lightyellow';
  ctx.fillStyle = 'lightyellow';
  ctx.linewidth = 2;
  ctx.font = '16px Roboto';
  const resizeX = $('#main').width() / object.canvas.width;
  const resizeY = $('#main').height() / object.canvas.height;
  for (const obj of object.detect) {
    ctx.beginPath();
    const x = obj.box[0] * resizeX;
    const y = obj.box[1] * resizeY;
    const width = obj.box[2] * resizeX;
    const height = obj.box[3] * resizeY;
    ctx.rect(x, y, width, height);
    ctx.stroke();
    ctx.fillText(`${(100 * obj.score).toFixed(0)}% ${obj.class}`, x + 2, y + 18);
  }
  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parent.removeChild(canvas);
  }, ghost);
}

async function drawFaces(object) {
  if (!object || !object.face || object.face.length < 1) return;
  const canvas = createCanvas();
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const resizeX = $('#main').width() / object.canvas.width;
  const resizeY = $('#main').height() / object.canvas.height;
  for (const i in object.face) {
    const x = object.face[i].detection.box.x * resizeX;
    const y = object.face[i].detection.box.y * resizeY;
    const width = object.face[i].detection.box.width * resizeX;
    const height = object.face[i].detection.box.height * resizeY;
    ctx.strokeStyle = 'deepskyblue';
    ctx.fillStyle = 'deepskyblue';
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.stroke();
    ctx.fillText(`face#${1 + parseInt(i, 10)}`, x + 2, y + 18);
    ctx.fillStyle = 'lightblue';
    const pointSize = 2;
    for (const pt of object.face[i].landmarks.positions) {
      ctx.beginPath();
      ctx.arc(pt._x * resizeX, pt._y * resizeY, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parent.removeChild(canvas);
  }, ghost);
}

async function showDetails(object) {
  if (!object) return;
  let detected = 'Objects';
  if (object.detect) {
    for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  }
  let face = 'People';
  if (object.face) {
    for (const person of object.face) face += ` | ${(100 * person.genderProbability).toFixed(0)}% ${person.gender} ${person.age.toFixed(1)}y`;
  }
  $('#detected').text(detected);
  $('#face').text(face);
}

function time(t0) {
  const t1 = window.performance.now();
  return Math.round(t1 - t0).toLocaleString();
}

async function loadModels() {
  $('#active').text('Loading Models ...');
  $('#detected').text('');
  $('#face').text('');
  const t0 = window.performance.now();
  const state = await tf.load();
  $('#active').text(`Ready in ${time(t0)} ms: Loaded ${state.tensors.toLocaleString()} tensors in ${state.bytes.toLocaleString()} bytes`);
}

// eslint-disable-next-line no-unused-vars
function average(nums) {
  return nums.reduce((a, b) => (a + b)) / nums.length;
}

async function startProcessing() {
  video.removeEventListener('loadeddata', startProcessing);
  $('#text-resolution').text(`${video.videoWidth} x ${video.videoHeight}`);

  const ratio = 1.0 * video.videoWidth / video.videoHeight;
  video.width = ratio >= 1 ? $('#main').width() : 1.0 * $('#main').height() * ratio;
  video.height = video.width / ratio;

  while (!video.paused && !video.ended) {
    const t0 = window.performance.now();
    const object = video.readyState > 1 ? await tf.process(video) : null;
    const t1 = window.performance.now();
    const fps = 1000 / (t1 - t0);
    $('#active').text(`Performance: ${fps.toFixed(1)} FPS detect ${object.timeDetect.toFixed(0)} ms face ${object.timeFace.toFixed(0)} ms`);
    await showDetails(object);
    await drawDetectionBoxes(object);
    await drawFaces(object);
  }
  $('#active').text('Idle ...');
}

async function startWebcam() {
  video.removeEventListener('load', startProcessing);
  // const ratio = 1.0 * video.videoWidth / video.videoHeight;
  // video.width = ratio >= 1 ? $('#main').width() : 1.0 * $('#main').height() * ratio;
  // video.height = video.width / ratio;
  video.width = window.innerWidth;

  // while (true) {
  for (let i = 0; i < 1; i++) {
    const t0 = window.performance.now();
    // const uri = video.src;
    // video.src = uri;
    const object = await tf.process(video);
    const t1 = window.performance.now();
    const fps = 1000 / (t1 - t0);
    $('#active').text(`Performance: ${fps.toFixed(1)} FPS detect ${object.timeDetect.toFixed(0)} ms face ${object.timeFace.toFixed(0)} ms`);
    await showDetails(object);
    await drawDetectionBoxes(object);
    await drawFaces(object);
  }
  $('#active').text('Idle ...');
}

async function stopProcessing() {
  const stream = video.srcObject;
  const tracks = stream ? stream.getTracks() : null;
  if (tracks) tracks.forEach((track) => track.stop());
}

async function getCameraStream() {
  // console.log(tf.models);
  if (!tf.models.detect) {
    $('#active').text('Models not loaded ...');
    return;
  }
  $('#video').toggle(true);
  $('#image').toggle(false);
  video = document.getElementById('video');
  video.addEventListener('loadeddata', startProcessing);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('#active').text('Camera not supported');
    return;
  }
  const constraints = {
    audio: false,
    video: {
      width: { min: 480, ideal: 1920, max: 3840 },
      height: { min: 480, ideal: 1080, max: 3840 },
      facingMode: front ? 'user' : 'environment',
    },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  await video.play();
}

async function getVideoStream(url) {
  if (!url) return;
  $('#video').toggle(true);
  $('#image').toggle(false);
  video = document.getElementById('video');
  video.addEventListener('loadeddata', startProcessing);
  video.src = url;
  await video.play();
  $('#text-resolution').text(`${video.videoWidth} x ${video.videoHeight}`);
}

async function getWebcamStream(url) {
  if (!url) return;
  $('#video').toggle(false);
  $('#image').toggle(true);
  video = document.getElementById('image');
  video.addEventListener('load', startWebcam);
  // video.crossOrigin = 'anonymous'; // doesn't work as access to image canvas is blocked for non-cors loaded images and cors doesn't work on webcams
  video.src = url;
  $('#text-resolution').text(`${video.naturalWidth} x ${video.naturalHeight}`);
}

async function handlers() {
  $('#btn-load').click(() => {
    loadModels();
  });

  $('#btn-play').click(() => {
    $('#btn-play').toggleClass('fa-play-circle fa-pause-circle');
    if ($('#btn-play').hasClass('fa-play-circle')) {
      $('#text-play').text('Live Video');
      video.pause();
      stopProcessing();
    } else {
      $('#text-play').text('Pause Video');
      $('#active').text('Warming up models ...');

      // use one of: getCameraStream, getVideoStream, getWebcamStream

      // using live front/back camera
      getCameraStream();

      // using jpeg captured from webcam
      // getWebcamStream('https://reolink-white/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=wuuPhkmUCeI9WG7C&user=admin&password=xxxx');

      // using webcam stream transcoded from rtsp to hls
      // ffmpeg -hide_banner -y -i rtsp://admin:xxxx@reolink-black:554/h264Preview_01_main -fflags flush_packets -max_delay 2 -flags -global_header -hls_time 4 -hls_list_size 4 -hls_wrap 4 -vcodec copy black.m3u8
      // getVideoStream('media/Webcam/black.m3u8');

      // using mp4 video file
      // getVideoStream('media/Samples/Videos/video-appartment.mp4');
      // getVideoStream('media/Samples/Videos/video-jen.mp4');
      // getVideoStream('media/Samples/Videos/video-dash.mp4');
      // getVideoStream('media/Samples/Videos/video-r1.mp4');
    }
  });

  $('#btn-facing').click(() => {
    front = !front;
    $('#text-facing').text(front ? 'Camera: Front' : 'Camera: Back');
    getCameraStream();
  });
}

async function main() {
  parent = document.getElementById('main');

  // const navbarHeight = $('#navbar').height();
  // $('#main').css('top', `${navbarHeight}px`);
  // video.width = $('#main').width();
  // video.height = $('#main').height();

  handlers();
  // transcode rtsp from camera to m3u8
  // ffmpeg -hide_banner -y -i rtsp://user:pwd@reolink-black:554/h264Preview_01_main -vcodec copy reolink.m3u8
  // video.src = 'media/reolink.m3u8'; video.width = 720; video.height = 480;
}

window.onload = main;

exports.camera = getCameraStream;
exports.webcam = getWebcamStream;
exports.video = getVideoStream;
