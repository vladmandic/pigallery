# Recommended Models

## Scene Classification

Combination of:

- EfficientNet variation B4 trained on ImageNet 1k dataset
- Inception v4 trained on DeepDetect v4 dataset
- ResNet variation 152 trained on Places365 dataset

## Object Detection

Combination of:

- CenterNet variation ResNet 50-v2 trained on COCO dataset
- MobileNet v2 with SSD trained on OpenImages v4 dataset
- NudeNet trained on custom dataset

## Person Analysis

- Human library with embedded models:  
  *face, body, hand, age, gender, emotion*

<br><hr>

```json
{
  "classify": [
    { "name": "ImageNet EfficientNet B4", "modelPath": "models/imagenet/efficientnet-b4", "enabled": true,
      "tensorSize": 380, "maxResults": 5, "minScore": 0.35, "scaleScore": 1, "normalizeInput": 0.00392156862745098 },
    { "name": "ImageNet Inception v4", "modelPath": "models/imagenet/inception-v4", "enabled": false,
      "tensorSize": 299, "maxResults": 5, "minScore": 0.35, "scaleScore": 200, "offset": 1 },
    { "name": "DeepDetect Inception v3", "modelPath": "models/deepdetect/inception-v3", "enabled": true,
      "tensorSize": 299, "maxResults": 5, "minScore": 0.35, "scaleScore": 2000, "normalizeInput": 0.00392156862745098 },
    { "name": "Places365 ResNet-152", "modelPath": "models/various/places365-resnet152", "enabled": true,
      "tensorSize": 224, "maxResults": 5, "minScore": 0.20, "scaleScore": 1, "normalizeInput": 1, "softmax": false, "offset": -1 }
    ],
  "detect": [
    { "name": "COCO SSD MobileNet v2", "modelPath": "models/coco/ssd-mobilenet-v2", "enabled": false,
      "minScore": 0.4, "scaleOutput": true, "maxResults": 20,
      "map": { "boxes": "Identity_1:0", "scores": "Identity_4:0", "classes": "Identity_2:0" } },
    { "name": "COCO EfficientDet D0", "modelPath": "models/coco/efficientdet-d0", "enabled": false,
      "minScore": 0.2, "scaleOutput": true, "maxResults": 20,
      "map": { "boxes": "Identity_1:0", "scores": "Identity_4:0", "classes": "Identity_2:0" } },
    { "name": "COCO CenterNet ResNet50-v2", "modelPath": "models/coco/centernet-resnet50-v2", "enabled": true,
      "minScore": 0.2, "scaleOutput": true, "maxResults": 20,
      "map": { "boxes": "Identity:0", "scores": "Identity_2:0", "classes": "Identity_1:0" } },
    { "name": "OpenImages SSD MobileNet v2", "modelPath": "models/openimages/ssd-mobilenet-v2", "enabled": true,
      "minScore": 0.15, "normalizeInput": 0.00392156862745098, "maxResults": 20,
      "map": { "boxes": "module_apply_default/hub_input/strided_slice:0", "scores": "module_apply_default/hub_input/strided_slice_1:0", "classes": "module_apply_default/hub_input/strided_slice_2:0" } },
    { "name": "OpenImages Faster-RCNN Inception ResNet v2 Atrous", "modelPath": "models/openimages/faster-rcnn-inception-resnet-v2-atrous", "enabled": false,
      "minScore": 0.05, "normalizeInput": 0.00392156862745098,
      "map": { "boxes": "detection_boxes:0", "scores": "detection_scores:0", "classes": "detection_classes:0" } },
    { "name": "NudeNet", "modelPath": "models/various/nudenet", "enabled": true,
      "minScore": 0.3, "postProcess": "nsfw", "switchAxis": true,
      "map": { "boxes": "filtered_detections/map/TensorArrayStack/TensorArrayGatherV3:0", "scores": "filtered_detections/map/TensorArrayStack_1/TensorArrayGatherV3:0", "classes": "filtered_detections/map/TensorArrayStack_2/TensorArrayGatherV3:0" } }
    ],
  "video": [],
  "person": { "name": "Human",
    "videoOptimized": false, "deubg": false, "filter": { "enabled": false }, "gesture": { "enabled": false }, "body": { "enabled": false }, "hand": { "enabled": false },
    "face": {
      "detector": { "modelPath": "@vladmandic/human/models/blazeface-back.json", "rotation": true },
      "mesh": { "modelPath": "@vladmandic/human/models/facemesh.json" },
      "iris": { "modelPath": "@vladmandic/human/models/iris.json" },
      "age": { "modelPath": "@vladmandic/human/models/age-ssrnet-imdb.json" },
      "gender": { "modelPath": "@vladmandic/human/models/gender.json" },
      "emotion": { "modelPath": "@vladmandic/human/models/emotion-large.json" },
      "embedding": { "modelPath": "@vladmandic/human/models/mobilefacenet.json", "enabled": true }
    } },
  "various": [
    { "name": "Food Items", "modelPath": "models/various/food", "enabled": true,
      "minScore": 0.4, "tensorSize": 192, "scaleScore": 500, "maxResults": 3 },
    { "name": "Wine Classifier", "modelPath": "models/various/wine", "enabled": true,
      "minScore": 0.35, "tensorSize": 224, "scaleScore": 0.5, "maxResults": 3, "softmax": false },
    { "name": "Popular Products", "modelPath": "models/various/products", "enabled": true,
      "minScore": 0.35, "tensorSize": 224, "scaleScore": 0.5, "maxResults": 3, "softmax": false },
    { "name": "Metropolitan Art", "modelPath": "models/various/metropolitan", "enabled": true,
      "minScore": 0.1, "tensorSize": 299, "scaleScore": 1, "maxResults": 3, "softmax": false },
    { "name": "iNaturalist Plants", "modelPath": "models/inaturalist/plants", "enabled": true,
      "minScore": 0.1, "tensorSize": 224, "scaleScore": 3, "maxResults": 3, "background": 2101, "softmax": false },
    { "name": "iNaturalist Birds", "modelPath": "models/inaturalist/birds", "enabled": true,
      "minScore": 0.1, "tensorSize": 224, "scaleScore": 1, "maxResults": 3, "background": 964, "softmax": false },
    { "name": "iNaturalist Insects", "modelPath": "models/inaturalist/insects", "enabled": true,
      "minScore": 0.1, "tensorSize": 224, "scaleScore": 3, "maxResults": 3, "background": 1021, "softmax": false }
  ]
}
```
