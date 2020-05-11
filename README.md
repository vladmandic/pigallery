# photo-analysis

![alt text](favicon.ico)

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

### Processing

- Batch processing skews per-test performance numbers. If performing specific performance tests, limit batch size to 1.
- Batch sizes above 10 do not further increase performance.

### Input Images

- Large images can cause random WebGL processing errors, recommended limit is 1000px.
- There is no increased accuracy in image sizes larger than 800 pixels as individual classification samples are typically 224px.
- Increase of resolution from 800px to 1000px doubles processing time
- Image ratios matter as tensor calculations are mostly square.
- Smaller objects are easier to detect due to cleaner bounding boxes. Image with single large object that covers 100% of the image is worst-case scenario.

### Pre-trained Models

- Size of pretrained model is not related to performance as larger models can sometimes predict objects easier.
- All models are pretrained using ImageNet dataset with 1,000 classes
- Ideally, models should be trained using full ImageNet dataset that contains 14,197,087 images in 21,841 classes
- If model is depth-based, testing is provided with depth factor 1.0. Lower depth decreases accuracy and higher depth rarely increases it.
- Typcal resolution for pretrained models is 224px resolution although it can vary

### Benchmarks

Using Intel i7 with nVidia GTX-1050 and image size 800px

#### Image Classification

| Model               | Size   | Tensors | Accuracy | Performance |
|---------------------|--------|---------|----------|-------------|
| MobileNet v1        | 16 MB  | 72      | 82.81%   | 99 ms       |
| MobileNet v2        | 13 MB  | 125     | 82.81%   | 104 ms      |
| Inception ResNet v2 | 223 MB | 500     | 89.84%   | 135 ms      |
| ResNet v2           | 178 MB | 283     | 81.25%   | 150 ms      |
| Inception v1        | 26 MB  | 120     | 78.13%   | 105 ms      |
| Inception v2        | 44 MB  | 145     | 78.13%   | 110 ms      |
| Inception v3        | 95 MB  | 194     | 85.94%   | 127 ms      |
| NasNet Mobile       | 21 MB  | 574     | 78.91%   | 119 ms      |

#### Image Object Detection

| Model                | Size   | Tensors | Accuracy | Performance |
|----------------------|--------|---------|----------|-------------|
| Coco/SSD v2          | 67 MB  | 202     | 60.94%   | 147 ms      |
| DarkNet/Yolo v1 Tiny | 63 MB  | 42      | 34.38%   | 139 ms      |
| DarkNet/Yolo v2 Tiny | 44 MB  | 42      | 50.00%   | 145 ms      |
| DarkNet/Yolo v3 Tiny | 35 MB  | 59      | 29.69%   | 136 ms      |
| DarkNet/Yolo v1 Full | 248 MB | 366     | 62.50%   | 280 ms      |

## Links

- TensorFlowJS: <https://www.tensorflow.org/js/>
- Datasets: <https://www.tensorflow.org/resources/models-datasets>
- MobileNet: <https://github.com/tensorflow/models/blob/master/research/slim/nets/mobilenet/README.md>
- DarkNet Yolo: <https://pjreddie.com/darknet/yolo/>
- Face/Gender/Age: <https://github.com/justadudewhohacks/face-api.js>
- PoseNet: <https://github.com/tensorflow/tfjs-models/tree/master/posenet>
- BodyPix: <https://github.com/tensorflow/tfjs-models/tree/master/body-pix>
- NSFW: <https://github.com/infinitered/nsfwjs>

## TBD

- Full ImageNet model
