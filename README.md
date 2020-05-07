# photo-analysis

## Photo Analysis using TensorFlow/JS

    place sample images into /samples
    populate models /models or download from internet in runtime
    run server application `node server.js` which uses ParcelJS to build distribution and start HTTP ExpressJS server
    connect to <http://localhost/gallery.html>

## General Notes

- Large images can cause processing errors.
- There is no increased accuracy in image sizes larger than 1000 pixels
- Forced image resize on load adds large overhead of 1800ms average, better let browser deal with it
- Batch processing skews per-test performance numbers. If performing specific performance tests, limit batch size to 1
- Batch sizes above 10 do not further increase performance

## Notes on Models

- MobileNet-v1 has better accuracy than MobileNet-v2
- DarkNet/Yolo-v3 and CocoSSD are close, but Yolo wins in both performance and accuracy
- ResNet models are slow
- ResNet models are quite random, sometimes guess is better than anything else and other times it's not even close

## Benchmarks on a notebook with Intel i7 with nVidia GTX1050

- Image classification using MobileNet-v1 is 190ms/image average
- Image object detection using DarkNet/Yolo-v3 is 280ms/image average
- Person prediction using both NSFW and FaceApi is 780ms/image average

## Available pre-trained models

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
