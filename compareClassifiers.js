/* global ml5 */

const image = document.getElementById('image');
const classifiers = [];
const images = [];
let busy;

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function loadModel(name, type) {
  const t0 = window.performance.now();
  let func;
  if (type === 'classify') func = await ml5.imageClassifier(`models/${name}/model.json`);
  if (type === 'detect') func = await ml5.objectDetector(`models/${name}/model.json`);
  log(`Loaded model: ${name} in ${(window.performance.now() - t0).toLocaleString()}ms`);
  return { name, func, type };
}

async function initModels() {
  log(`Initializing ML5js ${ml5.version}...`);
  classifiers.push(await loadModel('mobilenet_v1_025_224', 'classify'));
  classifiers.push(await loadModel('mobilenet_v1_050_224', 'classify'));
  classifiers.push(await loadModel('mobilenet_v1_075_224', 'classify'));
  classifiers.push(await loadModel('mobilenet_v1_100_224', 'classify'));
  classifiers.push(await loadModel('mobilenet_v2_100_224', 'detect'));
  classifiers.push(await loadModel('yolo', 'detect'));
  classifiers.push(await loadModel('yolo-v1-tiny', 'detect'));
  classifiers.push(await loadModel('yolo-v2-tiny', 'detect'));
  classifiers.push(await loadModel('yolo-v3-tiny', 'detect'));
  classifiers.push(await loadModel('yolo-v3', 'detect'));
  log('Ready...');
}

async function processPicture() {
  log(`Processing picture: ${image.src}`);
  for (const model of classifiers) {
    try {
      const t0 = window.performance.now();
      let results = [];
      if (model.type === 'classify') results = await model.func.classify(image);
      if (model.type === 'detect') results = await model.func.detect(image);
      const guesses = [];
      for (const result of results) {
        const label = result.label.split(', ')[0].trim();
        if (result.confidence > 0.12) guesses.push({ confidence: result.confidence, label });
      }
      const obj = { type: model.type, model: model.name, time: window.performance.now() - t0, guesses };
      const found = images.find((a) => a.image === image.src);
      if (found) found.obj.push(obj);
      else images.push({ image: image.src, obj: [obj] });
    } catch (err) {
      log(`Error processing: ${image.src} using ${model.type}/${model.name}: ${err}`);
    }
  }
  busy = false;
}

async function printResults() {
  log('Processing results...');
  let text = '';
  for (const img of images) {
    text += '<div class="row">';
    text += `<div class="col" style="height: 150px; min-width: 150px; max-width: 150px"><img src="${img.image}" width="140" height="140"></div>`;
    text += '<div class="col">';
    for (const obj of img.obj) {
      text += `<div>${obj.type}/${obj.model} in ${obj.time.toFixed(0)}ms: `;
      // text += '<div class="col">';
      for (const guess of obj.guesses) {
        text += `<span> ${(100 * guess.confidence).toFixed(2)}% ${guess.label} </span>`;
      }
      text += '</div>';
    }
    text += '</div></div>';
  }
  document.getElementById('result').innerHTML = text;
}

async function loadPicture(i) {
  return new Promise((resolve) => {
    busy = true;
    image.addEventListener('load', processPicture);
    image.src = `samples/img${i}.jpeg`;
    setInterval(() => {
      if (!busy) resolve();
    }, 50);
  });
}

async function loadGallery() {
  for (let i = 1; i < 30; i++) {
    await loadPicture(i);
  }
}

async function main() {
  await initModels();
  await loadGallery();
  await printResults();
}

main();
