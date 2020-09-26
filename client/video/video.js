/* global tf, faceapi */

const log = require('../shared/log.js');
const config = require('../shared/config.js').default;
const definitions = require('../shared/models.js').models;
const modelClassify = require('../process/modelClassify.js');
const modelDetect = require('../process/modelDetect.js');
const ColorThief = require('../../assets/color-thief.umd.js');

let video;
let front = true; // camera front or back
let loading = false; // busy loading models
let reduce = 1; // resolution reduction factor
const delay = 25; // delay in ms between ml calls
// const ghosts = 3; // how many ghost objects to render
const exec = { classify: null, detect: null, person: null };
const videoCanvas = document.createElement('canvas');
const thief = new ColorThief();

async function stop() {
  if (!video) return;
  await video.pause();
  const tracks = video.srcObject ? video.srcObject.getTracks() : null;
  if (tracks) tracks.forEach((track) => track.stop());
  setTimeout(async () => {
    await video.pause();
    $('#video-status').text('Camera stopped ...');
  }, 250);
}

function roundRect(obj) { // ctx, x, y, width, height, radius = 5, lineWidth = 2, strokeStyle = null, fillStyle = null, alpha = 1, title = null) {
  obj.ctx.lineWidth = obj.lineWidth;
  obj.ctx.globalAlpha = obj.alpha;
  obj.ctx.beginPath();
  obj.ctx.moveTo(obj.x + obj.radius, obj.y);
  obj.ctx.lineTo(obj.x + obj.width - obj.radius, obj.y);
  obj.ctx.quadraticCurveTo(obj.x + obj.width, obj.y, obj.x + obj.width, obj.y + obj.radius);
  obj.ctx.lineTo(obj.x + obj.width, obj.y + obj.height - obj.radius);
  obj.ctx.quadraticCurveTo(obj.x + obj.width, obj.y + obj.height, obj.x + obj.width - obj.radius, obj.y + obj.height);
  obj.ctx.lineTo(obj.x + obj.radius, obj.y + obj.height);
  obj.ctx.quadraticCurveTo(obj.x, obj.y + obj.height, obj.x, obj.y + obj.height - obj.radius);
  obj.ctx.lineTo(obj.x, obj.y + obj.radius);
  obj.ctx.quadraticCurveTo(obj.x, obj.y, obj.x + obj.radius, obj.y);
  obj.ctx.closePath();
  if (obj.strokeStyle) {
    obj.ctx.strokeStyle = obj.strokeStyle;
    obj.ctx.fillStyle = obj.strokeStyle;
    obj.ctx.stroke();
  }
  if (obj.fillStyle) {
    obj.ctx.fillStyle = obj.fillStyle;
    obj.ctx.fill();
  }
  obj.ctx.globalAlpha = 1;
  obj.ctx.lineWidth = 1;
  if (obj.title) {
    obj.ctx.font = 'small-caps 1rem Lato';
    obj.ctx.fillText(obj.title, obj.x + 4, obj.y + 16);
  }
}

let ctxDetect;
async function initDetect() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.border = 'px solid';
  canvas.id = 'canvas-detect';
  canvas.width = $('#videocanvas').width();
  canvas.height = $('#videocanvas').height();
  canvas.style.top = `${$('#videocanvas').offset().top}px`;
  canvas.style.left = `${$('#videocanvas').offset().left}px`;
  ctxDetect = canvas.getContext('2d');
  ctxDetect.font = 'small-caps 1rem Lato';
  document.getElementById('videosection').appendChild(canvas);
}

// const objDetect = [];
async function drawDetect(object) {
  if (!ctxDetect) await initDetect();
  ctxDetect.clearRect(0, 0, $('#videocanvas').width(), $('#videocanvas').height());
  if (!object || !object.detected) return;
  const resizeX = $('#videocanvas').width() / video.videoWidth * reduce;
  const resizeY = $('#videocanvas').height() / video.videoHeight * reduce;
  for (const obj of object.detected) {
    const x = obj.box[0] * resizeX;
    const y = obj.box[1] * resizeY;
    const width = obj.box[2] * resizeX;
    const height = obj.box[3] * resizeY;
    roundRect({ ctx: ctxDetect, x, y, width, height, radius: 10, lineWidth: 4, strokeStyle: 'lightyellow', fillStyle: null, alpha: 0.4, title: obj.class });
    // objDetect.push({ ctx: ctxDetect, x, y, width, height, radius: 10, lineWidth: 4, strokeStyle: 'lightyellow', fillStyle: null, title: obj.class });
  }
  /*
  while (objDetect.length > (object.detected.length * ghosts)) objDetect.shift();
  for (const i in objDetect) {
    objDetect[i].alpha = ((i + 1) ** 2) / (5 * ghosts);
    roundRect(objDetect[i]);
  }
  */
}

let ctxPerson;
async function initPerson() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.border = 'px solid';
  canvas.id = 'canvas-person';
  canvas.width = $('#videocanvas').width();
  canvas.height = $('#videocanvas').height();
  canvas.style.top = `${$('#videocanvas').offset().top}px`;
  canvas.style.left = `${$('#videocanvas').offset().left}px`;
  ctxPerson = canvas.getContext('2d');
  ctxPerson.font = 'small-caps 1rem Lato';
  document.getElementById('videosection').appendChild(canvas);
}

async function drawPerson(object) {
  if (!ctxPerson) await initPerson();
  ctxPerson.clearRect(0, 0, $('#videocanvas').width(), $('#videocanvas').height());
  if (!object || !object.person) return;
  const resizeX = $('#videocanvas').width() / video.videoWidth * reduce;
  const resizeY = $('#videocanvas').height() / video.videoHeight * reduce;
  for (const res of object.person) {
    const x = res.detection.box.x * resizeX;
    const y = res.detection.box.y * resizeY;
    const width = res.detection.box.width * resizeX;
    const height = res.detection.box.height * resizeY;
    roundRect({ ctx: ctxPerson, x, y, width, height, radius: 10, lineWidth: 3, strokeStyle: 'deepskyblue', filleStyle: null, alpha: 0.4, title: `${res.gender} ${res.age.toFixed(1)}y` });
    ctxPerson.fillStyle = 'lightblue';
    ctxPerson.globalAlpha = 0.5;
    for (const pt of res.landmarks.positions) {
      ctxPerson.beginPath();
      ctxPerson.arc(pt.x * resizeX, pt.y * resizeY, 2, 0, 2 * Math.PI);
      ctxPerson.fill();
    }
  }
}

let persons = null;
async function print(obj) {
  if (video.srcObject) {
    const track = video.srcObject.getVideoTracks()[0];
    const settings = track.getSettings();
    $('#video-camera').text(`${track.label} Video: ${video.width} x ${video.height} Camera: ${settings.width || 0} x ${settings.height || 0}`);
  } else {
    $('#video-camera').text(`Video: ${video.src}`);
  }

  let classified = '';
  if (obj.classified) {
    classified = 'Classified';
    for (const res of obj.classified) classified += ` | ${Math.round(res.score * 100)}% ${res.class}`;
  }
  $('#video-classified').text(classified);

  let detected = '';
  if (obj.detected) {
    detected = 'Detected';
    for (const res of obj.detected) detected += ` | ${Math.round(res.score * 100)}% ${res.class}`;
  }
  $('#video-detected').text(detected);

  if (!persons) {
    persons = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const i in persons) persons[i] = [];
  }
  let person = '';
  if (obj.person) {
    person = 'Person';
    for (const i in obj.person) {
      persons[i].push(obj.person[i].age);
      if (persons[i].length > 9) persons[i].shift();
    }
    for (const i in obj.person) {
      const age = persons[i].reduce((a, b) => (a + b)) / persons[i].length;
      person += ` | ${Math.round(100 * obj.person[i].genderProbability)}% ${obj.person[i].gender} ${age.toFixed(1)}y`;
    }
  }
  $('#video-person').text(person);
}

async function loadModel(model, subtype) {
  loading = true;
  log.debug('Loading model:', model, subtype || '');
  if ((model === 'classify') && subtype) {
    $('#video-status').text('Loading Image Classification models ...');
    exec.classify = await modelClassify.load(definitions.video[subtype]);
  }
  if (model === 'detect') {
    $('#video-status').text('Loading Object Detection models ...');
    exec.detect = await modelDetect.load(definitions.video.detect);
  }
  if (model === 'person') {
    const options = definitions.video.person;
    $('#video-status').text('Loading Face Recognition model ...');
    if (options.exec === 'yolo') await faceapi.nets.tinyFaceDetector.load(options.modelPath);
    if (options.exec === 'ssd') await faceapi.nets.ssdMobilenetv1.load(options.modelPath);
    await faceapi.nets.ageGenderNet.load(options.modelPath);
    await faceapi.nets.faceLandmark68Net.load(options.modelPath);
    if (options.exec === 'yolo') exec.person = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: options.score, inputSize: options.tensorSize });
    if (options.exec === 'ssd') exec.person = new faceapi.SsdMobilenetv1Options({ minConfidence: options.score, maxResults: options.topK });
  }
  const engine = await tf.engine();
  $('#video-status').text(`Loaded Model: ${tf.getBackend()} backend ${engine.state.numBytes.toLocaleString()} bytes ${engine.state.numTensors.toLocaleString()} tensors`);
  loading = false;
}

async function process() {
  if (video.paused || video.ended) {
    log.debug(`Video status: paused:${video.paused} ended:${video.ended} ready:${video.readyState}`);
    return;
  }
  if ((video.readyState > 1) && !loading) {
    // if (firstFrame) video.pause();
    const obj = { classified: [], detected: [], person: [] };

    // draw canvas from video
    const t5 = window.performance.now();
    reduce = document.getElementById('videoReduce').checked ? 4 : 1;
    videoCanvas.height = video.videoHeight / reduce;
    videoCanvas.width = video.videoWidth / reduce;
    const ctx = videoCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height);

    // get dominant color and setup animation
    const dominant = thief.getColor(videoCanvas, 30);
    document.documentElement.style.setProperty('--dominant', `rgb(${dominant})`);
    document.getElementById('video').classList.add('animfade');

    // run classification
    const t0 = window.performance.now();
    if (document.getElementById('videoClassify').checked) {
      document.getElementById('videoClassification').style.visibility = 'visible';
      // if (!exec.classify) await loadModel('classify'); // loaded from radio button onclick event
      if (exec.classify) obj.classified = await modelClassify.classify(exec.classify, videoCanvas);
    } else {
      document.getElementById('videoClassification').style.visibility = 'hidden';
    }

    // run detection
    const t1 = window.performance.now();
    if (document.getElementById('videoDetect').checked) {
      if (!exec.detect) await loadModel('detect');
      obj.detected = await modelDetect.exec(exec.detect, videoCanvas);
    }

    // run face analysis
    const t2 = window.performance.now();
    if (document.getElementById('videoFace').checked) {
      if (!exec.person) await loadModel('person');
      obj.person = await faceapi.detectAllFaces(videoCanvas, exec.person).withFaceLandmarks().withAgeAndGender();
    }

    // print all results
    const t3 = window.performance.now();
    await print(obj);
    await drawDetect(obj);
    await drawPerson(obj);
    const t4 = window.performance.now();

    // stop animation and set fixed background color
    document.getElementById('video').style.background = `rgb(${dominant})`;
    document.getElementById('video').classList.remove('animfade');

    // write status line
    const modelPerf = `Classify ${Math.floor(t1 - t0)} ms | Detect ${Math.floor(t2 - t1)} ms | Person ${Math.floor(t3 - t2)} ms`;
    const canvasData = `Data ${ctx.getImageData(0, 0, videoCanvas.width, videoCanvas.height).data.length.toLocaleString()} bytes ${Math.floor(t0 - t5)} ms`;
    $('#video-status').text(`Performance: ${(1000 / (t4 - t5)).toFixed(1)} FPS | ${canvasData} | Draw ${Math.floor(100 / reduce)}% ${Math.floor(t4 - t3)} ms | ${modelPerf}`);
  }
  setTimeout(process, delay);
}

async function camera() {
  if (video.srcObject) {
    const track = video.srcObject.getVideoTracks()[0];
    if (track.getCapabilities) log.debug('Video capabilities', track.getCapabilities());
    log.debug('Video settings', video.srcObject.getVideoTracks()[0].getSettings());
  }
  $('#video-status').text('Warming up: Detection will start soon ...');
  video.removeEventListener('loadeddata', camera);
  const ratio = 1.0 * video.videoWidth / video.videoHeight;
  video.width = ratio >= 1 ? $('#main').width() : 1.0 * $('#main').height() * ratio;
  video.height = video.width / ratio;
  setTimeout(process, 100);
}

async function start(url) {
  $('#video-status').text('Starting camera ...');
  video = document.getElementById('videocanvas');
  video.addEventListener('loadeddata', camera);
  try {
    if (url) {
      video.src = url;
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        $('#video-status').text('Camera not supported');
        return;
      }
      const constraints = {
        audio: false,
        video: {
          width: { max: 3840 },
          height: { max: 3840 },
          facingMode: front ? 'user' : 'environment',
        },
      };
      if (window.innerHeight > window.innerWidth) constraints.video.height.ideal = window.innerHeight;
      else constraints.video.width.ideal = window.innerWidth;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      if (track.getCapabilities && track.getCapabilities().resizeMode) await track.applyConstraints({ resizeMode: 0 }); // stop strech & crop
      video.srcObject = stream;
    }
    video.play();
  } catch (err) {
    $('#video-status').text(err);
  }
}

async function init(url) {
  $('#video-status').text('Initializing ...');
  await tf.setBackend(config.backEnd);
  await tf.enableProdMode();
  tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true);

  $('#btn-play').click(() => {
    $('#btn-play').toggleClass('fa-play-circle fa-pause-circle');
    if ($('#btn-play').hasClass('fa-play-circle')) {
      $('#text-play').text('Live Video');
      stop();
    } else {
      $('#text-play').text('Pause Video');
      start(url);
    }
  });

  $('#btn-facing').click(() => {
    front = !front;
    $('#text-facing').text(front ? 'Camera: Front' : 'Camera: Back');
    start();
  });

  $(window).resize(() => {
    if (video && (video.readyState > 1)) {
      stop();
      start(url);
    }
  });

  $('input[type="radio"]').on('click', (evt) => loadModel('classify', evt.target.value));
  $('#btn-play').click();
}

exports.init = init;
exports.stop = stop;
