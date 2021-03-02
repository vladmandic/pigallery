# Configuration Details

Active model configuration can be seen in the client app via 'User' -> 'Params'  
To modify model configuration, edit `model.json` to select active models for both image processing and live video  

<br>

## Default Models

Default model configuration is created when running `./setup.js` and written to `models.json`

Application ships with [Human](https://github.com/vladmandic/human) module that include their required models.  

Application does NOT include any pre-packaged **classification** or **detection** models - it is up to user to provide them.  
By default, enabled 3rd party models are:

- Image Classification: `MobileNet v3 trained on ImageNet dataset`, provided by [tfhub.net](https://tfhub.dev/google/imagenet/mobilenet_v3_large_100_224/classification/5)
- Object Detection: `MobileNet v2 with SSD trained on COCO dataset`, provided by [tfhub.net](https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1)

Note that you can chain any number of models within each section and results will be combined according to overall scores.

<br>

## Loading Models

Models can be loaded from either local storage or directly from an external http location.  
Directly supported models are TensorFlow graph models and layers models.  
For other types of models, see notes on coversion.

### Example Module Configuration

```json
{
  "classify": [
    { "name": "MobileNet v3",
      "modelPath": "https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/imagenet/mobilenet_v3_large_100_224/classification/5/default/1/model.json",
      "classes": "assets/classes-imagenet.json",
      "offset": 1, "tensorSize": 224
    }
  ],
  "detect": [
    { "name": "COCO SSD MobileNet v2",
      "modelPath": "https://storage.googleapis.com/tfhub-tfjs-modules/tensorflow/tfjs-model/ssd_mobilenet_v1/1/default/1/model.json",
      "classes": "assets/classes-coco.json",
      "minScore":0.3, "scaleOutput":true, "maxResults":20, "offset": 1,
      "map": { "boxes": "Postprocessor/ExpandDims_1", "scores": "Postprocessor/Slice", "classes": null }
    }
 ],
}
```

### Model Parameters

**General options:**

- name: <string>: logical name of a model
- modelPath: <url>: url to model, with or without /model.json, also supports loading from tfhub
- classes: <url>: set to url or leave as null to load classes.json from modelPath
- minScore: <0..1>: minimum score that prediction has to achieve
- scaleScore: <number || 1>: use if scores are off by order of magniture
- maxResults: <number || 5>: how many results to return
- normalizeInput: <number || 1>: value:(1) = range:(0..255), value=(1/255) = range:(0..1), value:(-1 + 1/127.5) = range:(-1..1)
- sofmax: <boolean>: normalize scores using softmax function
- postProcess: <string> // run through custom post-processing function after inference
**Classify options:**
- modelType: <'graph' || 'layers'>
- tensorSize: <number || 224>: required
- offset: <number || 0>: offset predictions by
- background: <number || -1>: exclude prediction id from results
**Detect options:**
- iouThreshold: <number || 0.5>: used by nms
- map: { boxes: <string || 'Identity_1:0'>, scores: <string || 'Identity_4:0'>, classes: <string || 'Identity_2:0'> }: defaults map to tfhub object detection models

<br>

## Model Downloads

### TF Model Zoos

Where to find large number of pretrained models:

- TFHub: <https://tfhub.dev/s?module-type=image-augmentation,image-classification,image-feature-vector,image-generator,image-object-detection,image-others,image-style-transfer,image-rnn-agent>
- TF Model Garden - Official: <https://github.com/tensorflow/models/tree/master/official>
- TF Model Garden - Research: <https://github.com/tensorflow/models/tree/master/research>
- TF Model Garden - Community: <https://github.com/tensorflow/models/tree/master/community>
- TFJS NPMs: <https://github.com/tensorflow/tfjs-models>
- Intel: <https://github.com/IntelAI/models/tree/master/benchmarks>
- Google: <https://aihub.cloud.google.com/>
