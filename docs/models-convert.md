# Random Notes on Model Conversion

## Convert Generic

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

### Conversion Notes

- Different conversions may require additional parameters like:
  - `--signature_name <name`
  - `--saved_model_tags <tags>`
  - `--output_node_names <names>`
- Reduce model size by quantizing it:
  - `--quantize_float16 True`
  - `--quantize_uint8 True`
  - `--quantize_uint16 True`
- Models that output features (e.g. notop models) do not have activations above base layers so output is not directly usable

## Model Mapping

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

Note that `map.classes` can be set to `null` in which case application will attempt to infer classes data from scores data.

<br><hr><br>

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

<br>

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


<br>
