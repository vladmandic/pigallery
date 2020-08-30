# Moodels

## Image Processing

- If you get `Error: Failed to compile fragment shader`, you've run out of GPU memory.  
  Just restart processing and it will continue from the last known good result.
- Model load time can be from few seconds to over a minute depending on model size (in MB)
- Model warm-up time can be from few seconds to over a minute depending on model complexity (number of tensors)
- Once models are loaded and ready, actual processing is ~1sec per image
- Image analysis is maximized out-of-the-box for a GPU-accelerated system using WebGL acceleration and GPU with minimum of 4GB of memory  
- For high-end systems with 8GB or higher, you can further enable ImageNet 21k models  
- For low-end systems with 2GB or less, enable analysis based on MobileNet v2 and EfficientNet B0  
- Usage without GPU acceleration is not recommended  
- Note that GPU is not required for image gallery, only for initial processing  

## Loading Models

Note that models can be loaded from either local storage or directly from an external http location.  
Directly supported models are TensorFlow graph models and layers models.  
For other types of models, see notes on coversion.

## Recommended Models

```js
exports.models = {
  classify: [
    // Image classification using Inception v4 trained on ImageNet 1000 dataset
    { name: 'ImageNet Inception v4', modelPath: 'models/imagenet-inception-v4', score: 0.22, topK: 3, tensorSize: 299, scoreScale: 200, offset: 1 },
    // Image classification using EfficientNet B5 trained on ImageNet 1000 dataset
    { name: 'ImageNet EfficientNet B5', modelPath: 'models/imagenet-efficientnet-b5', score: 0.2, topK: 3, tensorSize: 456, scoreScale: 1, offset: 0 },
    // Image classification using Inception v3 trained on DeepDetect 6000 dataset
    { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect-inception-v3', score: 0.1, topK: 5, tensorSize: 299, scoreScale: 1000, offset: 0 },
    // Image classification using MobileNet v1 trained on AIY 2000 dataset
    { name: 'AIY MobileNet Food', modelPath: 'models/aiy-mobilenet-food', score: 0.35, topK: 1, tensorSize: 192, scoreScale: 500, offset: 0 },
    // Image classification using Inception v3 trained on NSFW dataset
    { name: 'NSFW Inception v3', modelPath: 'models/nsfw-inception-v3-quant', score: 0.7, topK: 4, tensorSize: 299, scoreScale: 2, offset: 0, background: 2, modelType: 'layers' },
  ],
  detect: [
    // Object detection using SSD and classification using MobileNet v2 trained on CoCo 90 dataset
    { name: 'CoCo SSD/MobileNet v2', modelPath: 'models/coco-ssd-mobilenet-v2', score: 0.4, topK: 6, overlap: 0.5, useFloat: false, exec: 'coco' },
    // Object detection using SSD and classification using SSD/MobileNet v2 trained on OpenImages 600 dataset
    { name: 'OpenImages SSD/MobileNet v2', modelPath: 'models/openimages-ssd-mobilenet-v2', score: 0.2, topK: 6, useFloat: true, exec: 'ssd' },
  ],
  person: [
    // Object detection using SSD and classification using MobileNet v1 from Face-API
    { name: 'FaceAPI SSD/MobileNet v1', modelPath: 'models/faceapi/', exec: 'ssd', score: 0.3, topK: 5, size: 416 },
  ],
  video: {
    classify: { name: 'DeepDetect Inception v3', modelPath: 'models/deepdetect-inception-v3', score: 0.1, topK: 5, tensorSize: 299, scoreScale: 1000, offset: 0 },
    detect: { name: 'CoCo SSD/MobileNet v2', modelPath: 'models/coco-ssd-mobilenet-v2', score: 0.4, topK: 5, overlap: 0.5, useFloat: false, exec: 'coco' },
    person: { name: 'FaceAPI TinyYolo', modelPath: 'models/faceapi/', exec: 'yolo', score: 0.3, topK: 5, size: 416 },
  },
};
```

### Model Parameters

- modelPath: Where to load model from, can be a local path or a hosted http link such as one from tfhub.com
- score: minimal score analysis has to achieve to include results
- topK: how many top results to return
- scoreScale: relative score multiplier to balance scores between different models
- offset: specific to model and controls label index offset within classes definition
- tensorSize, size: each model is compiled for specific input size. this is model specific and cannot be modified by user
- background: which label to exclude from results as a generic result
- model type: model specific, can be 'graph' or 'layers'
- useFloat: model specific, should model use float or integer processing
- overlap: maximum overlap percentage allowed before droping detetion boxes from results
- exec: model specific, use cusom engine for model execution

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

### Interesting models

- Places365: Still searching for a good pretrained model
- Google BiT <https://tfhub.dev/google/collections/bit/1>: Large models pretrained on ImageNet 1k and 21k  
  r050x1 1k=91MB   21k=240MB  
  r050x3 1k=770MB  21k=1190MB  
  r101x1 1k=159MB  21k=308MB  
  r101x3 1k=1340MB 21k=1780MB  
  r152x4 1=2733MB  21k=4179MB
- Google Landmarks: <https://tfhub.dev/google/collections/landmarks/1>
- Google Food: <https://tfhub.dev/google/aiy/vision/classifier/food_V1/1>
- Google Supermarket Products: <https://tfhub.dev/google/on_device_vision/classifier/popular_us_products_V1/1>
- iNaturalist: 2017 dataset 5089 classs from 0.6M images in 237GB  
  Note: competition uses obfucated taxonomy since 2018, so categories must be downloaded separately after the competition  
  iNaturalist: <https://tfhub.dev/s?q=inaturalist> <https://github.com/richardaecn/cvpr18-inaturalist-transfer>  
  Competitions: <https://github.com/visipedia/inat_comp>  
  Dataset: <https://www.kaggle.com/c/inaturalist-2019-fgvc6/data> <https://github.com/visipedia/inat_comp/tree/master/2017>  
  Model Small: <https://www.kaggle.com/sujoykg/xception-keras/>  
  Model Large: <https://www.kaggle.com/cedriclacrambe/inaturalist-xception-512/>  
  Lexicon Latin: <https://www.gbif.org/dataset/search>  
  Lexicon Government: <https://www.itis.gov/>  
  Lookup: <http://www.gbif.org/species/{gbid}> <https://api.gbif.org/v1/species?name={name}>  
  Hierarchy: categogy -> kingdom -> phylum -> class -> order -> family -> genus -> name  

## Convert models

### Install TF Tools

```bash
  pip3 install tensorflow tensorflowjs
```

#### Install Python, TensorFlow <https://github.com/tensorflow/tensorflow> and Bazel <https://github.com/bazelbuild/bazel/releases>

```bash
  sudo apt install python3 python3-pip
  pip3 install tensorflow tensorflowjs
  git clone https://github.com/tensorflow/tensorflow
  cd tensorflow
  ./configure
  wget https://github.com/bazelbuild/bazel/releases/download/3.4.1/bazel_3.4.1-linux-x86_64.deb
  sudo dpkg -i ./bazel_3.4.1-linux-x86_64.deb
  rm bazel_3.4.1-linux-x86_64.deb
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

#### Find input and output node names

```bash
  ~/tensorflow/bazel-bin/tensorflow/tools/graph_transforms/summarize_graph --in_graph="saved_model.pb"

    Found 1 possible inputs: (name=input, type=float(1), shape=[?,299,299,3])
    Found 1 possible outputs: (name=InceptionV4/Logits/Predictions, op=Softmax)
```

#### Convert Generic

```bash
  tensorflowjs_converter \
    --input_format <tfjs_layers_model,tf_saved_model,tf_hub,keras,tf_frozen_model,keras_saved_model> \
    --output_format tfjs_graph_model \
    --skip_op_check \
    --strip_debug_ops True \
    --control_flow_v2 True \
    --weight_shard_size_bytes 4194304 \
    <src> \
    <tgt>
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
- TF-Keras to TFJS  
  <https://www.tensorflow.org/js/tutorials/conversion/import_keras>
- TF-Saves/Frozen/Hub  
  <https://www.tensorflow.org/js/tutorials/conversion/import_saved_model>
- TF-Lite to TFJS: not possible
- OpenVino to TF  
  <https://docs.openvinotoolkit.org/latest/_docs_MO_DG_prepare_model_convert_model_Convert_Model_From_TensorFlow.html>
- ONNX to TF  
  <https://github.com/onnx/onnx-tensorflow>

<br>
<br>
<br>

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
<br>
<br>

## Learning

- Google ML Course: <https://developers.google.com/machine-learning/crash-course>
