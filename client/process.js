const moment = require('moment');
const log = require('./log.js');
const config = require('./config.js').default;
const tf = require('./processImage.js');

const results = [];
let id = 0;

// initial complex image is used to trigger all models thus warming them up
async function warmupModels() {
  log.result('TensorFlow models warming up ...');
  const t0 = window.performance.now();
  const res = await tf.process('assets/warmup.jpg');
  if (res.error) {
    log.result('Aborting current run due to error during warmup');
    setTimeout(() => window.location.reload(true), 2500);
  }
  const t1 = window.performance.now();
  log.result(`TensorFlow models warmed up in ${Math.round(t1 - t0).toLocaleString()}ms`);
}

// calls main detectxion and then print results for all images matching spec
async function processFiles() {
  log.result('Requesting file list from server ...');
  const res = await fetch('/api/list');
  const dirs = await res.json();
  let files = [];
  for (const dir of dirs) {
    log.result(`  Queued folder: ${dir.location.folder} matching: ${dir.location.match || '*'} recursive: ${dir.location.recursive || false} force: ${dir.location.force || false} pending: ${dir.files.length}`);
    files = [...files, ...dir.files];
  }
  await tf.load();
  await warmupModels();
  const t0 = window.performance.now();
  const promises = [];
  log.result(`Processing images: ${files.length}`);
  let error = false;
  let stuckTimer = new Date();
  const checkAlive = setInterval(() => { // reload window if no progress for 60sec
    const now = new Date();
    if (now.getTime() > (stuckTimer.getTime() + (5 * 60 * 1000))) window.location.reload(true);
  }, 10000);
  for (const url of files) {
    if (!error) {
      promises.push(tf.process(url).then((obj) => {
        log.dot();
        results[id] = obj;
        // eslint-disable-next-line no-console
        log.active(`${moment().format('HH:mm:ss')} [${results.length}/${files.length}] Processed ${obj.image} in ${obj.perf.total.toLocaleString()} ms size ${JSON.stringify(obj).length.toLocaleString()} bytes`);
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
  log.dot(true);
  const t1 = window.performance.now();
  if (files.length > 0) {
    log.result(`Processed ${results.length} of ${files.length} images in ${Math.round(t1 - t0).toLocaleString()}ms ${Math.round((t1 - t0) / results.length).toLocaleString()}ms avg`);
    log.result(`Results: ${results.length} images in total ${JSON.stringify(results).length.toLocaleString()} bytes average ${Math.round((JSON.stringify(results).length / results.length)).toLocaleString()} bytes`);
  }
  if (error) {
    log.result('Aborting current run due to error');
    setTimeout(() => window.location.reload(true), 2500);
  }
  log.active('Idle ...');
}

async function main() {
  const t0 = window.performance.now();
  log.active('Starting ...');
  await processFiles();
  const t1 = window.performance.now();
  log.result(`Image Analysis done: ${Math.round(t1 - t0).toLocaleString()}ms`);
}

window.onload = main;
