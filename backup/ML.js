/* global ml5 */

const config = { maxSize: 1500, person: false };
const models = {};
const images = [];

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function loadImage(imageUrl) {
  return new Promise((resolve) => {
    try {
      const image = new Image();
      // image.onLoad = () => {
      image.loading = 'eager';
      image.onerror = () => log(`Error loading image: ${imageUrl}`);
      image.addEventListener('load', () => {
        const ratio = image.height / image.width;
        if (image.width > config.maxSize) {
          image.width = config.maxSize;
          image.height = image.width * ratio;
        }
        if (image.height > config.maxSize) {
          image.height = config.maxSize;
          image.width = image.height / ratio;
        }
        resolve(image);
      });
      image.src = imageUrl;
    } catch (err) {
      log(`Error loading image: ${imageUrl} ${err}`);
      resolve(null);
    }
  });
}

async function loadModels() {
  log('Starting Image Analsys');
  log(`Initializing ML5/TensorFlow version ${ml5.version}`);
  log('Using WebGL for GPU acceleration');
  // tf.wasm.setWasmPath('assets/');
  log('Loading models: MobileNet-v1, DarkNet/Yolo-v3, FaceAPI...');
  const t0 = window.performance.now();
  // models.MobileNet = await ml5.imageClassifier('/models/mobilenet-v1/model.json');
  // models.MobileNet = await ml5.imageClassifier('/models/resnet-v2-50/model.json');
  // models.Yolo = await ml5.objectDetector('/models/yolo-v3/model.json');
  // models.Yolo = await ml5.objectDetector('/models/resnet-v2-50/model.json');
  models.Yolo = await ml5.featureExtractor('/models/resnet-v2-50/model.json');
  /*
  modelFaceApi = await ml5.faceApi({}, {
    withLandmarks: false,
    withDescriptors: true,
    withTinyNet: false,
    minConfidence: 0.5,
    Mobilenetv1Model: '/models/faceapi/ssd_mobilenetv1_model-weights_manifest.json',
    TinyFaceDetectorModel: '/models/faceapi/tiny_face_detector_model-weights_manifest.json',
    FaceLandmarkModel: '/models/faceapi/face_landmark_68_model-weights_manifest.json',
    FaceLandmark68TinyNet: '/models/faceapi/face_landmark_68_tiny_model-weights_manifest.json',
    FaceRecognitionModel: '/models/faceapi/face_recognition_model-weights_manifest.json',
  });
  */
  log(`Models loaded in ${(window.performance.now() - t0).toLocaleString()}ms`);
  log(`Forced image resize to max ${config.maxSize}px`);
}

async function processImage(image) {
  log(`&nbsp Processing image: ${image.src} size: ${image.width}x${image.height}`);
  try {
    const t0 = window.performance.now();
    const res = {};
    res.classified = models.MobileNet ? await models.MobileNet.classify(image) : null;
    res.detected = models.Yolo ? await models.Yolo.detect(image) : null;
    // const found = res.detected ? res.detected.find((a) => a.label === 'person') : null;
    // if (found) res.person = await modelFaceApi.detectSingle(image);
    images.push({
      image: image.src,
      time: (window.performance.now() - t0),
      classified: res.classified.filter((a) => a.confidence > 0.15),
      detected: res.detected.filter((a) => a.confidence > 0.15),
      person: res.person,
    });
  } catch (err) {
    log(`&nbsp Error processing image: ${image.src}: ${err}`);
  }
}

function printObject(objects) {
  if (!objects) return '';
  let text = '';
  const arr = Array.isArray(objects) ? objects : [objects];
  for (const obj of arr) {
    if (obj.confidence) text += `| ${(100 * obj.confidence).toFixed(2)}% ${obj.label.split(',')[0]}`;
    else text += JSON.stringify(obj);
  }
  /*
  for (const obj of arr) {
    const confidence = (obj.probability || obj.score || 0);
    const label = (obj.className || obj.class || '').split(',')[0];
    if (obj.age) text += `${(100 * (obj.gender.confidence).toFixed(2))}% ${obj.gender.label} age: ${obj.age.toFixed(1)}y emotion: ${(100 * (obj.emotion.confidence).toFixed(2))}% ${obj.emotion.label}`;
    else if (confidence > 0.15) text += `${(100 * confidence).toFixed(2)}% ${label} | `;
  }
  */
  return text;
}
async function printResults() {
  log('Printing results...');
  let text = '';
  for (const img of images) {
    text += '<div class="row">';
    text += ` <div class="col" style="height: 150px; min-width: 150px; max-width: 150px"><img src="${img.image}" width="140" height="140"></div>`;
    text += ' <div class="col">';
    text += `  <div>Image ${img.image} processed in ${img.time.toLocaleString()}ms </div>`;
    text += `  <div>Classification ${printObject(img.classified)}</div>`;
    text += `  <div>Detected ${printObject(img.detected)}</div>`;
    text += `  <div>Person ${printObject(img.person)}</div>`;
    text += ' </div>';
    text += '</div>';
  }
  document.getElementById('result').innerHTML = text;
}

async function loadGallery(count) {
  log(`Queued ${count} images for processing...`);
  const t0 = window.performance.now();
  for (let i = 1; i <= count; i++) {
    const image = await loadImage(`/samples/test%20(${i}).jpg`);
    if (image) {
      await processImage(image);
      image.remove();
    }
  }
  const t1 = window.performance.now();
  log(`Finished processed ${count} images: total: ${(t1 - t0).toLocaleString()}ms average: ${((t1 - t0) / count).toLocaleString()}ms / image`);
}

async function main() {
  await loadModels();
  await loadGallery(6); // max=93
  await printResults();
}

main();
