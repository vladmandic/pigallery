// import * as nsfwjs from 'nsfwjs';
// import yolo from './modelYolo.js';
import config from './config.js';
import log from './log.js';
import * as tf from './processImage.js';

const results = [];
let id = 0;

// prepare stats
function statSummary() {
  const stats = { loadTime: 0, meta: 0, metaTime: 0, classify: 0, classifyTime: 0, detect: 0, detectTime: 0, person: 0, personTime: 0 };
  for (const item of results) {
    stats.loadTime += item.perf.load;
    stats.meta += item.exif ? 1 : 0;
    stats.metaTime += item.perf.meta;
    stats.classify += item.classify && item.classify[0] ? 1 : 0;
    stats.classifyTime += item.perf.classify;
    stats.detect += item.detect && item.detect[0] ? 1 : 0;
    stats.detectTime += item.perf.detect;
    stats.person += item.person ? 1 : 0;
    stats.personTime += item.perf.person;
  }
  stats.loadAvg = stats.loadTime / results.length;
  stats.metaAvg = stats.meta === 0 ? 0 : (stats.metaTime / stats.meta);
  stats.classifyAvg = stats.classify === 0 ? 0 : (stats.classifyTime / stats.classify);
  stats.detectAvg = stats.detect === 0 ? 0 : (stats.detectTime / stats.detect);
  stats.personAvg = stats.person === 0 ? 0 : (stats.personTime / stats.person);
  return stats;
}

// initial complex image is used to trigger all models thus warming them up
async function warmupModels() {
  log.result('TensorFlow models warming up ...');
  const t0 = window.performance.now();
  await tf.process('assets/warmup.jpg');
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
  await warmupModels();
  const t0 = window.performance.now();
  const promises = [];
  log.result(`Processing images: ${files.length}`);
  let error = false;
  for (const url of files) {
    if (!error) {
      promises.push(tf.process(url).then((obj) => {
        log.dot();
        results[id] = obj;
        error = obj.error || error;
        id += 1;
      }));
    }
    if (promises.length >= config.batchProcessing) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  if (promises.length > 0) await Promise.all(promises);
  if (error) log.result('Aborting');
  const t1 = window.performance.now();
  if (files.length > 0) {
    log.result('');
    log.result(`Processed ${files.length} images in ${Math.round(t1 - t0).toLocaleString()}ms ${Math.round((t1 - t0) / files.length).toLocaleString()}ms avg`);
    const s = statSummary();
    log.result(`  Results: ${results.length} images in total ${JSON.stringify(results).length.toLocaleString()} bytes average ${Math.round((JSON.stringify(results).length / results.length)).toLocaleString()} bytes`);
    log.result(`  Image Preparation: ${s.loadTime.toFixed(0)} ms average ${s.loadAvg.toFixed(0)} ms`);
    log.result(`  Classification: ${s.classify} images in ${s.classifyTime.toFixed(0)} ms average ${s.classifyAvg.toFixed(0)} ms`);
    log.result(`  Detection: ${s.detect} images in ${s.detectTime.toFixed(0)} ms average ${s.detectAvg.toFixed(0)} ms`);
    log.result(`  Person Analysis: ${s.person} images in ${s.personTime.toFixed(0)} ms average ${s.personAvg.toFixed(0)} ms`);
    setTimeout(async () => {
      log.result('Saving results to persistent cache ...');
      log.active('Saving...');
      const save = await fetch('/api/save');
      if (save.ok) await save.text();
      log.active('Idle...');
    }, 1000);
  }
  log.active('Idle...');
}

async function main() {
  const t0 = window.performance.now();
  log.init();
  log.active('Starting ...');
  await tf.load();
  await processFiles();
  const t1 = window.performance.now();
  log.result(`Image Analysis done: ${Math.round(t1 - t0).toLocaleString()}ms`);
}

window.onload = main;
