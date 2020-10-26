/* eslint-disable object-property-newline */

exports.models = {
  classify: [
    // { name: 'ImageNet Inception v4', modelPath: 'models/imagenet/inception-v4', tensorSize: 299, scaleScore: 200, offset: 1 },
    { name: 'ImageNet EfficientNet B4', modelPath: 'models/imagenet/efficientnet-b4', tensorSize: 380, scaleScore: 1.4 },
    { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect/inception-v3', tensorSize: 299, minScore: 0.35, scaleScore: 2000 },
  ],
  detect: [
    // { name: 'COCO SSD MobileNet v2', modelPath: 'models/coco/ssd-mobilenet-v2', minScore: 0.4 }, // fast and imprecise
    // { name: 'COCO EfficientDet D0', modelPath: 'models/coco/efficientdet-d0', minScore: 0.2 }, // tiny and good, but slow

    // { name: 'COCO EfficientDet D5', modelPath: 'models/coco/efficientdet-d5', minScore: 0.2 }, // good but very slow model
    // { name: 'COCO RetinaNet ResNet101 v1', modelPath: 'models/coco/retinanet-resnet101-v1' }, // good but slow model
    // { name: 'COCO RetinaNet ResNet152 v1', modelPath: 'models/coco/retinanet-resnet152-v1' }, // worse than RetinaNet ResNet101
    // { name: 'COCO Faster-RCNN ResNet101 v1', modelPath: 'models/coco/fasterrcnn-resnet101-v1' }, // worse than RetinaNet ResNet101, converter skip-ops required, unsupported op: BroadcastArgs
    // { name: 'COCO Faster-RCNN ResNet152 v1', modelPath: 'models/coco/fasterrcnn-resnet152-v1' }, // worse than RetinaNet ResNet101, converter skip-ops required, unsupported op: BroadcastArgs

    // { name: 'NudeNet f16', modelPath: 'models/various/nudenet/f16', minScore: 0.2,
    //  map: { boxes: 'filtered_detections/map/TensorArrayStack/TensorArrayGatherV3:0', scores: 'filtered_detections/map/TensorArrayStack_1/TensorArrayGatherV3:0', classes: 'filtered_detections/map/TensorArrayStack_2/TensorArrayGatherV3:0' } },

    // { name: 'OpenImages SSD MobileNet v2', modelPath: 'models/openimages/ssd-mobilenet-v2', minScore: 0.05, normalizeInput: 1.0 / 255,
    //   map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },

    // execution error: Size(360000) must match the product of shape 1,65504,1,4
    // { name: 'OpenImages Faster-RCNN Inception ResNet v2', modelPath: 'models/openimages/faster-rcnn-resnet-v2', minScore: 0.05, normalizeInput: 1.0 / 255,
    //   map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },

    // execution error: Size(360000) must match the product of shape 1,65504,1,4
    // { name: 'OpenImages Faster-RCNN Inception ResNet v2 Atrous', modelPath: 'models/openimages/faster-rcnn-inception-resnet-v2-atrous-v4',
    //  map: { boxes: 'detection_boxes:0', scores: 'detection_scores:0', classes: 'detection_classes:0' } },

    // execution error: All tensors passed to tf.addN() must have the same shape
    // { name: 'COCO CenterNet ResNet50-v2', modelPath: 'models/coco/centernet-resnet50-v2', minScore: 0.1,
    //  map: { boxes: 'Identity:0', scores: 'Identity_2:0', classes: 'Identity_1:0' } },
  ],
  person: [
    { name: 'FaceAPI SSD/MobileNet v1', modelPath: 'models/faceapi/', exec: 'ssd', score: 0.3, topK: 5, size: 416 },
  ],
  various: [
    { name: 'Food', modelPath: 'models/various/food', minScore: 0.4, tensorSize: 192, scaleScore: 500 },
    { name: 'Wine', modelPath: 'models/various/wine', minScore: 0.3, tensorSize: 224, scaleScore: 0.5, softmax: false },
    { name: 'Products', modelPath: 'models/various/products', minScore: 0.3, tensorSize: 224, scaleScore: 0.5, softmax: false },
    { name: 'Inception', modelPath: 'models/various/metropolitan', minScore: 0.3, tensorSize: 299, scaleScore: 200 },
  ],
};

/*
general options:
  modelPath: <url> // url to model, with or without /model.json, also supports loading from tfhub
  classes: <url> // set to url or leave as null to load classes.json from modelPath
  minScore: 0..1 // minimum score that prediction has to achieve
  scaleScore: 1, // use if scores are off by order of magniture
  maxResults: 1..maxInt // how many results to return
  normalizeInput: 1, // value:(1) = range:(0..255), value=(1/255) = range:(0..1), value:(-1 + 1/127.5) = range:(-1..1)
  sofmax: boolean // normalize scores using softmax function
classify options
  modelType: 'graph' or 'layers',
  tensorSize: 224, // required
  offset: 0, // offset predictions by
  background: -1, // exclude prediction id from results
detect options:
  iouThreshold: 0.5, // used by nms
  scaleOutput: false, // use if output coordinates are 0..1 instead of 0..width
  map: { boxes: 'Identity_1:0', scores: 'Identity_4:0', classes: 'Identity_2:0' }, // defaults map to tfhub object detection models
*/
