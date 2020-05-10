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

## General Notes

- Large images can cause random WebGL processing errors, recommended limit is 1000px.
- There is no increased accuracy in image sizes larger than 800 pixels as individual classification samples are typically 224px.
- Image ratios matter as tensor calculations are mostly square.
- Smaller objects are easier to detect due to cleaner bounding boxes. Image with single large object that covers 100% of the image is worst-case scenario.
- Size of pretrained model is not related to performance as larger models can sometimes predict objects easier.
- Batch processing skews per-test performance numbers. If performing specific performance tests, limit batch size to 1.
- Batch sizes above 10 do not further increase performance.

### Tested pre-trained models

Note: All models were pretrained using ImageNet samples

- MobileNet v1 & v2 (25%/50%/70%/100%)
- CocoSSD-v2
- DarkNet/Yolo v1 & v2 & v3 (tiny & full)
- ResNet 10 & 15 & 50
- NSFW
- FaceAPI

### Notes on Models

- MobileNet: v1 is good out-of-the-box, v2 is better but needs manual tuning
- DarkNet/Yolo vs CocoSSD: Yolo has slightly better accuracy, but CocoSSD is much faster
- ResNet models: slow & unreliable, sometimes guess is better than anything else and other times it's not even close
- FaceAPI model: gender detection is real, emotion and age are more fun than real prediction
- NSFW model: nice, but not sufficiently accurate

### Benchmarks

Using Intel i7 with nVidia GTX-1050

- Totals: ~350ms/image classification and detection, ~700ms/image with person prediction
- Top 90% is 2x faster, but borderline cases drop average numbers

## Links

- TensorFlowJS: <https://www.tensorflow.org/js/>
- Datasets: <https://www.tensorflow.org/resources/models-datasets>
- ML5js: <https://github.com/ml5js/> <https://examples.ml5js.org/>
- MobileNet: <https://github.com/tensorflow/models/blob/master/research/slim/nets/mobilenet/README.md>
- DarkNet Yolo: <https://pjreddie.com/darknet/yolo/>
- Face/Gender/Age: <https://github.com/justadudewhohacks/face-api.js>
- PoseNet: <https://github.com/tensorflow/tfjs-models/tree/master/posenet>
- BodyPix: <https://github.com/tensorflow/tfjs-models/tree/master/body-pix>
- NSFW: <https://github.com/infinitered/nsfwjs>

## TBD

- Buildings
- NSFW alternative models
- Inception models
