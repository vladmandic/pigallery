import * as tf from '@tensorflow/tfjs/dist/tf.es2017.js';
import * as log from '../shared/log.js';
import * as draw from './draw.js';
import * as gesture from './gesture.js';
import * as models from './models.js';
import * as human from './human.js';
import * as definitions from '../shared/models.js';

async function drawOverlay(video, canvases) {
  if (!canvases.process) {
    canvases.process = document.createElement('canvas', { desynchronized: true });
    canvases.process.id = 'canvas-process';
    canvases.process.width = video.offsetWidth;
    canvases.process.height = video.offsetHeight;
    canvases.process.style.position = 'absolute';
    canvases.process.style.top = 0;
    canvases.process.style.filter = 'opacity(0.5) grayscale(1)';
    document.getElementById('canvases').appendChild(canvases.process);
  }
  canvases.process.getContext('2d').drawImage(video, 0, 0, canvases.process.width, canvases.process.height);
}

async function clearAll(canvases) {
  for (const canvas of Object.values(canvases)) {
    log.debug('Clear canvas', canvas);
    draw.clear(canvas);
  }
  canvases = [];
}

async function main(config, objects) {
  const video = document.getElementById('video');
  if (video.paused || video.ended) {
    log.div('log', true, `Video status: paused:${video.paused} ended:${video.ended} ready:${video.readyState}`);
    return;
  }
  if (video.readyState > 2) {
    const t0 = performance.now();
    const promises = [];
    objects.detected.length = 0;
    objects.perf.Canvas = 0;

    if (objects.perf.Frame === 0) {
      if (config.backEnd === 'wasm') tf.wasm.setPaths('/assets');
      tf.setBackend(config.backEnd);
      // tf.ENV.set('WEBGL_CPU_FORWARD', false);
      if (config.backEnd === 'webgl') tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true);
      await tf.ready();
      await tf.enableProdMode();
      log.div('log', true, `Using TensorFlow/JS: ${tf.version_core} Backend: ${tf.getBackend().toUpperCase()}`);
      objects.fps.length = 0;
    }

    if (config.ui.overlay) await drawOverlay(video, objects.canvases);
    else draw.clear(objects.canvases.process);

    models.set(objects);

    if (config.classify.imagenet) {
      if (config.async) promises.push(models.imagenet(video, config));
      else promises.push(await models.imagenet(video, config));
    } else draw.clear(objects.canvases.imagenet);

    if (config.classify.deepdetect) {
      if (config.async) promises.push(models.deepdetect(video, config));
      else promises.push(await models.deepdetect(video, config));
    } else draw.clear(objects.canvases.deepdetect);

    if (config.detect.coco) {
      if (config.async) promises.push(models.cocossd(video, config));
      else promises.push(await models.cocossd(video, config));
    } else draw.clear(objects.canvases.cocossd);

    if (config.classify.nsfw) {
      if (config.async) promises.push(models.nsfw(video, config));
      else promises.push(await models.nsfw(video, config));
    } else draw.clear(objects.canvases.nsfw);

    if (config.classify.food) {
      if (config.async) promises.push(models.food(video, config));
      else promises.push(await models.food(video, config));
    } else draw.clear(objects.canvases.food);

    if (config.classify.plants) {
      if (config.async) promises.push(models.plants(video, config));
      else promises.push(await models.plants(video, config));
    } else draw.clear(objects.canvases.plants);

    if (config.classify.birds) {
      if (config.async) promises.push(models.birds(video, config));
      else promises.push(await models.birds(video, config));
    } else draw.clear(objects.canvases.birds);

    if (config.classify.insects) {
      if (config.async) promises.push(models.insects(video, config));
      else promises.push(await models.insects(video, config));
    } else draw.clear(objects.canvases.insects);

    if (config.human.enabled) {
      if (config.async) promises.push(human.run(video, config.human));
      else promises.push(await human.run(video, config.human));
    } else draw.clear(objects.canvases.human);

    window.results = (config.async ? await Promise.all(promises) : promises).filter((a) => ((a !== null) && (a !== undefined)));

    const div = document.getElementById('objects');
    div.innerHTML = '';
    for (const object of objects.extracted) div.appendChild(object);
    objects.extracted.length = 0;

    if (objects.perf.Frame === 0) {
      const engine = await tf.engine();
      log.div('log', true, `TF State: ${engine.state.numBytes.toLocaleString()} bytes ${engine.state.numDataBuffers.toLocaleString()} buffers ${engine.state.numTensors.toLocaleString()} tensors`);
      log.div('log', true, `TF GPU Memory: used ${engine.backendInstance.numBytesInGPU.toLocaleString()} bytes free ${Math.floor(1024 * 1024 * engine.backendInstance.numMBBeforeWarning).toLocaleString()} bytes`);
      // eslint-disable-next-line no-console
      log.debug('TF Flags:', engine.ENV.flags);
      // eslint-disable-next-line no-console
      log.debug('TF Models:', definitions.models);
      // eslint-disable-next-line no-console
      if (objects.results) {
        for (const result of objects.results) log.debug('TF Results: ', result);
      }
    }

    const gestures = await gesture.analyze(objects.results);

    const t1 = performance.now();
    objects.perf.Total = Math.trunc(t1 - t0);
    objects.perf.Frame += 1;
    objects.perf.Canvas = Math.round(objects.perf.Canvas);
    document.getElementById('detected').innerText = `Detected: ${log.str([...objects.detected, ...gestures])}`;
    document.getElementById('perf').innerText = `Performance: ${log.str(objects.perf)}`;
  }
  requestAnimationFrame(() => main(config, objects));
}

exports.main = main;
exports.clear = clearAll;
