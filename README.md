# photo-analysis

## Photo Analysis using TensorFlow/JS

### Main app

Runs main classification, detection and prediction:

- Modify `config` object in `gallery.js`
- Provide pretrained models `/models` or download from internet in runtime
- Place sample images into `/samples`
- Run server application `node server.js`
- Server uses ParcelJS to build distribution in `/dist` and start HTTP ExpressJS server
- Connect to <http://localhost/gallery.html>

### Test app

This runs all available models:

- Modify `gallery.html` to include `models.js` instead of `gallery.js`

## General Notes

- Large images can cause processing errors.
- There is no increased accuracy in image sizes larger than 800 pixels as individual classification samples are typically 224px
- Image ratios matter as tensor calculations are mostly square - loading square images does not reduce accuracy, but it does increase performance
- Forced image resize on load adds large overhead of 1800ms average, better let browser deal with it
- Size of pretrained model is not related to performance as larger models can sometimes predict objects easier
- Batch processing skews per-test performance numbers. If performing specific performance tests, limit batch size to 1
- Batch sizes above 10 do not further increase performance

## Notes on Models

- All models are pretrained using ImageNet samples
- MobileNet-v1: has better accuracy and performance than MobileNet-v2
- DarkNet/Yolo-v3 and CocoSSD: close results, but Yolo wins in both performance and accuracy by few percent
- ResNet models: slow & unreliable, sometimes guess is better than anything else and other times it's not even close
- FaceAPI model: gender detection is real, emotion and age are more fun than real prediction
- NSFW model: nice, but not sufficiently accurate

## Benchmarks

Using Intel i7 with nVidia GTX-1050

- Totals: ~360ms/image classification and detection, ~1,000ms/image with person prediction
- Image classification using MobileNet-v1 is 160ms/image average
- Image object detection using DarkNet/Yolo-v3 is 200ms/image average
- Person prediction using both NSFW and FaceApi is 640ms/image average

## Tested pre-trained models

- MobileNet-v1-100
- MobileNet-v2
- CocoSSD-v2
- DarkNet/Yolo-v3
- ResNet10
- ResNet15
- ResNet50
- NSFW
- FaceAPI

## Links

- TensorFlowJS: <https://www.tensorflow.org/js/>
- Datasets: <https://www.tensorflow.org/resources/models-datasets>
- ML5js: <https://github.com/ml5js/> <https://examples.ml5js.org/>
- MobileNet: <https://github.com/tensorflow/models/blob/master/research/slim/nets/mobilenet/README.md>
- DarkNet Yolo: <https://pjreddie.com/darknet/yolo/>
- Face/Gender/Age: <https://github.com/justadudewhohacks/face-api.js>
- PoseNet: <https://github.com/tensorflow/tfjs-models/tree/master/posenet>
- BodyPix: <https://github.com/tensorflow/tfjs-models/tree/master/body-pix>
