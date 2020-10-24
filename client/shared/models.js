/* eslint-disable object-property-newline */

exports.models = {
  classify: [
    { name: 'ImageNet Inception v4', modelPath: 'models/graph/imagenet-inception-v4', score: 0.22, topK: 3, tensorSize: 299, scoreScale: 200, offset: 1 },
    { name: 'ImageNet EfficientNet B4', modelPath: 'models/graph/imagenet-efficientnet-b4', score: 0.1, topK: 3, tensorSize: 380, offset: 0 },
    { name: 'DeepDetect Inception v3', modelPath: 'models/graph/deepdetect-inception-v3', score: 0.1, topK: 5, tensorSize: 299, scoreScale: 1000, offset: 0 },
  ],
  detect: [
    // { name: 'COCO SSD MobileNet v2', modelPath: 'models/graph/coco-ssd-mobilenet-v2', minScore: 0.4 }, // fast and imprecise
    // { name: 'COCO RetinaNet ResNet101 v1', modelPath: 'models/graph/coco-retinanet-resnet101-v1' }, // good but slow model

    // { name: 'COCO RetinaNet ResNet152 v1', modelPath: 'models/graph/coco-retinanet-resnet152-v1' }, // worse than RetinaNet ResNet101
    // { name: 'COCO Faster-RCNN ResNet101 v1', modelPath: 'models/graph/coco-fasterrcnn-resnet101-v1' }, // worse than RetinaNet ResNet101, converter skip-ops required, unsupported op: BroadcastArgs
    // { name: 'COCO Faster-RCNN ResNet152 v1', modelPath: 'models/graph/coco-fasterrcnn-resnet152-v1' }, // worse than RetinaNet ResNet101, converter skip-ops required, unsupported op: BroadcastArgs

    // { name: 'OpenImages SSD MobileNet v2', modelPath: 'models/graph/openimages-faster-rcnn-resnet-v2', scaleScore: 8, // working, but pretty bad
    //   map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },

    // { name: 'OpenImages Faster-RCNN Inception ResNet v2', modelPath: 'models/graph/openimages-ssd-mobilenet-v2', scaleScore: 8, // working, but pretty bad
    //  map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },

    { name: 'NudeNet', modelPath: 'models/graph/nudenet', // execute error: Size(442368) must match the product of shape 65504,4
      map: { boxes: 'filtered_detections/map/TensorArrayStack/TensorArrayGatherV3:0', scores: 'filtered_detections/map/TensorArrayStack_1/TensorArrayGatherV3:0', classes: 'filtered_detections/map/TensorArrayStack_2/TensorArrayGatherV3:0' } },

    // { name: 'OpenImages Faster-RCNN Inception ResNet v2 Atrous', modelPath: 'models/graph/openimages-faster-rcnn-inception-resnet-v2-atrous-v4',
    //  map: { boxes: 'detection_boxes:0', scores: 'detection_scores:0', classes: 'detection_classes:0' } },
    // { name: 'COCO Faster-RCNN Inception-ResNet v2', modelPath: 'models/graph/coco-fasterrcnn-inception-resnet-v2' }, // Cannot read property 'children' of undefined
    // coco-centernet-*
    // coco-efficientdet-*
  ],
  person: [
    { name: 'FaceAPI SSD/MobileNet v1', modelPath: 'models/faceapi/', exec: 'ssd', score: 0.3, topK: 5, size: 416 },
  ],
  video: {
    imagenet: { name: 'ImageNet EfficientNet B0', modelPath: 'models/imagenet-efficientnet-b0', score: 0.2, topK: 3, tensorSize: 299, scoreScale: 1, offset: 0 },
    deepdetect: { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect-inception-v3-f16', score: 0.1, topK: 5, tensorSize: 299, scoreScale: 1200, offset: 0 },
    nsfw: { name: 'NSFW Inception v3', modelPath: 'models/nsfw-inception-v3-quant', score: 0.7, topK: 4, tensorSize: 299, scoreScale: 2.5, offset: 0, background: 2, modelType: 'layers' },
    food: { name: 'iNaturalist Food', modelPath: 'models/inaturalist/food', score: 0.5, topK: 1, tensorSize: 192, scoreScale: 600, offset: 0, modelType: 'graph' },
    plants: { name: 'iNaturalist Plants', modelPath: 'models/inaturalist/plants', score: 0.5, tensorSize: 224, scoreScale: 1000, topK: 1, offset: 0, background: 2101, modelType: 'graph' },
    birds: { name: 'iNaturalist Birds', modelPath: 'models/inaturalist/birds', score: 0.5, tensorSize: 224, scoreScale: 500, topK: 1, offset: 0, background: 964, modelType: 'graph' },
    insects: { name: 'iNaturalist Insects', modelPath: 'models/inaturalist/insects', score: 0.5, tensorSize: 224, scoreScale: 800, topK: 1, offset: 0, background: 1021, modelType: 'graph' },
  },
};
