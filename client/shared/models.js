exports.models = {
  classify: [
    { name: 'ImageNet Inception v4', modelPath: 'models/graph/imagenet-inception-v4', score: 0.22, topK: 3, tensorSize: 299, scoreScale: 200, offset: 1 },
    { name: 'ImageNet EfficientNet B4', modelPath: 'models/graph/imagenet-efficientnet-b4', score: 0.1, topK: 3, tensorSize: 380, offset: 0 },
    { name: 'DeepDetect Inception v3', modelPath: 'models/graph/deepdetect-inception-v3', score: 0.1, topK: 5, tensorSize: 299, scoreScale: 1000, offset: 0 },
  ],
  detect: [
    { name: 'CoCo SSD/MobileNet v2', modelPath: 'models/graph/coco-ssd-mobilenet-v2', normalizeInput: 1, scaleOutput: true, scaleScore: 1, maxResults: 50, iouThreshold: 0.5, minScore: 0.1 },
    // { name: 'CoCo CenterNet ResNet50 v2', modelPath: 'models/graph/coco-centernet-resnet-50-v2', normalizeInput: 1 / 255, scaleOutput: false, scaleScore: 1, maxResults: 50, iouThreshold: 0.5, minScore: 0.1 },
    // { name: 'CoCo EfficientDet D4', modelPath: 'models/graph/coco-efficientdet-d0', normalizeInput: 1 / 255, scaleOutput: false, scaleScore: 1, maxResults: 50, iouThreshold: 0.5, minScore: 0.1 },
    // { name: OpenImages SSD/MobileNet v2
    // { name: OpenImages FasterRCNN Inception ResNet v2 Atrous
  ],
  person: [
    { name: 'FaceAPI SSD/MobileNet v1', modelPath: 'models/faceapi/', exec: 'ssd', score: 0.3, topK: 5, size: 416 },
  ],
  video: {
    detect: { name: 'CoCo SSD/MobileNet v2', modelPath: 'models/coco-ssd-mobilenet-v2', score: 0.25, topK: 5, overlap: 0.1, useFloat: false, exec: 'coco' },
    imagenet: { name: 'ImageNet EfficientNet B0', modelPath: 'models/imagenet-efficientnet-b0', score: 0.2, topK: 3, tensorSize: 299, scoreScale: 1, offset: 0 },
    deepdetect: { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect-inception-v3-f16', score: 0.1, topK: 5, tensorSize: 299, scoreScale: 1200, offset: 0 },
    nsfw: { name: 'NSFW Inception v3', modelPath: 'models/nsfw-inception-v3-quant', score: 0.7, topK: 4, tensorSize: 299, scoreScale: 2.5, offset: 0, background: 2, modelType: 'layers' },
    food: { name: 'iNaturalist Food', modelPath: 'models/inaturalist/food', score: 0.5, topK: 1, tensorSize: 192, scoreScale: 600, offset: 0, modelType: 'graph' },
    plants: { name: 'iNaturalist Plants', modelPath: 'models/inaturalist/plants', score: 0.5, tensorSize: 224, scoreScale: 1000, topK: 1, offset: 0, background: 2101, modelType: 'graph' },
    birds: { name: 'iNaturalist Birds', modelPath: 'models/inaturalist/birds', score: 0.5, tensorSize: 224, scoreScale: 500, topK: 1, offset: 0, background: 964, modelType: 'graph' },
    insects: { name: 'iNaturalist Insects', modelPath: 'models/inaturalist/insects', score: 0.5, tensorSize: 224, scoreScale: 800, topK: 1, offset: 0, background: 1021, modelType: 'graph' },
  },
};
