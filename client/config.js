/* eslint-disable no-multi-spaces */

// eslint-disable-next-line no-unused-vars
const modelClassify = require('./modelClassify.js');
// eslint-disable-next-line no-unused-vars
const modelDetect = require('./modelDetect.js');

window.debug = false;

// user configurable options, stored in browsers local storage
window.options = {
  get listItemCount() { return parseInt(localStorage.getItem('listItemCount') || 500, 10); },
  set listItemCount(val) { return localStorage.setItem('listItemCount', val); },
  get listFolders() { return localStorage.getItem('listFolders') ? localStorage.getItem('listFolders') === 'true' : true; },
  set listFolders(val) { return localStorage.setItem('listFolders', val); },
  get listDetails() { return localStorage.getItem('listDetails') ? localStorage.getItem('listDetails') === 'true' : true; },
  set listDetails(val) { return localStorage.setItem('listDetails', val); },
  get listDivider() { return localStorage.getItem('listDivider') || 'month'; },
  set listDivider(val) { return localStorage.setItem('listDivider', val); },
  get listSortOrder() { return localStorage.getItem('listSortOrder') || 'numeric-down'; },
  set listSortOrder(val) { return localStorage.setItem('listSortOrder', val); },
  get listThumbSize() { return parseInt(localStorage.getItem('listThumbSize') || 165, 10); },
  set listThumbSize(val) { return localStorage.setItem('listThumbSize', val); },
  get listLimit() { return parseInt(localStorage.getItem('listLimit') || 10000, 10); },
  set listLimit(val) { return localStorage.setItem('listLimit', val); },
  get viewDetails() { return localStorage.getItem('viewDetails') ? localStorage.getItem('viewDetails') === 'true' : true; },
  set viewDetails(val) { return localStorage.setItem('viewDetails', val); },
  get viewBoxes() { return localStorage.getItem('viewBoxes') ? localStorage.getItem('viewBoxes') === 'true' : true; },
  set viewBoxes(val) { return localStorage.setItem('viewBoxes', val); },
  get viewFaces() { return localStorage.getItem('viewFaces') ? localStorage.getItem('viewFaces') === 'true' : true; },
  set viewFaces(val) { return localStorage.setItem('viewFaces', val); },
  get viewRaw() { return localStorage.getItem('viewRaw') ? localStorage.getItem('viewRaw') === 'true' : false; },
  set viewRaw(val) { return localStorage.setItem('viewRaw', val); },
  get liveLoad() { return localStorage.getItem('liveLoad') ? localStorage.getItem('liveLoad') === 'true' : false; },
  set liveLoad(val) { return localStorage.setItem('liveLoad', val); },
  get dateShort() { return localStorage.getItem('dateShort') || 'YYYY/MM/DD'; },
  set dateShort(val) { return localStorage.setItem('dateShort', val); },
  get dateLong() { return localStorage.getItem('dateLong') || 'dddd, MMMM Do, YYYY'; },
  set dateLong(val) { return localStorage.setItem('dateLong', val); },
  get dateDivider() { return localStorage.getItem('dateDivider') || 'MMMM YYYY'; },
  set dateDivider(val) { return localStorage.setItem('dateDivider', val); },
  get fontSize() { return localStorage.getItem('fontSize') || '14px'; },
  set fontSize(val) { return localStorage.setItem('fontSize', val); },
  get slideDelay() { return parseInt(localStorage.getItem('slidedelay') || 2500, 10); },
  set slideDelay(val) { return localStorage.setItem('slidedelay', val); },
  get topClasses() { return parseInt(localStorage.getItem('slidedelay') || 25, 10); },
  set topClasses(val) { return localStorage.setItem('slidedelay', val); },
  get listDetailsWidth() { return parseFloat(localStorage.getItem('listDetailsWidth') || 0.25); },
  set listDetailsWidth(val) { return localStorage.setItem('listDetailsWidth', val); },
  get mapColor() { return localStorage.getItem('mapColor') || 'dark'; },
  set mapColor(val) { return localStorage.setItem('dark', val); },
};

// TFJS Configuration
const config = {
  backEnd: 'webgl',        // back-end used by tensorflow for image processing, can be webgl, cpu, wasm
  floatPrecision: true,    // use 32bit or 16bit float precision
  maxSize: 780,            // maximum image width or height that will be used for processing before resizing is required
  renderThumbnail: 230,    // resolution in which to store image thumbnail embedded in result set
  batchProcessing: 1,      // how many images to process in parallel
  squareImage: false,      // resize proportional to the original image or to a square image
  registerPWA: true,      // register PWA service worker?

  // Default models
  classify: [
    { name: 'ImageNet Inception v4', modelPath: 'models/inception-v4/model.json', score: 0.22, topK: 3, useFloat: false, tensorSize: 299, scoreScale: 200 },
    { name: 'ImageNet EfficientNet B4', modelPath: 'models/efficientnet-b4/model.json', score: 0.1, topK: 3, slice: 0, tensorSize: 380, offset: 0, scoreScale: 1 },
    { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect-6k/model.json', score: 0.1, topK: 5, useFloat: false, tensorSize: 299, scoreScale: 1000, classes: 'assets/DeepDetect-Labels.json', offset: 0 },
  ],
  detect: [
    { name: 'CoCo SSD v2', modelPath: 'models/cocossd-v2/model.json', score: 0.4, topK: 6, overlap: 0.5, exec: modelDetect.detectCOCO },
    { name: 'OpenImages SSD/MobileNet v2', modelPath: 'models/ssd-mobilenet-v2/model.json', score: 0.2, topK: 6, useFloat: true, classes: 'assets/OpenImage-Labels.json', exec: modelDetect.detectSSD },
  ],
  person: { name: 'FaceAPI TinyYolo', modelPath: 'models/faceapi/', type: 'tinyFaceDetector', score: 0.3, size: 416 },

  /*
  models that can be used for "classify" can be found at
    https://tfhub.dev/s?deployment-format=tfjs&module-type=image-classification&tf-version=tf2
  or just pick one from below
    { name: 'Inception v3', modelPath: 'models/inception-v3/model.json', score: 0.2, topK: 3, tensorSize: 224, offset: 1 },
    { name: 'Inception v4', modelPath: 'models/inception-v4/model.json', score: 0.2, topK: 3, useFloat: false, tensorSize: 299, scoreScale: 200 },
    { name: 'EfficientNet B5', modelPath: 'models/efficientnet-b5/model.json', score: 0.1, topK: 3, tensorSize: 456, offset: 0, scoreScale: 1 },
    { name: 'MobileNet v1', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v1_100_224/classification/3/default/1' },
    { name: 'MobileNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1' },
    { name: 'Inception v1', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v1/classification/3/default/1' },
    { name: 'Inception v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v2/classification/3/default/1' },
    { name: 'Inception v3', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v3/classification/3/default/1' },
    { name: 'Inception ResNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_resnet_v2/classification/3/default/1' },
    { name: 'ResNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/resnet_v2_101/classification/3/default/1' },
    { name: 'NasNet Mobile', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/nasnet_mobile/classification/3/default/1' },
  */

  /*
  models that can be used for "detect" can be found at
    https://tfhub.dev/s?deployment-format=tfjs&module-type=image-object-detection
  or just pick one from below
    detect: { name: 'Coco/SSD v1', modelPath: 'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v1/1/default/1', score: 0.4, topK: 6, overlap: 0.1 },
    detect: { name: 'Coco/SSD v2', modelPath: 'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1', score: 0.4, topK: 6, overlap: 0.1 },
  or enable darknet/yolo model in a separate module (js module is not initialized by default)
  */

  /*
  models that can be used for "person" are
    person: { name: 'FaceAPI SSD', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'ssdMobilenetv1' },
    person: { name: 'FaceAPI Yolo', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyYolov2' },
    person: { name: 'FaceAPI Tiny', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyFaceDetector' },
    person: { name: 'FaceAPI MTCNN', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'mtcnn' },
  */
};

exports.default = config;
