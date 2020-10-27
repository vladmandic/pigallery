import * as tf from '@tensorflow/tfjs/dist/tf.es2017.js';
import * as log from '../shared/log.js';
import * as draw from './draw.js';
import * as modelDetect from '../process/modelDetect.js';
import * as definitions from '../shared/models.js';

let objects;

function setObjects(inObjects) {
  objects = inObjects;
}

function appendCanvas(name, width, height) {
  objects.canvases[name] = document.createElement('canvas', { desynchronized: true });
  objects.canvases[name].style.position = 'relative';
  objects.canvases[name].id = `canvas-${name}`;
  objects.canvases[name].className = 'canvases';
  objects.canvases[name].width = width;
  objects.canvases[name].height = height;
  objects.canvases[name].style.zIndex = Object.keys(objects.canvases).length;
  document.getElementById('canvases').appendChild(objects.canvases[name]);
}

exports.set = setObjects;
