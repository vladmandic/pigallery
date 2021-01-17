/* eslint-disable object-property-newline */

exports.models = {
  classify: [
    // { name: 'ImageNet Inception v4', modelPath: 'models/imagenet/inception-v4', tensorSize: 299, scaleScore: 200, offset: 1 }, // beaten by efficientnet-b4 by small margin
    { name: 'ImageNet EfficientNet B4', modelPath: 'models/imagenet/efficientnet-b4', tensorSize: 380, minScore: 0.35, scaleScore: 1 },
    { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect/inception-v3', tensorSize: 299, minScore: 0.35, scaleScore: 2000 },
  ],
  detect: [
    // { name: 'COCO EfficientDet D0', modelPath: 'models/coco/efficientdet-d0', minScore: 0.2, scaleOutput: true },
    // { name: 'COCO EfficientDet D1', modelPath: 'models/coco/efficientdet-d1', minScore: 0.2, scaleOutput: true },
    // { name: 'COCO EfficientDet D2', modelPath: 'models/coco/efficientdet-d2', minScore: 0.2, scaleOutput: true },
    // { name: 'COCO EfficientDet D3', modelPath: 'models/coco/efficientdet-d3', minScore: 0.2, scaleOutput: true, maxResults: 20 },
    // { name: 'COCO EfficientDet D4', modelPath: 'models/coco/efficientdet-d4', minScore: 0.2, scaleOutput: true },
    // { name: 'COCO EfficientDet D5', modelPath: 'models/coco/efficientdet-d5', minScore: 0.2, scaleOutput: true },
    // { name: 'COCO EfficientDet D6', modelPath: 'models/coco/efficientdet-d6', minScore: 0.2, scaleOutput: true },
    // { name: 'COCO EfficientDet D7', modelPath: 'models/coco/efficientdet-d7', minScore: 0.2, scaleOutput: true },
    { name: 'COCO SSD MobileNet v2', modelPath: 'models/coco/ssd-mobilenet-v2', minScore: 0.4, scaleOutput: true, maxResults: 20 }, // fast and imprecise
    // { name: 'COCO RetinaNet ResNet101 v1', modelPath: 'models/coco/retinanet-resnet101-v1' }, // good but slow model
    // { name: 'COCO RetinaNet ResNet152 v1', modelPath: 'models/coco/retinanet-resnet152-v1' }, // worse than RetinaNet ResNet101
    // { name: 'COCO Faster-RCNN ResNet101 v1', modelPath: 'models/coco/fasterrcnn-resnet101-v1' }, // worse than RetinaNet ResNet101, converter skip-ops required, unsupported op: BroadcastArgs
    // { name: 'COCO Faster-RCNN ResNet152 v1', modelPath: 'models/coco/fasterrcnn-resnet152-v1' }, // worse than RetinaNet ResNet101, converter skip-ops required, unsupported op: BroadcastArgs

    { name: 'NudeNet f16', modelPath: 'models/various/nudenet/f16', minScore: 0.3, postProcess: 'nsfw', switchAxis: true,
      map: { boxes: 'filtered_detections/map/TensorArrayStack/TensorArrayGatherV3:0', scores: 'filtered_detections/map/TensorArrayStack_1/TensorArrayGatherV3:0', classes: 'filtered_detections/map/TensorArrayStack_2/TensorArrayGatherV3:0' } },

    { name: 'OpenImages SSD MobileNet v2', modelPath: 'models/openimages/ssd-mobilenet-v2', minScore: 0.15, normalizeInput: 1.0 / 255, maxResults: 20,
      map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },

    // { name: 'OpenImages Faster-RCNN Inception ResNet v2', modelPath: 'models/openimages/faster-rcnn-resnet-v2', minScore: 0.05, normalizeInput: 1.0 / 255,
    //   map: { boxes: 'module_apply_default/hub_input/strided_slice:0', scores: 'module_apply_default/hub_input/strided_slice_1:0', classes: 'module_apply_default/hub_input/strided_slice_2:0' } },

    // { name: 'OpenImages Faster-RCNN Inception ResNet v2 Atrous', modelPath: 'models/openimages/faster-rcnn-inception-resnet-v2-atrous', minScore: 0.05, normalizeInput: 1.0 / 255,
    //  map: { boxes: 'detection_boxes:0', scores: 'detection_scores:0', classes: 'detection_classes:0' } },

    // { name: 'COCO CenterNet ResNet50-v2', modelPath: 'models/coco/centernet-resnet50-v2', minScore: 0.3, maxResults: 20,
    //  map: { boxes: 'Identity:0', scores: 'Identity_2:0', classes: 'Identity_1:0' } },
  ],
  person: [
    { name: 'FaceAPI SSD/MobileNet v1', modelPath: 'models/faceapi/', score: 0.3, topK: 5, size: 416 },
  ],
  various: [
    { name: 'Food Items', modelPath: 'models/various/food', minScore: 0.4, tensorSize: 192, scaleScore: 500, maxResults: 3 },
    { name: 'Wine Classifier', modelPath: 'models/various/wine', minScore: 0.35, tensorSize: 224, scaleScore: 0.5, maxResults: 3, softmax: false },
    { name: 'Popular Products', modelPath: 'models/various/products', minScore: 0.35, tensorSize: 224, scaleScore: 0.5, maxResults: 3, softmax: false },
    { name: 'Metropolitan Art', modelPath: 'models/various/metropolitan', minScore: 0.1, tensorSize: 299, scaleScore: 1, maxResults: 3, softmax: false },
    { name: 'iNaturalist Plants', modelPath: 'models/inaturalist/plants', minScore: 0.1, tensorSize: 224, scaleScore: 3, maxResults: 3, background: 2101, softmax: false },
    { name: 'iNaturalist Birds', modelPath: 'models/inaturalist/birds', minScore: 0.1, tensorSize: 224, scaleScore: 1, maxResults: 3, background: 964, softmax: false },
    { name: 'iNaturalist Insects', modelPath: 'models/inaturalist/insects', minScore: 0.1, tensorSize: 224, scaleScore: 3, maxResults: 3, background: 1021, softmax: false },
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
  postProcess: <string> // run through custom post-processing function after inference
classify options
  modelType: 'graph' or 'layers',
  tensorSize: 224, // required
  offset: 0, // offset predictions by
  background: -1, // exclude prediction id from results
detect options:
  iouThreshold: 0.5, // used by nms
  map: { boxes: 'Identity_1:0', scores: 'Identity_4:0', classes: 'Identity_2:0' }, // defaults map to tfhub object detection models
*/
