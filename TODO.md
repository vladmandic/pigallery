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
- Bug with PWA caching load order
- Bug with content-length verification: result is block or encoding mismatch
- Missing getCapabilities for video tracks
- Missing some CSS tags
- Missing installable
CSS package
- Dynamic rebuild
- Fixed ordering
