/* eslint-disable no-multi-spaces */

const config = {
  // General configuration
  backEnd: 'webgl',        // back-end used by tensorflow for image processing, can be webgl, cpu, wasm
  maxSize: 780,            // maximum image width or height that will be used for processing before resizing is required
  renderThumbnail: 230,    // resolution in which to store image thumbnail embedded in result set
  listThumbnail: 130,      // initial resolution in which to render stored thumbnail in gallery list view
  batchProcessing: 1,      // how many images to process in parallel
  squareImage: false,      // resize proportional to the original image or to a square image
  floatPrecision: false,    // use float32 or float16 for WebGL tensors

  // Default models
  classify: { name: 'Inception v3', modelPath: 'models/inception-v3/model.json', score: 0.2, topK: 3 },
  alternative: { name: 'MobileNet v2', modelPath: '/models/mobilenet-v2/model.json', score: 0.2, topK: 3 },
  detect: { name: 'Coco/SSD v2', modelPath: 'models/cocossd-v2/model.json', score: 0.4, topK: 6, overlap: 0.1 },
  person: { name: 'FaceAPI SSD', modelPath: 'models/faceapi/', score: 0.4, topK: 4, type: 'ssdMobilenetv1' },

  // alternative classification models - you can pick none of one
  /*
  classify: { name: 'MobileNet v1', modelPath: '/models/mobilenet-v1/model.json' },
  classify: { name: 'MobileNet v2', modelPath: '/models/mobilenet-v2/model.json' },
  classify: { name: 'Inception v1', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v1/classification/3/default/1' },
  classify: { name: 'Inception v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/inception_v2/classification/3/default/1' },
  classify: { name: 'Inception v3', modelPath: '/models/inception-v3/model.json' },
  classify: { name: 'Inception ResNet v2', modelPath: '/models/inception-resnet-v2/model.json' },
  classify: { name: 'ResNet v2', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/resnet_v2_101/classification/3/default/1' },
  classify: { name: 'NasNet Mobile', modelPath: 'https://tfhub.dev/google/tfjs-model/imagenet/nasnet_mobile/classification/3/default/1' },
  */

  // alternative detect models: enable darknet/yolo model in a separate module - you can pick none, enable coco/ssd-v2 or enable darknet/yolo (not js module is initialized by default)
  // detect: { name: 'Coco/SSD v2', modelPath: 'models/cocossd-v2/model.json', score: 0.4, topK: 6, overlap: 0.1 },

  // alternative face-api models - you can pick none or one of following
  /*
  person: { name: 'FaceAPI SSD', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'ssdMobilenetv1' },
  person: { name: 'FaceAPI Yolo', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyYolov2' },
  person: { name: 'FaceAPI Tiny', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyFaceDetector' },
  person: { name: 'FaceAPI MTCNN', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'mtcnn' },
  */
};

export default config;
