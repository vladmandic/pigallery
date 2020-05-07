/* global ml5, faceapi */

let classifier;
let detector;
const images = [];

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function loadModels() {
  log(`Initializing TensorFlowJS with ML5js and FaceApi ${ml5.version}...`);
  let t0;
  // load MobileNet Classifier model
  t0 = window.performance.now();
  classifier = await ml5.imageClassifier('models/mobilenet_v1_100_224/model.json');
  log(`Loaded model: MobileNet-v1.100 in ${(window.performance.now() - t0).toLocaleString()}ms`);
  // load DarkNet/Yolo Detector model
  t0 = window.performance.now();
  detector = await ml5.objectDetector('models/yolo-v3/model.json');
  log(`Loaded model: DarkNet/Yolo-v3 in ${(window.performance.now() - t0).toLocaleString()}ms`);
  // load FaceApi Detetor model
  /*
  t0 = window.performance.now();
  await faceapi.nets.ssdMobilenetv1.load('models/faceapi/');
  await faceapi.loadFaceLandmarkModel('models/faceapi/');
  await faceapi.nets.ageGenderNet.load('models/faceapi/');
  await faceapi.loadFaceExpressionModel('models/faceapi/');
  log(`Loaded model: SSD/FaceModel in ${(window.performance.now() - t0).toLocaleString()}ms`);
  */
}

async function processPerson(image) {
  /*
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
  const result = await faceapi.detectSingleFace(image, options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender();
  if (result) {
    let emotion = Object.entries(result.expressions)
      .reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    emotion = { label: emotion && emotion[0] ? emotion[0] : '', confidence: emotion && emotion[1] ? emotion[1] : 0 };
    return { gender: { confidence: result.genderProbability, label: result.gender }, age: result.age, emotion: { confidence: emotion.confidence, label: emotion.label } };
  }
  */
  return null;
}

async function processImage(image) {
  log(`Processing picture: ${image.src} ${image.width}x${image.height}`);
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
    // if person, run additional analysis
    const found = detected.find((a) => a.label === 'person');
    let person;
    if (found) person = await processPerson(image);
    // push to results array
    images.push({ image: image.src, time: (window.performance.now() - t0), classified, detected, person });
  } catch (err) {
    log(`Error processing: ${image.src}: ${err}`);
  }
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
    text += '<div>Person: ';
    if (img.person && img.person.age) {
      text += `<span> ${(100 * img.person.gender.confidence).toFixed(2)}% ${img.person.gender.label} emption: ${(100 * img.person.emption.confidence).toFixed(2)}% ${img.person.emotion.label}</span>`;
    }
    text += '</div>';
    text += '</div></div></div>';
  }
  document.getElementById('result').innerHTML = text;
}

async function loadImage(imageUrl) {
  return new Promise((resolve) => {
    try {
      const image = new Image();
      image.addEventListener('load', () => {
        const ratio = image.height / image.width;
        if (image.width > 1024 || image.height > 1024) {
          image.width = 1024;
          image.height = image.width * ratio;
        }
        resolve(image);
      });
      image.src = imageUrl;
    } catch (err) {
      log(`Error loading picture: ${imageUrl} ${err}`);
      resolve(null);
    }
  });
}

async function loadGallery() {
  for (let i = 1; i < 58; i++) {
    const image = await loadImage(`samples/sample%20(${i}).jpg`);
    if (image) {
      await processImage(image);
      image.remove();
    }
  }
}

async function main() {
  await loadModels();
  await loadGallery();
  await printResults();
}

main();
