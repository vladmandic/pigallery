# TODO

## Bugs

- Processing restart on WegGL errors
- Test caching limits

## Notes

PiGallery uses private branches of following public distributions due to following issues:

- FaceAPI: SSD/MobileNet model not compatible with TFJS@2.0+  
  <https://github.com/justadudewhohacks/face-api.js/issues/633>
- TensorFlow/JS: bug with WeakMap deallocation  
  <https://github.com/tensorflow/tfjs/issues/3823>

## Future Features

- Validate full install from scratch
- User DB management client-side
- User DB check server-side
- Move compare to main app as test feature
- Package & host models: https://www.tensorflow.org/hub/hosting
  Create tgz and add "?tfjs-format=compressed" to uri: <https://tfhub.dev/google/tfjs-model/imagenet/inception_v1/classification/3/default/1?tfjs-format=compressed>
  tf.loadGraphModel("https://tfhub.dev/google/tfjs-model/imagenet/inception_v1/classification/3/default/1", { fromTFHub: true })
- Server-side processing using TFJS-Node: nVidia CUDA on WSL2 requires kernel 4.19.121 current 4.19.104  
  <https://ubuntu.com/blog/getting-started-with-cuda-on-ubuntu-on-wsl-2>  
  <https://docs.nvidia.com/cuda/wsl-user-guide/index.html>  

## Desired Models

Didn't find:

- Places365: All found pre-trained weights are for PyTorch
- Objects365: New dataset, no public pre-trained weights so far
- ImageNet 21k: Huge
- iNaturalist: Found only feature-extract, not classificaiotn
- NudeNet: Requires port to TFJS: <https://github.com/notAI-tech/NudeNet/tree/master>

No tags in saved model:
- <https://tfhub.dev/google/on_device_vision/classifier/popular_wine_V1/1>
- <https://tfhub.dev/google/on_device_vision/classifier/popular_us_products_V1/1>
- <https://tfhub.dev/metmuseum/vision/classifier/imet_attributes_V1/1?tf-hub-format=compressed>

- Body pose, hand tracking ,etc.

## Random

## New

Settings:
- Print model details
Models:
- Configurable caching
Video:
- Better messages on long operations
- Age is avaraged to reduce jitter
- Models size reduced 50%
- Models are selectable
- Full or reduced processing
- Background fades to dominant color
Firefox:
- Bug with cache population: fails all when any item fails
- Bug with PWA caching load order
- Bug with content-length verification: result is block or encoding mismatch
- Missing getCapabilities for video tracks
- Missing some CSS tags
- Missing PWA installable
- Warnings on deprecated features without stating where
CSS package
- Dynamic rebuild
- Fixed ordering

## Dev Warnings

- jQuery: Added non-passive event listener to a scroll-blocking 'touchstart' event. Consider marking event handler as 'passive' to make the page more responsive.
- Firefox: onmozfullscreenerror is deprecated.
- Firefox: onmozfullscreenchange is deprecated.
- Firefox: The ‘content’ attribute of Window objects is deprecated.  Please use ‘window.top’ instead.
- Firefox: This page uses the non standard property “zoom”. Consider using calc() in the relevant property values, or using “transform” along with “transform-origin: 0 0”.

## EfficientDet

EfficientDet: Models on TFHub are unusable, but trying stuff from:  

    https://github.com/google/automl/tree/master/efficientdet
    https://github.com/tensorflow/tfjs/tree/master/tfjs-automl
    vlado@wyse:~/dev/tfjs/tfjs-automl/demo/object_detection $

### load checkpoint and create 3 different saved outputs: saved, tensorrt and frozen

python model_inspect.py --runmode=saved_model --model_name=efficientdet-d0 --ckpt_path=d0/ckpt --saved_model_dir=d0/saved --tensorrt=FP16

### test all 3 models

python model_inspect.py --runmode=saved_model_infer --model_name=efficientdet-d0 --saved_model_dir=d0/saved --input_image=d0/img.png --output_image_dir=d0
python model_inspect.py --runmode=saved_model_infer --model_name=efficientdet-d0 --saved_model_dir=d0/saved/tensorrt_fp16 --input_image=d0/img.png --output_image_dir=d0
python model_inspect.py --runmode=saved_model_infer --model_name=efficientdet-d0 --saved_model_dir=d0/saved/efficientdet-d0_frozen.pb --input_image=d0/img.png --output_image_dir=d0

 ~/dev/tensorflow/bazel-bin/tensorflow/tools/graph_transforms/summarize_graph --in_graph="d0/saved/efficientdet-d0_frozen.pb"
  Found 1 possible inputs: (name=image_files, type=string(7), shape=[?])
  No variables spotted.
  Found 1 possible outputs: (name=detections, op=Pack)
  Found 4123979 (4.12M) const parameters, 0 (0) variable parameters, and 4 control_edges
  Op types used: 1541 Identity, 1006 Const, 652 ReadVariableOp, 184 Mul, 134 Conv2D, 119 Sigmoid, 108 FusedBatchNormV3, 102 BiasAdd, 102 IdentityN, 80 DepthwiseConv2dNative, 71 AddV2, 67 RealDiv, 48 AddN, 26 StridedSlice, 24 Pack, 16 Mean, 14 MaxPool, 12 ResizeNearestNeighbor, 11 Reshape, 10 Cast, 10 ExpandDims, 9 Add, 8 Assert, 8 Sub, 5 Shape, 5 NotEqual, 5 GreaterEqual, 4 LogicalAnd, 4 Less, 4 Equal, 4 Substr, 3 If, 3 GatherV2, 2 All, 2 Maximum, 2 Unpack, 2 Minimum, 2 ConcatV2, 2 Range, 2 Exp, 2 Squeeze, 1 Tile, 1 While, 1 StatelessIf, 1 TensorListStack, 1 TensorListSetItem, 1 TensorListLength, 1 TensorListReserve, 1 TensorListResize, 1 ResizeBilinear, 1 Placeholder, 1 Pad, 1 NonMaxSuppressionV5, 1 Max, 1 LogicalOr, 1 Greater, 1 FloorMod, 1 FloorDiv, 1 Fill, 1 DecodePng, 1 DecodeJpeg, 1 DecodeGif, 1 DecodeBmp, 1 ArgMax

### convert all 3 models

tensorflowjs_converter --input_format=tf_saved_model --output_format=tfjs_graph_model --quantize_float16=* --strip_debug_ops=True --control_flow_v2=True d0/saved d0/graph-saved
tensorflowjs_converter --input_format=tf_saved_model --output_format=tfjs_graph_model --quantize_float16=* --strip_debug_ops=True --control_flow_v2=True d0/saved/tensorrt_fp16 d0/graph-tensorrt
tensorflowjs_converter --input_format=tf_frozen_model --output_format=tfjs_graph_model --quantize_float16=* --strip_debug_ops=True --control_flow_v2=True --output_node_names="detections" d0/saved/efficientdet-d0_frozen.pb d0/graph-tensorrt
tensorflowjs_converter --input_format=tf_hub --output_format=tfjs_graph_model --quantize_float16=* --strip_debug_ops=True --control_flow_v2=True --signature_name="serving_default" https://tfhub.dev/tensorflow/efficientdet/d0/1 d0/graph-tfhub

### errors during executeAsync
saved: Error: the input tensors shape does not match: 1,1, 1,100
tensorrt: Error: The shape of dict['image_files'] provided in model.execute(dict) must be [-1], but was [1,780,585,3]
frozen: Error: The shape of dict['image_files'] provided in model.execute(dict) must be [-1], but was [1,780,585,3]
tfhub: TypeError: Cannot read property 'name' of undefined
