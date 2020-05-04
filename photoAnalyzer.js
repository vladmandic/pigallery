/* global ml5 */

const image = document.getElementById('image');
let classifier;
let detector;
const images = [];
let busy;

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function loadModels() {
  log(`Initializing ML5js ${ml5.version}...`);
  let t0;
  // load MobileNet Classifier model
  t0 = window.performance.now();
  classifier = await ml5.imageClassifier('models/mobilenet_v1_100_224/model.json');
  log(`Loaded model: MobileNet-v1.100 in ${(window.performance.now() - t0).toLocaleString()}ms`);
  // load DarkNet/Yolo Detector model
  t0 = window.performance.now();
  detector = await ml5.objectDetector('models/yolo-v3/model.json');
  log(`Loaded model: DarkNet/Yolo-v3 in ${(window.performance.now() - t0).toLocaleString()}ms`);
}

async function processPicture() {
  log(`Processing picture: ${image.src}`);
  // note: processing is sequential, but there is no performance gain in running classifer and detector in parallel
  try {
    const t0 = window.performance.now();
    // run classifier
    const resClassifier = await classifier.classify(image);
    const classified = [];
    for (const result of resClassifier) {
      if (result.confidence > 0.15) classified.push({ confidence: result.confidence, label: result.label.split(', ')[0].trim() });
    }
    // run detector
    const resDetector = await detector.detect(image);
    const detected = [];
    for (const result of resDetector) {
      if (result.confidence > 0.15) detected.push({ confidence: result.confidence, label: result.label.split(', ')[0].trim() });
    }
    // push to results array
    images.push({ image: image.src, time: (window.performance.now() - t0), classified, detected });
  } catch (err) {
    log(`Error processing: ${image.src}: ${err}`);
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
    text += `<div>Image ${img.image} processed in ${img.time.toFixed(0)}ms </div>`;
    text += '<div>Classification: ';
    for (const guess of img.classified) {
      text += `<span> ${(100 * guess.confidence).toFixed(2)}% ${guess.label} </span>`;
    }
    text += '</div>';
    text += '<div>Detected: ';
    for (const guess of img.detected) {
      text += `<span> ${(100 * guess.confidence).toFixed(2)}% ${guess.label} </span>`;
    }
    text += '</div>';
    text += '</div></div>';
  }
  document.getElementById('result').innerHTML = text;
}

async function loadPicture(i) {
  return new Promise((resolve) => {
    try {
      busy = true;
      image.addEventListener('load', processPicture);
      image.src = `samples/sample%20(${i}).jpg`;
      setInterval(() => {
        if (!busy) resolve();
      }, 50);
    } catch {
      log(`Error loading picture: samples/sample%20(${i}).jpg`);
    }
  });
}

async function loadGallery() {
  for (let i = 1; i < 58; i++) {
    await loadPicture(i);
  }
}

async function main() {
  await loadModels();
  await loadGallery();
  await printResults();
}

main();
