import $ from 'jquery';
import { tf } from '../shared/tf.js';
import * as log from '../shared/log.js';
import * as config from '../shared/config.js';
import * as process from './processImage.js';
import * as user from '../shared/user.js';

const results = [];
let id = 0;
let running = false;
let stopping = false;
const autoReload = false;

// initial complex image is used to trigger all models thus warming them up
async function warmupModels() {
  if (stopping) return;
  log.div('process-log', true, 'TensorFlow flags: <span style="font-size: 0.6rem">', tf.ENV.flags, '</span>');
  log.div('process-log', true, 'TensorFlow warming up ...');
  const t0 = window.performance.now();
  const res = await process.process('assets/warmup.jpg');
  if (res.error) {
    log.div('process-log', true, 'Aborting current run due to error during warmup');
    if (autoReload) setTimeout(() => window.location.reload(true), 2500);
    // setTimeout(() => window.location.replace(`${window.location.origin}?process`), 2500);
  }
  const t1 = window.performance.now();
  log.div('process-log', true, `TensorFlow warmed up in ${Math.round(t1 - t0).toLocaleString()}ms`);
}

// calls main detectxion and then print results for all images matching spec
async function processFiles() {
  const p0 = window.performance.now();
  running = true;
  log.div('process-active', false, 'Starting ...');
  log.div('log', true, 'Image database update requested ...');
  log.server('Image DB Update');
  log.div('process-log', true, 'Requesting file list from server ...');
  // log.div('process-state', false, 'Requesting file list from server ...');
  const res = await fetch('/api/file/all');
  const dirs = await res.json();
  let files = [];
  for (const dir of dirs) {
    log.div('process-log', true, `  Analyzing folder: ${dir.location.folder} matching: ${dir.location.match || '*'} recursive: ${dir.location.recursive || false} force: ${dir.location.force || false} pending: ${dir.files.length}`);
    files = [...files, ...dir.files];
  }
  if (files.length === 0) {
    log.div('process-log', true, 'No new images found');
    running = false;
    return;
  }
  log.div('process-state', false, 'Loading models ...');
  await process.load();
  log.div('process-state', false, 'Warming up ...');
  await warmupModels();
  const t0 = window.performance.now();
  const promises = [];
  log.div('process-log', true, `Processing images: ${files.length} batch: ${config.default.batchProcessing}`);
  let error = false;
  let stuckTimer = new Date();
  const checkAlive = setInterval(() => { // reload window if no progress for 60sec
    const now = new Date();
    if (autoReload && now.getTime() > (stuckTimer.getTime() + (5 * 60 * 1000))) window.location.reload(true);
  }, 10000);
  for (const url of files) {
    if (!error && !stopping) {
      if (config.default.batchProcessing <= 1) {
        const obj = await process.process(url);
        results[id] = obj;
        log.div('process-active', false, `[${results.length}/${files.length}] Processed ${obj.image} in ${obj.perf.total.toLocaleString()} ms size ${JSON.stringify(obj).length.toLocaleString()} bytes`);
        log.debug('Processed', obj.image, obj);
        error = (obj.error === true) || error;
        id += 1;
        stuckTimer = new Date();
      } else {
        promises.push(process.process(url).then((obj) => {
          results[id] = obj;
          log.div('process-active', false, `[${results.length}/${files.length}] Processed ${obj.image} in ${obj.perf.total.toLocaleString()} ms size ${JSON.stringify(obj).length.toLocaleString()} bytes`);
          log.debug('Processed', obj.image, obj);
          error = (obj.error === true) || error;
          id += 1;
          stuckTimer = new Date();
        }));
      }
      if (promises.length >= config.default.batchProcessing) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }
  }
  if (promises.length > 0) await Promise.all(promises);
  clearInterval(checkAlive);
  const t1 = window.performance.now();
  if (stopping) log.div('process-log', true, 'Aborting current run due to user stop request');
  if (files.length > 0) {
    log.div('process-log', true, `Processed ${results.length} of ${files.length} images in ${Math.round(t1 - t0).toLocaleString()}ms ${Math.round((t1 - t0) / results.length).toLocaleString()}ms avg`);
    log.div('process-log', true, `Results: ${results.length} images in total ${JSON.stringify(results).length.toLocaleString()} bytes average ${Math.round((JSON.stringify(results).length / results.length)).toLocaleString()} bytes`);
  }
  if (error) {
    log.div('process-log', true, 'Aborting current run due to error');
    if (autoReload) setTimeout(() => window.location.reload(true), 2500);
  }
  log.div('process-active', false, 'Idle ...');
  const p1 = window.performance.now();
  log.div('process-log', true, `Image Analysis done: ${Math.round(p1 - p0).toLocaleString()}ms`);
  log.div('process-log', true, 'Reload image database now');
  running = false;
}

async function main() {
  log.debug(parent.location.href === location.href ? 'Running in stand-alone mode' : 'Running in frame');
  await user.get();
  await config.theme();
  // @ts-ignore
  if (!window.user.admin) {
    // @ts-ignore
    log.div('process-active', true, 'Image database update not authorized: ', window.user);
    return;
  }
  await config.done();
  $('#btn-stop').on('click', () => { stopping = true; });
  if (!running) processFiles();
}

window.onload = main;
