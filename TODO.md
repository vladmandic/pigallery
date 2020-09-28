# TODO

## Bugs

- Processing restart on WegGL errors
- Logout
- Video for shared models

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

TBD: 

- DeepLab semantic segmentation: <https://github.com/tensorflow/tfjs-models/tree/master/deeplab>
- BodyPix people segmentation: <https://github.com/tensorflow/tfjs-models/tree/master/body-pix>
- Jeeliz: https://github.com/jeeliz/jeelizFaceFilter
- Video: DeepDetect, ImageNet

## Random

