/* global ml5 */

const image = document.getElementById('image');
const result = document.getElementById('result');
let imageClassifier;
let objectDetector;
let i = 1;
let classification = [];

async function init() {
  console.log('Initializing ML');
  imageClassifier = await ml5.imageClassifier('MobileNet');
  objectDetector = await ml5.objectDetector('cocossd');
  console.log('Ready...');
}

async function process() {
  let results;
  results = await imageClassifier.classify(image);
  for (const result of results) classification.push({ type: 'classify', image: image.src, confidence: (100 * result.confidence).toFixed(2), label: result.label })
  results = await objectDetector.detect(image);
  for (const result of results) classification.push({ type: 'detect', image: image.src, confidence: (100 * result.confidence).toFixed(2), label: result.label })
  result.innerText = `<pre>${JSON.stringify(classification, null , 2)}</pre>`;
}

async function load() {
  image.onload(await process);
  image.src=`samples/img${i}.jpeg`;
  if (i++ < 14) load();
}

async function main() {
  await init();
  // image.addEventListener('load', process);
  load();
}

main();
