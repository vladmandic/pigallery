/* eslint-disable object-property-newline */

exports.models = {
  classify: [
    { name: 'ImageNet Inception v4', modelPath: 'models/imagenet/inception-v4', score: 0.22, topK: 3, tensorSize: 299, scoreScale: 200, offset: 1 },
    { name: 'ImageNet EfficientNet B4', modelPath: 'models/imagenet/efficientnet-b4', score: 0.1, topK: 3, tensorSize: 380, offset: 0 },
    { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect/inception-v3', score: 0.1, topK: 5, tensorSize: 299, scoreScale: 1000, offset: 0 },
    // { name: 'Food MobileNet v1', modelPath: 'models/various/food', score: 0.5, topK: 1, tensorSize: 192, scoreScale: 600, offset: 0 },
    // { name: 'OnDeviceVision Wine', modelPath: 'models/various/wine', score: 0.5, topK: 1, tensorSize: 192, scoreScale: 600, offset: 0 },
    // { name: 'OnDeviceVision Products', modelPath: 'models/various/products', score: 0.5, topK: 1, tensorSize: 192, scoreScale: 600, offset: 0 },
    // { name: 'iMetropolitan Inception v4', modelPath: 'models/various/metropolitan', score: 0.5, topK: 1, tensorSize: 192, scoreScale: 600, offset: 0 },
  ],
  detect: [
    { name: 'COCO SSD MobileNet v2', modelPath: 'models/coco/ssd-mobilenet-v2', minScore: 0.4 }, // fast and imprecise
    { name: 'COCO EfficientDet D0', modelPath: 'models/coco/efficientdet-d0', minScore: 0.2 }, // tiny and good, but slow
    // { name: 'COCO CenterNet ResNet50-v2', modelPath: 'models/coco/centernet-resnet50-v2', minScore: 0.1, // execution error: All tensors passed to tf.addN() must have the same shape
    //  map: { boxes: 'Identity:0', scores: 'Identity_2:0', classes: 'Identity_1:0' } },

    // { name: 'COCO EfficientDet D5', modelPath: 'models/coco/efficientdet-d5', minScore: 0.2 }, // good but very slow model
    // { name: 'COCO RetinaNet ResNet101 v1', modelPath: 'models/coco/retinanet-resnet101-v1' }, // good but slow model
    // { name: 'COCO RetinaNet ResNet152 v1', modelPath: 'models/coco/retinanet-resnet152-v1' }, // worse than RetinaNet ResNet101
    // { name: 'COCO Faster-RCNN ResNet101 v1', modelPath: 'models/coco/fasterrcnn-resnet101-v1' }, // worse than RetinaNet ResNet101, converter skip-ops required, unsupported op: BroadcastArgs
    // { name: 'COCO Faster-RCNN ResNet152 v1', modelPath: 'models/coco/fasterrcnn-resnet152-v1' }, // worse than RetinaNet ResNet101, converter skip-ops required, unsupported op: BroadcastArgs

    // { name: 'OpenImages SSD MobileNet v2', modelPath: 'models/graph/openimages-faster-rcnn-resnet-v2', scaleScore: 8, // working, but pretty bad
    //   map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },

    // { name: 'OpenImages Faster-RCNN Inception ResNet v2', modelPath: 'models/graph/openimages-ssd-mobilenet-v2', scaleScore: 8, // working, but pretty bad
    //  map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },

    // { name: 'NudeNet', modelPath: 'models/graph/nudenet', // execution error: Size(442368) must match the product of shape 65504,4
    //  map: { boxes: 'filtered_detections/map/TensorArrayStack/TensorArrayGatherV3:0', scores: 'filtered_detections/map/TensorArrayStack_1/TensorArrayGatherV3:0', classes: 'filtered_detections/map/TensorArrayStack_2/TensorArrayGatherV3:0' } },

    // { name: 'OpenImages Faster-RCNN Inception ResNet v2 Atrous', modelPath: 'models/graph/openimages-faster-rcnn-inception-resnet-v2-atrous-v4', // execution error: Size(360000) must match the product of shape 1,65504,1,4
    //  map: { boxes: 'detection_boxes:0', scores: 'detection_scores:0', classes: 'detection_classes:0' } },
  ],
  person: [
    { name: 'FaceAPI SSD/MobileNet v1', modelPath: 'models/faceapi/', exec: 'ssd', score: 0.3, topK: 5, size: 416 },
  ],
};
