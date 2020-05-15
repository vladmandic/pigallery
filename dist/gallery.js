// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"config.js":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

/* eslint-disable no-multi-spaces */
const config = {
  // General configuration
  backEnd: 'webgl',
  // back-end used by tensorflow for image processing, can be webgl, cpu, wasm
  maxSize: 780,
  // maximum image width or height that will be used for processing before resizing is required
  thumbnail: 128,
  // resolution in which to store image thumbnail embedded in result set
  batchProcessing: 10,
  // how many images to process in parallel
  squareImage: false,
  // resize proportional to the original image or to a square image
  floatPrecision: true,
  // use float32 or float16 for WebGL tensors
  // Default models
  classify: {
    name: 'Inception v3',
    modelPath: 'models/inception-v3/model.json',
    score: 0.2,
    topK: 3
  },
  detect: {
    name: 'Coco/SSD v2',
    modelPath: 'models/cocossd-v2/model.json',
    score: 0.4,
    topK: 6,
    overlap: 0.1
  },
  person: {
    name: 'FaceAPI SSD',
    modelPath: 'models/faceapi/',
    score: 0.4,
    topK: 1,
    type: 'ssdMobilenetv1'
  } // alternative classification models - you can pick none of one

  /*
  classify: { name: 'MobileNet v1', modelPath: '/models/mobilenet-v1/model.json' },
  classify: { name: 'MobileNet v2', modelPath: '/models/mobilenet-v2/model.json' },
  classify: { name: 'Inception v1', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v1/classification/3/default/1' },
  classify: { name: 'Inception v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v2/classification/3/default/1' },
  classify: { name: 'Inception v3', modelPath: '/models/inception-v3/model.json' },
  classify: { name: 'Inception ResNet v2', modelPath: '/models/inception-resnet-v2/model.json' },
  classify: { name: 'ResNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/resnet_v2_101/classification/3/default/1' },
  classify: { name: 'NasNet Mobile', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/nasnet_mobile/classification/3/default/1' },
  */
  // alternative detect models: enable darknet/yolo model in a separate module - you can pick none, enable coco/ssd-v2 or enable darknet/yolo (not js module is initialized by default)
  // detect: { name: 'Coco/SSD v2', modelPath: 'models/cocossd-v2/model.json', score: 0.4, topK: 6, overlap: 0.1 },
  // alternative face-api models - you can pick none or one of following

  /*
  person: { name: 'FaceAPI SSD', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'ssdMobilenetv1' },
  person: { name: 'FaceAPI Yolo', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyYolov2' },
  person: { name: 'FaceAPI Tiny', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyFaceDetector' },
  person: { name: 'FaceAPI MTCNN', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'mtcnn' },
  */

};
var _default = config;
exports.default = _default;
},{}],"log.js":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
const div = {};

async function dot() {
  div.Log.innerHTML += '.';
}

async function result(...msg) {
  let msgs = '';
  msgs += msg.map(a => a);
  if (div && div.Log) div.Log.innerHTML += `${msgs.replace(' ', '&nbsp')}<br>`;
  if (msgs.length > 0) fetch(`/log?msg=${msgs}`).then(res => res.text()); // eslint-disable-next-line no-console

  console.log(...msg);
}

async function active(...msg) {
  if (div && div.Active) div.Active.innerHTML = `${msg}<br>`; // eslint-disable-next-line no-console
  else console.log(...msg);
}

function init() {
  div.Log = document.getElementById('log');
  div.Active = document.getElementById('active');
}

const log = {
  result,
  active,
  init,
  dot
};
var _default = log;
exports.default = _default;
},{}],"gallery.js":[function(require,module,exports) {
"use strict";

var _config = _interopRequireDefault(require("./config.js"));

var _log = _interopRequireDefault(require("./log.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let results = [];
const div = {}; // pre-fetching DOM elements to avoid multiple runtime lookups

function initDivs() {
  div.Result = document.getElementById('result');
  div.Popup = document.getElementById('popup');
  div.PopupImage = document.getElementById('popup-image');
  div.PopupDetails = document.getElementById('popup-details');
  div.Found = document.getElementById('found');
  div.Filter = document.getElementById('filter');
  div.Filter.addEventListener('keyup', event => {
    event.preventDefault(); // eslint-disable-next-line no-use-before-define

    if (event.keyCode === 13) filterResults(div.Filter.value);
  });
  div.canvas = document.getElementById('popup-canvas');
} // draw boxes for detected objects, faces and face elements


function drawBoxes(img, object) {
  div.canvas.style.position = 'absolute';
  div.canvas.style.left = img.offsetLeft;
  div.canvas.style.top = img.offsetTop;
  div.canvas.width = img.width;
  div.canvas.height = img.height;
  const ctx = div.canvas.getContext('2d');
  ctx.linewidth = 2;
  ctx.font = '16px Roboto';
  const resizeX = img.width / object.processedSize.width;
  const resizeY = img.height / object.processedSize.height; // draw detected objects

  if (object.detect) {
    ctx.strokeStyle = 'lightyellow';
    ctx.fillStyle = 'lightyellow';

    for (const obj of object.detect) {
      const x = obj.box[0] * resizeX;
      const y = obj.box[1] * resizeY;
      ctx.beginPath();
      ctx.rect(x, y, obj.box[2] * resizeX, obj.box[3] * resizeY);
      ctx.stroke();
      ctx.fillText(`${(100 * obj.score).toFixed(0)}% ${obj.class}`, x + 2, y + 18);
    }
  } // draw faces


  if (object.person && object.person.face) {
    // draw box around face
    const x = object.person.face.box.x * resizeX;
    const y = object.person.face.box.y * resizeY;
    ctx.strokeStyle = 'deepskyblue';
    ctx.fillStyle = 'deepskyblue';
    ctx.beginPath();
    ctx.rect(x, y, object.person.face.box.width * resizeX, object.person.face.box.height * resizeY);
    ctx.stroke();
    ctx.fillText('face', x + 2, y + 18); // draw face points

    ctx.fillStyle = 'lightblue';
    const pointSize = 2;

    for (const pt of object.person.face.points) {
      ctx.beginPath();
      ctx.arc(pt.x * resizeX, pt.y * resizeY, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
    /*
    const jaw = object.person.boxes.landmarks.getJawOutline() || [];
    const nose = object.person.boxes.landmarks.getNose() || [];
    const mouth = object.person.boxes.landmarks.getMouth() || [];
    const leftEye = object.person.boxes.landmarks.getLeftEye() || [];
    const rightEye = object.person.boxes.landmarks.getRightEye() || [];
    const leftEyeBrow = object.person.boxes.landmarks.getLeftEyeBrow() || [];
    const rightEyeBrow = object.person.boxes.landmarks.getRightEyeBrow() || [];
    faceDetails = `Points jaw:${jaw.length} mouth:${mouth.length} nose:${nose.length} left-eye:${leftEye.length} right-eye:${rightEye.length} left-eyebrow:${leftEyeBrow.length} right-eyebrow:${rightEyeBrow.length}`;
    */

  }
} // show details popup


async function showDetails() {
  const object = results[div.PopupImage.resid];
  if (!object) return;
  div.Popup.style.display = 'flex';
  let classified = 'Classified ';
  if (object.classify) for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let detected = 'Detected ';
  if (object.detect) for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  let person = '';

  if (object.person && object.person.age) {
    person = `Person | 
        Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} | 
        Age: ${object.person.age.toFixed(1)} | 
        Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
  }

  let nsfw = '';

  if (object.person && object.person.class) {
    nsfw = `Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class} `;
  }

  let desc = '<h2>Description:</h2><ul>';

  if (object.descriptions) {
    for (const description of object.descriptions) {
      for (const lines of description) {
        desc += `<li><b>${lines.name}</b>: <i>${lines.desc}</i></li>`;
      }

      desc += '<br>';
    }
  }

  desc += '</ul>';
  let exif = '';

  if (object.exif) {
    const mp = (div.PopupImage.naturalWidth * div.PopupImage.naturalHeight / 1000000).toFixed(1);
    const complexity = div.PopupImage.naturalWidth * div.PopupImage.naturalHeight / object.exif.bytes;
    if (object.exif.make) exif += `Camera: ${object.exif.make} ${object.exif.model || ''} ${object.exif.lens || ''}<br>`;
    if (object.exif.bytes) exif += `Size: ${mp} MP in ${object.exif.bytes.toLocaleString()} bytes with compression factor ${complexity.toFixed(2)}<br>`;
    if (object.exif.created) exif += `Taken: ${new Date(1000 * object.exif.created).toLocaleString()} Edited: ${new Date(1000 * object.exif.modified).toLocaleString()}<br>`;
    if (object.exif.software) exif += `Software: ${object.exif.software}<br>`;
    if (object.exif.exposure) exif += `Settings: ${object.exif.fov || 0}mm ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec<br>`;
  }

  let location = '';
  if (object.location && object.location.city) location += `Location: ${object.location.city}, ${object.location.country}, ${object.location.continent} (near ${object.location.near})<br>`;
  if (object.exif && object.exif.lat) location += `Coordinates: Lat ${object.exif.lat.toFixed(3)} Lon ${object.exif.lon.toFixed(3)}<br>`;
  div.PopupDetails.innerHTML = `
      <h2>Image: ${object.image}</h2>
      Image size: ${div.PopupImage.naturalWidth} x ${div.PopupImage.naturalHeight}
        Processed in ${object.perf.total.toFixed(0)} ms<br>
        Classified using ${_config.default.classify ? _config.default.classify.name : 'N/A'} in ${object.perf.classify.toFixed(0)} ms<br>
        Detected using ${_config.default.detect ? _config.default.detect.name : 'N/A'} in ${object.perf.detect.toFixed(0)} ms<br>
        Person using ${_config.default.person ? _config.default.person.name : 'N/A'} in ${object.perf.person.toFixed(0)} ms<br>
      <h2>Image Data</h2>
      ${exif}
      <h2>Location</h2>
      ${location}
      <h2>${classified}</h2>
      <h2>${detected}</h2>
      <h2>${person} ${nsfw}</h2>
      ${desc}
      </div>
    `; // const faceDetails = drawBoxes(div.PopupImage, object) || '';

  drawBoxes(div.PopupImage, object);

  div.Popup.onclick = () => {
    div.Popup.style.display = 'none';
  };
} // print results strip with thumbnail for a given object


async function printResult(object) {
  let classified = '';

  if (object.classify && object.classify[0]) {
    classified = 'Classified';

    for (const obj of object.classify) classified += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  }

  let detected = '';

  if (object.detect && object.detect[0]) {
    detected = 'Detected';

    for (const obj of object.detect) detected += ` | ${(100 * obj.score).toFixed(0)}% ${obj.class}`;
  }

  let person = '';

  if (object.person && object.person.age) {
    person = `Person | 
      Gender: ${(100 * object.person.scoreGender).toFixed(0)}% ${object.person.gender} 
      Age: ${object.person.age.toFixed(1)} 
      Emotion: ${(100 * object.person.scoreEmotion).toFixed(0)}% ${object.person.emotion}`;
  }

  let nsfw = '';

  if (object.person && object.person.class) {
    nsfw = `Class: ${(100 * object.person.scoreClass).toFixed(0)}% ${object.person.class} `;
  }

  let location = '';

  if (object.location && object.location.city) {
    location = 'Location';
    location += ` | ${object.location.city}, ${object.location.country}, ${object.location.continent} (near ${object.location.near})`;
  }

  let camera = '';

  if (object.exif.make) {
    camera = 'Camera';
    camera += `: ${object.exif.make} ${object.exif.model || ''}`;
  }

  const divItem = document.createElement('div');
  divItem.class = 'col';
  divItem.style = 'display: flex';
  divItem.innerHTML = `
    <div class="col" style="max-height: ${_config.default.thumbnail}px; min-width: ${_config.default.thumbnail}px; max-width: ${_config.default.thumbnail}px; padding: 0">
      <img id="thumb-${object.id}" src="${object.thumbnail}" align="middle" width="${_config.default.thumbnail}px" height="${_config.default.thumbnail}px">
    </div>
    <div id="desc-${object.id}" class="col" style="height: ${_config.default.thumbnail}px; min-width: 564px; max-width: 564px; padding: 4px">
      <b>${decodeURI(object.image)}</b><br>
      Image: ${object.naturalSize.width}x${object.naturalSize.height} ${camera}<br>
      ${location}<br>
      ${classified}<br>
      ${detected}<br>
      ${person} ${nsfw}<br>
    </div>
  `;
  div.Result.appendChild(divItem);
  document.getElementById(`thumb-${object.id}`).resid = object.id;
  document.getElementById(`desc-${object.id}`).resid = object.id;
  divItem.addEventListener('click', evt => {
    div.PopupImage.resid = evt.target.resid;
    div.PopupImage.src = object.image; // this triggers showDetails via onLoad event
  });
  div.PopupImage.addEventListener('load', showDetails); // don't call showDetails directly to ensure image is loaded
}

function filterWord(object, word) {
  if (!object) return null;
  const skip = ['in', 'a', 'the', 'of', 'with', 'using', 'wearing', 'and', 'at', 'during'];
  if (skip.includes(word)) return object;
  const res = object.filter(obj => {
    let ok = false;

    for (const tag of obj.tags) {
      const str = Object.values(tag)[0].toString() || '';
      ok |= str.startsWith(word.toLowerCase());
    }

    return ok;
  });
  return res;
}

function filterResults(words) {
  _log.default.active('Searching ...');

  let found = results;
  let foundWords = 0;

  for (const word of words.split(' ')) {
    found = filterWord(found, word);
    foundWords += found && found.length > 0 ? 1 : 0;
  }

  _log.default.result(`Searching for "${words}" found ${foundWords} words in ${found.length || 0} results out of ${results.length} matches`);

  if (found && found.length > 0) div.Found.innerText = `Found ${found.length} results`;else div.Found.innerText = `Found ${foundWords} of ${words.split(' ').length} words`;
  div.Result.innerHTML = '';

  for (const obj of found) {
    printResult(obj);
  }

  _log.default.active('Idle ...');
} // calls main detectxion and then print results for all images matching spec


async function loadGallery() {
  _log.default.result('Loading gallery ...');

  _log.default.active('Loading gallery ...');

  const res = await fetch('/get?find=all');
  results = await res.json();

  _log.default.result(`Received ${results.length} images in ${JSON.stringify(results).length} bytes`);

  for (const id in results) {
    results[id].id = id;

    _log.default.active(`Printing: ${results[id].image}`);

    printResult(results[id]);
  }
}

async function main() {
  initDivs();

  _log.default.init();

  _log.default.active('Starting ...');

  await loadGallery();
}

window.onload = main;
},{"./config.js":"config.js","./log.js":"log.js"}]},{},["gallery.js"], null)
//# sourceMappingURL=/gallery.js.map