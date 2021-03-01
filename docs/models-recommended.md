# Recommended Models

```json
{
  "classify": [
    { "name": "ImageNet EfficientNet B4",
      "modelPath": "models/imagenet/efficientnet-b4",
      "tensorSize": 380, "maxResults": 5, "minScore": 0.35, "scaleScore": 1, "normalizeInput": 0.00392156862745098 },
    { "name": "DeepDetect Inception v3", "modelPath": "models/deepdetect/inception-v3",
      "tensorSize": 299, "maxResults": 5, "minScore": 0.35, "scaleScore": 2000, "normalizeInput": 0.00392156862745098 },
    { "name": "Places365 ResNet-152", "modelPath": "models/various/places365-resnet152",
      "tensorSize": 224, "maxResults": 5, "minScore": 0.20, "scaleScore": 1, "normalizeInput": 1, "softmax": false, "offset": -1 }
    ],
  "detect": [
    { "name": "COCO SSD MobileNet v2", "modelPath": "models/coco/ssd-mobilenet-v2",
      "minScore": 0.4, "scaleOutput": true, "maxResults": 20,
      "map": { 
        "boxes": "Identity_1:0",
        "scores": "Identity_4:0",
        "classes": "Identity_2:0"
      } },
    { "name": "OpenImages SSD MobileNet v2", "modelPath": "models/openimages/ssd-mobilenet-v2",
      "minScore": 0.15, "normalizeInput": 0.00392156862745098, "maxResults": 20,
        "map": {
        "boxes": "module_apply_default/hub_input/strided_slice:0",
        "scores": "module_apply_default/hub_input/strided_slice_1:0",
        "classes": "module_apply_default/hub_input/strided_slice_2:0"
      } },
    { "name": "NudeNet", "modelPath": "models/various/nudenet",
      "minScore": 0.3, "postProcess": "nsfw", "switchAxis": true,
      "map": {
        "boxes": "filtered_detections/map/TensorArrayStack/TensorArrayGatherV3:0",
        "scores": "filtered_detections/map/TensorArrayStack_1/TensorArrayGatherV3:0",
        "classes": "filtered_detections/map/TensorArrayStack_2/TensorArrayGatherV3:0"
      } }
    ],
  "video": [],
  "person": { "name": "Human",
    "videoOptimized": false, "filter": { "enabled": false }, "gesture": { "enabled": false }, "body": { "enabled": false }, "hand": { "enabled": false },
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
    { "name": "Food Items", "modelPath": "models/various/food",
      "minScore": 0.4, "tensorSize": 192, "scaleScore": 500, "maxResults": 3 },
    { "name": "Wine Classifier",
      "modelPath": "models/various/wine",
      "minScore": 0.35, "tensorSize": 224, "scaleScore": 0.5, "maxResults": 3, "softmax": false },
    { "name": "Popular Products",
      "modelPath": "models/various/products",
      "minScore": 0.35, "tensorSize": 224, "scaleScore": 0.5, "maxResults": 3, "softmax": false },
    { "name": "Metropolitan Art", "modelPath": "models/various/metropolitan",
      "minScore": 0.1, "tensorSize": 299, "scaleScore": 1, "maxResults": 3, "softmax": false },
    { "name": "iNaturalist Plants", "modelPath": "models/inaturalist/plants",
      "minScore": 0.1, "tensorSize": 224, "scaleScore": 3, "maxResults": 3, "background": 2101, "softmax": false },
    { "name": "iNaturalist Birds", "modelPath": "models/inaturalist/birds",
      "minScore": 0.1, "tensorSize": 224, "scaleScore": 1, "maxResults": 3, "background": 964, "softmax": false },
    { "name": "iNaturalist Insects", "modelPath": "models/inaturalist/insects",
      "minScore": 0.1, "tensorSize": 224, "scaleScore": 3, "maxResults": 3, "background": 1021, "softmax": false }
  ]
}
```
