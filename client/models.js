/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

const models = {};
exports.models = models;

models.classify = [
  { name: 'ImageNet Inception v4', modelPath: 'models/openimages-inception-v4/model.json', score: 0.22, topK: 3, tensorSize: 299, scoreScale: 200, offset: 1, classes: 'assets/ImageNet-Labels1000.json' },
  { name: 'ImageNet EfficientNet B5', modelPath: 'models/openimages-efficientnet-b5/model.json', score: 0.2, topK: 3, tensorSize: 456, scoreScale: 1, offset: 0, classes: 'assets/ImageNet-Labels1000.json' },
  { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect-inception-v3/model.json', score: 0.1, topK: 5, tensorSize: 299, scoreScale: 1000, offset: 0, classes: 'assets/DeepDetect-Labels.json' },
  { name: 'NSFW Inception v3 Quant', modelPath: 'models/nsfw-inception-v3-quant/model.json', score: 0.7, topK: 4, tensorSize: 299, scoreScale: 2, offset: 0, background: 2, modelType: 'layers', classes: 'assets/NSFW-Labels.json' },
];

models.detect = [
  { name: 'CoCo SSD/MobileNet v2', modelPath: 'models/ssd-mobilenet-coco-v2/model.json', score: 0.4, topK: 6, overlap: 0.5, useFloat: false, exec: 'coco', classes: 'assets/Coco-Labels.json' },
  { name: 'OpenImages SSD/MobileNet v2', modelPath: 'models/ssd-mobilenet-openimages-v4/model.json', score: 0.2, topK: 6, useFloat: true, exec: 'ssd', classes: 'assets/OpenImage-Labels.json' },
];

models.person = [
  { name: 'FaceAPI TinyYolo', modelPath: 'models/faceapi/', score: 0.3, topK: 1, size: 416 },
];

models.classify_inactive = [
  { name: 'ImageNet-21k BiT-S R101x1', modelPath: 'models/bit-s-r101x1/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 224, offset: 1, classes: 'assets/ImageNet-Labels21k.json' },
  { name: 'ImageNet-21k BiT-M R101x1', modelPath: 'models/bit-m-r101x1/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 224, offset: 1, classes: 'assets/ImageNet-Labels21k.json' },
  { name: 'ImageNet EfficientNet B0', modelPath: 'models/efficientnet-b0/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 224, offset: 0 },
  { name: 'ImageNet EfficientNet B4', modelPath: 'models/efficientnet-b4/model.json', score: 0.1, topK: 3, slice: 0, tensorSize: 380, offset: 0 },
  { name: 'ImageNet EfficientNet B7', modelPath: 'models/efficientnet-b7/model.json', score: 0.2, topK: 3, slice: 0, tensorSize: 600, offset: 0 },
  { name: 'ImageNet ResNet v2-50', modelPath: 'models/resnet-v2-50/model.json', score: 0.2, topK: 3, tensorSize: 224 },
  { name: 'ImageNet ResNet v2-101', modelPath: 'models/resnet-v2-101/model.json', score: 0.2, topK: 3 },
  { name: 'ImageNet Inception-ResNet v2', modelPath: '/models/inception-resnet-v2/model.json', score: 0.2, topK: 3, tensorSize: 224 },
  { name: 'ImageNet NASNet-A Mobile', modelPath: 'models/nasnet-mobile/model.json', score: 0.2, topK: 3, slice: 0 },
  { name: 'ImageNet Inception v3', modelPath: 'models/inception-v3/model.json', score: 0.2, topK: 3 },
  { name: 'iNaturalist Food MobileNet v1', modelPath: 'models/inaturalist/food/model.json', score: 0.38, scoreScale: 500, topK: 1, tensorSize: 192, classes: 'assets/iNaturalist-Food-Labels.json', offset: 0 },
  { name: 'iNaturalist Plants MobileNet v2', modelPath: 'models/inaturalist/plants/model.json', score: 0.2, scoreScale: 200, topK: 1, tensorSize: 224, classes: 'assets/iNaturalist-Plants-Labels.json', offset: 0, background: 2101 },
  { name: 'iNaturalist Birds MobileNet v2', modelPath: 'models/inaturalist/birds/model.json', score: 0.25, scoreScale: 200, topK: 1, tensorSize: 224, classes: 'assets/iNaturalist-Birds-Labels.json', offset: 0, background: 964 },
  { name: 'iNaturalist Insects MobileNet v2', modelPath: 'models/inaturalist/insects/model.json', score: 0.3, scoreScale: 200, topK: 1, tensorSize: 224, classes: 'assets/iNaturalist-Insects-Labels.json', offset: 0, background: 1021 },
  { name: 'NSFW MobileNet v2', modelPath: 'models/nsfw-mobilenet-v2/model.json', score: 0.1, topK: 4, tensorSize: 244, offset: 0, modelType: 'graph', classes: 'assets/NSFW-Labels.json' },
  { name: 'NSFW Inception v3', modelPath: 'models/nsfw-inception-v3/model.json', score: 0.7, topK: 4, scoreScale: 2, tensorSize: 299, offset: 0, modelType: 'layers', classes: 'assets/NSFW-Labels.json' },
  { name: 'NSFW Mini', modelPath: 'models/nsfw-mini/model.json', score: 0.7, topK: 4, scoreScale: 2, slice: 0, tensorSize: 244, offset: 0, modelType: 'layers', classes: 'assets/NSFW-Labels.json' },
  { name: 'Places365 VGG16 Standard', modelPath: 'models/places365-vgg16-notop/model.json', modelType: 'layers', scoreScale: 100, classes: 'assets/Places365-Standard-Labels.json' },
  { name: 'ImageNet MobileNet v1', modelPath: 'models/mobilenet-v1/model.json', score: 0.2, topK: 3 },
  { name: 'ImageNet MobileNet v2', modelPath: 'models/mobilenet-v2/model.json', score: 0.2, topK: 3 },
  { name: 'ImageNet Inception v1', modelPath: 'models/inception-v1/model.json', score: 0.2, topK: 3 },
  { name: 'ImageNet Inception v2', modelPath: 'models/inception-v2/model.json', score: 0.2, topK: 3 },
];

models.detect_inactive = [
  { name: 'CoCo SSD v1', modelPath: 'models/cocossd-v1/model.json', score: 0.4, topK: 6, overlap: 0.5, exec: 'coco' },
  { name: 'CoCo DarkNet/Yolo v1 Tiny', modelPath: 'models/yolo-v1-tiny/model.json', score: 0.4, topK: 6, overlap: 0.5, modelType: 'layers' },
  { name: 'CoCo DarkNet/Yolo v2 Tiny', modelPath: 'models/yolo-v2-tiny/model.json', score: 0.4, topK: 6, overlap: 0.5, modelType: 'layers' },
  { name: 'CoCo DarkNet/Yolo v3 Tiny', modelPath: 'models/yolo-v3-tiny/model.json', score: 0.4, topK: 6, overlap: 0.5, modelType: 'layers' },
  { name: 'CoCo DarkNet/Yolo v3 Full', modelPath: 'models/yolo-v3-full/model.json', score: 0.4, topK: 6, overlap: 0.5, modelType: 'layers' },
  { name: 'OpenImages RCNN/Inception-ResNet v2', modelPath: 'models/rcnn-inception-resnet-v2/model.json', score: 0.2, topK: 6, classes: 'assets/OpenImage-Labels.json', exec: 'ssd' },
];

models.person_inactive = [
  { name: 'FaceAPI SSD/MobileNet v1', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'ssdMobilenetv1' },
  { name: 'FaceAPI MTCNN', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'mtcnn' },
  { name: 'FaceAPI Yolo v2', modelPath: 'models/faceapi/', score: 0.5, topK: 1, type: 'tinyYolov2' },
];
