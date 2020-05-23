/* eslint-disable no-multi-spaces */

const config = {
  // General configuration
  backEnd: 'webgl',        // back-end used by tensorflow for image processing, can be webgl, cpu, wasm
  maxSize: 780,            // maximum image width or height that will be used for processing before resizing is required
  renderThumbnail: 230,    // resolution in which to store image thumbnail embedded in result set
  batchProcessing: 1,      // how many images to process in parallel
  squareImage: false,      // resize proportional to the original image or to a square image
  floatPrecision: false,   // use float32 or float16 for WebGL tensors
  registerPWA: false,      // register PWA service worker?

  // Default models
  classify: { name: 'Inception v3', modelPath: 'models/inception-v3/model.json', score: 0.2, topK: 3 },
  alternative: { name: 'MobileNet v2', modelPath: '/models/mobilenet-v2/model.json', score: 0.2, topK: 3 },
  detect: { name: 'Coco/SSD v2', modelPath: 'models/cocossd-v2/model.json', score: 0.4, topK: 6, overlap: 0.1 },
  person: { name: 'FaceAPI SSD', modelPath: 'models/faceapi/', score: 0.4, topK: 4, type: 'ssdMobilenetv1' },

  /*
  models that can be used for "classify" and "alternative" can be found at
    https://tfhub.dev/s?deployment-format=tfjs&module-type=image-classification&tf-version=tf2
  or just pick one from below
    classify: { name: 'MobileNet v1', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v1_100_224/classification/3/default/1' },
    classify: { name: 'MobileNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1' },
    classify: { name: 'Inception v1', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v1/classification/3/default/1' },
    classify: { name: 'Inception v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v2/classification/3/default/1' },
    classify: { name: 'Inception v3', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v3/classification/3/default/1' },
    classify: { name: 'Inception ResNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_resnet_v2/classification/3/default/1' },
    classify: { name: 'ResNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/resnet_v2_101/classification/3/default/1' },
    classify: { name: 'NasNet Mobile', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/nasnet_mobile/classification/3/default/1' },
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

export default config;
