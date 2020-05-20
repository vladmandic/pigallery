// import * as nsfwjs from 'nsfwjs';
// import yolo from './modelYolo.js';
import config from './config.js';
import log from './log.js';
import * as ml from './processImage.js';

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

// calls main detectxion and then print results for all images matching spec
async function processGallery(spec) {
  log.active(`Fetching list for "${spec.folder}" matching "${spec.match}"`);
  const res = await fetch(`/api/list?folder=${encodeURI(spec.folder)}&match=${encodeURI(spec.match)}`);
  const dir = await res.json();
  // eslint-disable-next-line max-len
  log.result(`Processing folder:${dir.folder} matching:${dir.match || '*'} recursive:${dir.recursive} force:${dir.force} total:${dir.stats.all} files:${dir.stats.files} matched:${dir.stats.matched} excluded:${dir.stats.excluded} processed:${dir.stats.processed} remaining:${dir.stats.list}`);
  const t0 = window.performance.now();
  const promises = [];
  const tmpResults = [];
  for (const f of dir.files) {
    const url = `${spec.folder}/${f}`;
    promises.push(ml.process(url).then((obj) => {
      log.dot();
      results[id] = obj;
      tmpResults.push(results[id]);
      id += 1;
    }));
    if (promises.length >= config.batchProcessing) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  if (promises.length > 0) await Promise.all(promises);
  const t1 = window.performance.now();
  tmpResults.length = 0;
  if (dir.files.length > 0) {
    log.result('');
    log.result(`Processed ${dir.files.length} images in ${(t1 - t0).toLocaleString()}ms ${((t1 - t0) / dir.files.length).toLocaleString()}ms avg result is ${JSON.stringify(tmpResults).length.toLocaleString()} bytes`);
    const s = statSummary();
    log.result(`  Results: ${results.length} images in ${JSON.stringify(results).length} total bytes ${(JSON.stringify(results).length / results.length).toFixed(0)} average bytes`);
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

// initial complex image is used to trigger all models thus warming them up
async function warmupModels() {
  log.result('Models warming up ...');
  const t0 = window.performance.now();
  await ml.process('assets/warmup.jpg');
  const t1 = window.performance.now();
  log.result(`Models warmed up in ${Math.round(t1 - t0).toLocaleString()}ms`);
}

async function main() {
  log.init();
  log.active('Starting ...');
  await ml.load();
  await warmupModels();
  // await processGallery({ folder: 'media', match: 'objects' });
  // await processGallery({ folder: 'media', match: 'people' });
  // await processGallery({ folder: 'media', match: 'large' });
  await processGallery({ folder: 'media/Pictures/Snapseed', match: '' });
  await processGallery({ folder: 'media/Pictures/Random', match: '' });
  await processGallery({ folder: 'media/Photos/Objects', match: '' });
}

window.onload = main;
