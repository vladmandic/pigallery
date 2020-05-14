// import * as nsfwjs from 'nsfwjs';
// import yolo from './modelYolo.js';
import * as faceapi from 'face-api.js';
import config from './config.js';
import log from './log.js';
import ml from './processVideo.js';

const div = {};

window.config = config;

// draw boxes for detected objects, faces and face elements
async function drawBoxes(object, alpha = 1, existing) {
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
    canvas.style.top = 0; // div.Video.offsetTop;
    canvas.style.left = 0; // div.Video.offsetLeft;
    canvas.width = div.Video.width;
    canvas.height = div.Video.height;
    ctx = canvas.getContext('2d');
    div.Main.appendChild(canvas);
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
      const x = obj.box[0] * canvas.width / div.Video.videoWidth;
      const y = obj.box[1] * canvas.height / div.Video.videoHeight;
      const width = obj.box[2] * canvas.width / div.Video.videoWidth;
      const height = obj.box[3] * canvas.height / div.Video.videoHeight;
      ctx.rect(x, y, width, height);
      ctx.stroke();
      ctx.fillText(`${(100 * obj.score).toFixed(0)}% ${obj.class}`, x + 2, y + 18);
    }
  }

  // draw faces
  if (object.person && object.person.detections) {
    const displaySize = { width: canvas.width, height: canvas.height };
    faceapi.matchDimensions(canvas, displaySize);
    const resized = faceapi.resizeResults(object.person.detections.detection, displaySize);
    new faceapi.draw.DrawBox(resized.detection.box, { boxColor: 'lightskyblue' }).draw(canvas);
    new faceapi.draw.DrawFaceLandmarks(resized.landmarks, { lineColor: 'skyblue', pointColor: 'deepskyblue' }).draw(canvas);
  }

  // fade out a ghost at a delay
  if (ctx.globalAlpha > 0) {
    setTimeout(() => drawBoxes(object, alpha - 0.2, canvas), 25);
  }
}

async function showDetails(object, time) {
  if (!object) return;

  let classified = `Analyzed in ${time.toFixed(0)}ms `;
  if (object.classify) for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;

  let person = '';
  if (object.person && object.person.age) {
    person = `Person | 
        Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} | 
        Age: ${object.person.age.toFixed(1)} | 
        Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
  }
  log.active(`${classified}<br>${person}`);
}

async function processVideo() {
  log.result('Video loaded');
  // div.Video.playbackRate = 0.2;
  div.Video.play();
  setInterval(async () => {
    const t0 = window.performance.now();
    const object = div.Video.readyState > 1 ? await ml.process(div.Video) : null;
    const t1 = window.performance.now();
    showDetails(object, t1 - t0);
    drawBoxes(object);
  }, 25);
}

async function main() {
  div.Main = document.getElementById('main');
  div.Details = document.getElementById('details');
  div.Video = document.getElementById('video');
  log.init();
  log.active('Loading models ...<br>');
  await ml.load();
  log.active('Warming up models ...<br>');
  div.Video.addEventListener('loadeddata', processVideo);
  div.Video.src = 'samples/video-appartment.mp4'; div.Video.width = 512; div.Video.height = 1090;
  // div.Video.src = 'samples/video-dash.mp4'; div.Video.width = 1280; div.Video.height = 800;
  // div.Video.src = 'samples/video-r1.mp4'; div.Video.width = 320; div.Video.height = 240;
  // div.Video.src = 'samples/video-jen.mp4'; div.Video.width = 582; div.Video.height = 1034;
}

window.onload = main;

// video stream: https://medium.com/better-programming/video-stream-with-node-js-and-html5-320b3191a6b6
