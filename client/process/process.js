/* global tf */

const log = require('../shared/log.js');
const config = require('../shared/config.js').default;
const process = require('./processImage.js');

const results = [];
let id = 0;
let running = false;
let stopping = false;

// initial complex image is used to trigger all models thus warming them up
async function warmupModels() {
  log.div('process-log', true, 'TensorFlow models warming up ...');
  const t0 = window.performance.now();
  const res = await process.process('assets/warmup.jpg');
  if (res.error) {
    log.div('process-log', true, 'Aborting current run due to error during warmup');
    // setTimeout(() => window.location.reload(true), 2500);
    setTimeout(() => window.location.replace(`${window.location.origin}?process`), 2500);
  }
  const t1 = window.performance.now();
  log.div('process-log', true, `TensorFlow models warmed up in ${Math.round(t1 - t0).toLocaleString()}ms`);
  log.div('process-log', true, 'TensorFlow flags: <br>', tf.ENV.flags);
}

// calls main detectxion and then print results for all images matching spec
async function processFiles() {
  const p0 = window.performance.now();
  running = true;
  log.div('process-active', false, 'Starting ...');
  log.div('log', true, 'Image database update requested ...');
  log.server('Image DB Update');
  log.div('process-log', true, 'Requesting file list from server ...');
  const res = await fetch('/api/list');
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
  await process.load();
  await warmupModels();
  const t0 = window.performance.now();
  const promises = [];
  log.div('process-log', true, `Processing images: ${files.length}`);
  let error = false;
  let stuckTimer = new Date();
  const checkAlive = setInterval(() => { // reload window if no progress for 60sec
    const now = new Date();
    if (now.getTime() > (stuckTimer.getTime() + (5 * 60 * 1000))) window.location.reload(true);
  }, 10000);
  for (const url of files) {
    if (!error && !stopping) {
      promises.push(process.process(url).then((obj) => {
        results[id] = obj;
        // eslint-disable-next-line no-console
        log.div('process-active', false, `[${results.length}/${files.length}] Processed ${obj.image} in ${obj.perf.total.toLocaleString()} ms size ${JSON.stringify(obj).length.toLocaleString()} bytes`);
        log.debug('Processed', obj.image, obj);
        error = (obj.error === true) || error;
        id += 1;
        stuckTimer = new Date();
      }));
    }
    if (promises.length >= config.batchProcessing) {
      await Promise.all(promises);
      promises.length = 0;
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
    setTimeout(() => window.location.reload(true), 2500);
  }
  log.div('process-active', false, 'Idle ...');
  const p1 = window.performance.now();
  log.div('process-log', true, `Image Analysis done: ${Math.round(p1 - p0).toLocaleString()}ms`);
  log.div('process-log', true, 'Reload image database now');
  running = false;
}

async function start() {
  if (!running) processFiles();
  $('#process-stop').click(() => { stopping = true; });
  $('#process-close').click(() => $('#process').hide());
}

// window.onload = main;
exports.start = start;
