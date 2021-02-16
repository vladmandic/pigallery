# Configuration Details

Active client configuration can be edited in the client app via 'User' -> 'Settings'  
To modify client configuration advanced parameters, edit `client/shared/config.js`  

Active model configuration can be seen in the client app via 'User' -> 'Params'  
To modify model configuration, edit `model.json` to select active models for both image processing and live video  

## Default Models

By default, application ships with [Face-API](https://github.com/vladmandic/face-api) and [Human](https://github.com/vladmandic/human) modules that include their required models.  
`Face-API` is used for face analysis during image processing while `Human` is used during video processing.  

Application does NOT ship with any **classification** or **detection** models - it is up to user to provide them.

## Recommended Models

Below is the configuration I'm using in production for optimal results on 4GB GPU:

  ```json
  {
    "classify":[
      { "name":"ImageNet EfficientNet B4",
        "modelPath":"models/imagenet/efficientnet-b4",
        "tensorSize":380, "minScore":0.35, "scaleScore":1 },
      { "name":"DeepDetect Inception v3", "modelPath":"models/deepdetect/inception-v3",
        "tensorSize":299, "minScore":0.35, "scaleScore":2000 }
    ],
    "detect":[
      { "name":"COCO SSD MobileNet v2", "modelPath":"models/coco/ssd-mobilenet-v2",
        "minScore":0.4, "scaleOutput":true, "maxResults":20 },
      { "name":"NudeNet f16", "modelPath":"models/various/nudenet/f16",
        "minScore":0.3, "postProcess":"nsfw", "switchAxis":true,
        "map":{
          "boxes":"filtered_detections/map/TensorArrayStack/TensorArrayGatherV3:0",
          "scores":"filtered_detections/map/TensorArrayStack_1/TensorArrayGatherV3:0",
          "classes":"filtered_detections/map/TensorArrayStack_2/TensorArrayGatherV3:0"
        } },
      { "name":"OpenImages SSD MobileNet v2", "modelPath":"models/openimages/ssd-mobilenet-v2",
        "minScore":0.15, "normalizeInput":0.00392156862745098, "maxResults":20,
          "map":{
          "boxes":"module_apply_default/hub_input/strided_slice:0",
          "scores":"module_apply_default/hub_input/strided_slice_1:0",
          "classes":"module_apply_default/hub_input/strided_slice_2:0"
        } }
    ],
    "video":[],
    "person":[
      { "name":"FaceAPI SSD/MobileNet v1", "modelPath":"models/faceapi/",
        "score":0.3, "topK":5, "size":416 }
    ],
    "various":[
      { "name":"Food Items", "modelPath":"models/various/food",
        "minScore":0.4, "tensorSize":192, "scaleScore":500, "maxResults":3 },
      { "name":"Wine Classifier",
        "modelPath":"models/various/wine",
        "minScore":0.35, "tensorSize":224, "scaleScore":0.5, "maxResults":3, "softmax":false },
      { "name":"Popular Products",
        "modelPath":"models/various/products",
        "minScore":0.35, "tensorSize":224, "scaleScore":0.5, "maxResults":3, "softmax":false },
      { "name":"Metropolitan Art", "modelPath":"models/various/metropolitan",
        "minScore":0.1, "tensorSize":299, "scaleScore":1, "maxResults":3, "softmax":false },
      { "name":"iNaturalist Plants", "modelPath":"models/inaturalist/plants",
        "minScore":0.1, "tensorSize":224, "scaleScore":3, "maxResults":3, "background":2101, "softmax":false },
      { "name":"iNaturalist Birds", "modelPath":"models/inaturalist/birds",
        "minScore":0.1, "tensorSize":224, "scaleScore":1, "maxResults":3, "background":964, "softmax":false },
      { "name":"iNaturalist Insects", "modelPath":"models/inaturalist/insects",
        "minScore":0.1, "tensorSize":224, "scaleScore":3, "maxResults":3, "background":1021, "softmax":false }
    ]
  }
  ```

## Loading Models

Models can be loaded from either local storage or directly from an external http location.  
Directly supported models are TensorFlow graph models and layers models.  
For other types of models, see notes on coversion.

### Model Parameters

- name: Model label
- modelPath: Where to load model from, can be a local path or a hosted http link such as one from tfhub.com
- minScore: minimal score analysis has to achieve to include results
- maxResults, topK: how many top results to return
- normalizeInput: multiply each input with this value as some models prefer input in different ranges such as [0..1], [-1..1], [0..255], etc.
- scoreScale: relative score multiplier to balance scores between different models
- offset: specific to model and controls label index offset within classes definition
- tensorSize, size: some model are compiled for specific input size. this is a model specific value
- background: which label to exclude from results as a generic result
- model type: model specific, can be 'graph' or 'layers'
- useFloat: model specific, should model use float or integer processing
- overlap: maximum overlap percentage allowed before droping detetion boxes from results
- exec: model specific, use cusom engine for model execution
- softMax: run softmax function on model results before parsing
- map: provide custom mapping of output tensors used for detection models if it cannot be determined automatically

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

#### Convert Generic

Simplest way to convert typical TensorFlow **saved** model to a **graph** model that can be used by TFJS:

```bash
  tensorflowjs_converter \
    --input_format <tfjs_layers_model,tf_saved_model,tf_hub,keras,tf_frozen_model,keras_saved_model> \
    --output_format tfjs_graph_model \
    --skip_op_check \
    --strip_debug_ops True \
    --control_flow_v2 True \
    --weight_shard_size_bytes 4194304 \
    <src_folder> \
    <tgt_folder>
```
#### Conversion Notes

- Different conversions may require additional parameters like:
  - `--signature_name <name`
  - `--saved_model_tags <tags>`
  - `--output_node_names <names>`
- Reduce model size by quantizing it:
  - `--quantize_float16 True`
  - `--quantize_uint8 True`
  - `--quantize_uint16 True`
- Models that output features (e.g. notop models) do not have activations above base layers so output is not directly usable

### Model Mapping

Included tool `server/signature.js` can analyze model signature of both **saved** and **graph** models.  
Converted graph models are typically missing correct model signature, so need to map expected output to tensor names.

For example, comparing output of **saved** model and converted **graph** model, correct tensor names can be matched using tensor id values:

`$ server/signature.js ~/models/coco/ssd-mobilenet-v2/saved/`
```js
2021-02-16 17:23:43.832428: I tensorflow/core/platform/cpu_feature_guard.cc:142] Your CPU supports instructions that this TensorFlow binary was not compiled to use: AVX2 FMA
2021-02-16 17:23:43.875960: I tensorflow/core/platform/profile_utils/cpu_utils.cc:94] CPU Frequency: 2299965000 Hz
2021-02-16 17:23:43.876400: I tensorflow/compiler/xla/service/service.cc:168] XLA service 0x674cc20 initialized for platform Host (this does not guarantee that XLA will be used). Devices:
2021-02-16 17:23:43.876455: I tensorflow/compiler/xla/service/service.cc:176]   StreamExecutor device (0): Host, Default Version
2021-02-16 17:23:43 INFO:  @vladmandic/pigallery version 3.0.1
2021-02-16 17:23:43 INFO:  User: vlado Platform: linux Arch: x64 Node: v15.7.0
2021-02-16 17:23:43 DATA:  Stat: 46 bytes, created on 2020-10-24T12:46:09.502Z
2021-02-16 17:23:45 INFO:  saved model: /home/vlado/models/coco/ssd-mobilenet-v2/saved/
2021-02-16 17:23:45 DATA:  tags: [ 'serve', [length]: 1 ]
2021-02-16 17:23:45 DATA:  signature: [ 'serving_default', [length]: 1 ]
2021-02-16 17:23:45 DATA:  inputs: { name: 'serving_default_input_tensor:0', dtype: 'int32', dimensions: 4 }
2021-02-16 17:23:45 DATA:  outputs: [
  { id: 0, name: 'detection_anchor_indices', dytpe: 'float32', dimensions: 2 },
  { id: 1, name: 'detection_boxes', dytpe: 'float32', dimensions: 3 },
  { id: 2, name: 'detection_classes', dytpe: 'float32', dimensions: 2 },
  { id: 3, name: 'detection_multiclass_scores', dytpe: 'float32', dimensions: 3 },
  { id: 4, name: 'detection_scores', dytpe: 'float32', dimensions: 2 },
  { id: 5, name: 'num_detections', dytpe: 'float32', dimensions: 1 },
  { id: 6, name: 'raw_detection_boxes', dytpe: 'float32', dimensions: 3 },
  { id: 7, name: 'raw_detection_scores', dytpe: 'float32', dimensions: 3 },
  [length]: 8
]
```

`$ server/signature.js ~/models/coco/ssd-mobilenet-v2/`
```js
2021-02-16 17:23:40.526248: I tensorflow/core/platform/cpu_feature_guard.cc:142] Your CPU supports instructions that this TensorFlow binary was not compiled to use: AVX2 FMA
2021-02-16 17:23:40.563928: I tensorflow/core/platform/profile_utils/cpu_utils.cc:94] CPU Frequency: 2299965000 Hz
2021-02-16 17:23:40.564452: I tensorflow/compiler/xla/service/service.cc:168] XLA service 0x6063210 initialized for platform Host (this does not guarantee that XLA will be used). Devices:
2021-02-16 17:23:40.564516: I tensorflow/compiler/xla/service/service.cc:176]   StreamExecutor device (0): Host, Default Version
2021-02-16 17:23:40 INFO:  @vladmandic/pigallery version 3.0.1
2021-02-16 17:23:40 INFO:  User: vlado Platform: linux Arch: x64 Node: v15.7.0
2021-02-16 17:23:40 DATA:  Stat: 294 bytes, created on 2020-10-24T11:29:05.376Z
2021-02-16 17:23:40 INFO:  graph model: /home/vlado/models/coco/ssd-mobilenet-v2/model.json
2021-02-16 17:23:40 DATA:  inputs: { name: 'input_tensor:0', dtype: 'DT_UINT8', shape: [ { size: '1' }, { size: '-1' }, { size: '-1' }, { size: '3' }, [length]: 4 ] }
2021-02-16 17:23:40 DATA:  outputs: [
  { id: 0, name: 'Identity:0', dytpe: 'DT_FLOAT', shape: [ { size: '1' }, { size: '100' }, [length]: 2 ] },
  { id: 1, name: 'Identity_5:0', dytpe: 'DT_FLOAT', shape: [ { size: '1' }, [length]: 1 ] },
  { id: 2, name: 'Identity_4:0', dytpe: 'DT_FLOAT', shape: [ { size: '1' }, { size: '100' }, [length]: 2 ] },
  { id: 3, name: 'Identity_2:0', dytpe: 'DT_FLOAT', shape: [ { size: '1' }, { size: '100' }, [length]: 2 ] },
  { id: 4, name: 'Identity_3:0', dytpe: 'DT_FLOAT', shape: [ { size: '1' }, { size: '100' }, { size: '91' }, [length]: 3 ] },
  { id: 5, name: 'Identity_1:0', dytpe: 'DT_FLOAT', shape: [ { size: '1' }, { size: '100' }, { size: '4' }, [length]: 3 ] },
  { id: 6, name: 'Identity_6:0', dytpe: 'DT_FLOAT', shape: [ { size: '1' }, { size: '1917' }, { size: '4' }, [length]: 3 ] },
  { id: 7, name: 'Identity_7:0', dytpe: 'DT_FLOAT', shape: [ { size: '1' }, { size: '1917' }, { size: '91' }, [length]: 3 ] },
  [length]: 8
]
```

So resulting model map for a converted model would be:
```json
  { "name":"COCO SSD MobileNet v2", "modelPath":"models/coco/ssd-mobilenet-v2",
    "map": { 
      "boxes": "Identity_1:0",
      "scores": "Identity_4:0",
      "classes": "Identity_2:0"
    } },
```

### Advanced Model Analysis

Requires TensorFlow <https://github.com/tensorflow/tensorflow> dev tools not included in package
Build tool for TensorFlow is Bazel <https://github.com/bazelbuild/bazel/releases>

```bash
  sudo apt install python3 python3-pip unzip
  sudo ln -s /bin/python3 /bin/python
  sudo ln -s /bin/pip3 /bin/pip
  pip install tensorflow tensorflowjs
  git clone https://github.com/tensorflow/tensorflow
  cd tensorflow
  wget https://github.com/bazelbuild/bazel/releases/download/3.4.1/bazel_3.4.1-linux-x86_64.deb
  sudo dpkg -i ./bazel_3.4.1-linux-x86_64.deb
  ./configure
  basel version
  # update .bazelversion to match bazel version or install exact version
  cp LICENSE tensorflow/tools/graph_transforms/
```

Bazel build takes a long time and may fail due to out-of-memory in which case, just restart and it will continue

```bash
  bazel build \
    --config=v2 --config=noaws --config=nogcp --config=nohdfs --config=nonccl \
    --local_ram_resources=HOST_RAM*.5 --local_cpu_resources=HOST_CPUS*.5 \
    tensorflow/tools/graph_transforms:*
```

Once TF tools are compiled, use them to get details on the model before conversion

```bash
  ~/dev/tensorflow/bazel-bin/tensorflow/tools/graph_transforms/summarize_graph --in_graph="saved_model.pb"

    Found 1 possible inputs: (name=input, type=float(1), shape=[?,299,299,3])
    Found 1 possible outputs: (name=InceptionV4/Logits/Predictions, op=Softmax)
```


### Additional Reads

- TF-Keras to TFJS  
  <https://www.tensorflow.org/js/tutorials/conversion/import_keras>
- TF-Saves/Frozen/Hub  
  <https://www.tensorflow.org/js/tutorials/conversion/import_saved_model>
- TF-Lite to TFJS: not possible
- OpenVino to TF  
  <https://docs.openvinotoolkit.org/latest/_docs_MO_DG_prepare_model_convert_model_Convert_Model_From_TensorFlow.html>
- ONNX to TF  
  <https://github.com/onnx/onnx-tensorflow>

<br><hr><br>

## Testing Notes

- Using Intel i7 with nVidia GTX-1050Ti
- Sample is of 1,000 random images with processing size normalized to 780px

|                          |                      |              |         |        |         |            |             | Top 1% Accuracy |           |        |        |
|--------------------------|----------------------|--------------|---------|--------|---------|------------|-------------|-----------------|-----------|--------|--------|
| Model                    | Type                 | Training Set | Classes | Size   | Tensors | Resolution | Performance | Correct         | Incorrect | Best   | Empty  |
| MobileNet v1             | Image Classification | ImageNet     | 1000    | 16 MB  | 59      | 224 px     | 150 ms      | 75.79%          | 14.74%    | 0.00%  | 9.47%  |
| MobileNet v2             | Image Classification | ImageNet     | 1000    | 13 MB  | 125     | 224 px     | 112 ms      | 75.79%          | 10.53%    | 10.53% | 13.68% |
| Inception v1             | Image Classification | ImageNet     | 1000    | 25 MB  | 120     | 224 px     | 230 ms      | 69.47%          | 9.47%     | 9.47%  | 21.05% |
| Inception v2             | Image Classification | ImageNet     | 1000    | 43 MB  | 145     | 224 px     | 165 ms      | 80.00%          | 5.26%     | 5.26%  | 14.74% |
| Inception v3             | Image Classification | ImageNet     | 1000    | 91 MB  | 194     | 224 px     | 203 ms      | 89.47%          | 10.53%    | 10.53% | 0.00%  |
| Inception v4             | Image Classification | ImageNet     | 1000    | 163 MB | 304     | 300 px     | 299 ms      | 94.74%          | 5.26%     | 10.53% | 0.00%  |
| ResNet v2-50             | Image Classification | ImageNet     | 1000    | 98 MB  | 147     | 224 px     | 128 ms      | 83.16%          | 14.74%    | 14.74% | 2.11%  |
| ResNet v2-101            | Image Classification | ImageNet     | 1000    | 170 MB | 283     | 224 px     | 94 ms       | 82.11%          | 15.79%    | 15.79% | 2.11%  |
| Inception-ResNet v2      | Image Classification | ImageNet     | 1000    | 213 MB | 500     | 224 px     | 228 ms      | 91.58%          | 8.42%     | 8.42%  | 0.00%  |
| NASNet-A Mobile          | Image Classification | ImageNet     | 1000    | 20 MB  | 574     | 224 px     | 170 ms      | 85.26%          | 11.58%    | 11.58% | 3.16%  |
| EfficientNet B0          | Image Classification | ImageNet     | 1000    | 20 MB  | 168     | 224 px     | 134 ms      | 83.16%          | 6.32%     | 6.32%  | 10.53% |
| EfficientNet B4          | Image Classification | ImageNet     | 1000    | 74 MB  | 338     | 380 px     | 438 ms      | 91.58%          | 3.16%     | 3.16%  | 5.26%  |
| EfficientNet B5          | Image Classification | ImageNet     | 1000    | 116 MB | 394     | 456 px     | 448 ms      | 94.00%          | 2.00%     | 3.16%  | 3.15%  |
| EfficientNet B7          | Image Classification | ImageNet     | 1000    | 253 MB | 552     | 600 px     | 995 ms      | 96.84%          | 1.05%     | 1.05%  | 2.11%  |
| DeepDetect               | Image Classification | DeepDetect   | 6012    | 130 MB | 191     | 300 px     | 189 ms      | 87.37%          | 12.63%    | 2.11%  | 0.00%  |
| SSD/MobileNet v1         | Object Detection     | Coco         | 90      | 26 MB  | 163     | 224 px     | 120 ms      | 62.11%          | 9.47%     | 0.00%  | 28.42% |
| SSD/MobileNet v2         | Object Detection     | Coco         | 90      | 64 MB  | 202     | 224 px     | 147 ms      | 67.37%          | 8.42%     | 0.00%  | 24.21% |
| Yolo/DarkNet v1 Tiny     | Object Detection     | Coco+VOC     | 100     | 61 MB  | 42      | 416 px     | -           | -               | -         | -      | -      |
| Yolo/DarkNet v2 Tiny     | Object Detection     | Coco+VOC     | 100     | 43 MB  | 42      | 416 px     | -           | -               | -         | -      | -      |
| Yolo/DarkNet v3 Tiny     | Object Detection     | Coco+VOC     | 100     | 34 MB  | 59      | 416 px     | -           | -               | -         | -      | -      |
| Yolo/DarkNet v3 Full     | Object Detection     | Coco+VOC     | 100     | 237 MB | 366     | 416 px     | -           | -               | -         | -      | -      |
| SSD/MobileNet v2         | Object Detection     | OpenImages   | 600     | 55 MB  | 1434    | 300 px     | 2709 ms     | 92.63%          | 2.11%     | 16.84% | 5.26%  |
| RCNN/Inception-ResNet v2 | Object Detection     | OpenImages   | 600     | 244 MB | 1944    | 300 px     | -           | -               | -         | -      | -      |
| MobileNet v1 Food        | Image Classification | iNaturalist  | 2023    | 20 MB  | 58      | 192 px     | 45 ms       | -               | -         | -      | -      |
| MobileNet v2 Plants      | Image Classification | iNaturalist  | 2100    | 19 MB  | 169     | 224 px     | 58 ms       | -               | -         | -      | -      |
| MobileNet v2 Birds       | Image Classification | iNaturalist  | 963     | 13 MB  | 170     | 224 px     | 34 ms       | -               | -         | -      | -      |
| MobileNet v2 Insects     | Image Classification | iNaturalist  | 1020    | 13 MB  | 169     | 224 px     | 32 ms       | -               | -         | -      | -      |

<br>
