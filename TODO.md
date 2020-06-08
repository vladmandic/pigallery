# TODO

## Open Bugs

- Better handle duplicate folder names in gallery view

## Future Features

- Move long processing to worker thread
- Server-side search & data paging for large galleries
- Server-side processing using TFJS-Node once WSL2 supports CUDA
- Live video processing for Webcam feeds
- Hot reload for config
- Upgrade from @tensorflow/tfjs@1.7.4 to @tensorflow/tfjs@2.0.0: Face-API Incompatibility

## Convert

    TF-Saved to TFJS: tensorflowjs_converter --input_format tf_hub --output_format tfjs_graph_model --signature_name serve_default --skip_op_check --weight_shard_size_bytes 4194304 https://tfhub.dev/google/bit/s-r101x1/1 .

## Models

ImageNet 21k: <https://tfhub.dev/google/collections/bit/1>
iNaturalist: <https://tfhub.dev/google/inaturalist/inception_v3/feature_vector/4>
PlaNet Geo Guess: <https://tfhub.dev/google/planet/vision/classifier/planet_v2/1>
PoseNet: <https://github.com/tensorflow/tfjs-models/tree/master/posenet>
BodyPix: <https://github.com/tensorflow/tfjs-models/tree/master/body-pix>
MicrosoftAI Species Classification: <https://www.microsoft.com/en-us/ai/ai-for-earth-tech-resources> <https://tfhub.dev/microsoft-ai-for-earth/vision/detector/megadetector_V3/1>
MediaPipe Hand & Face: <https://www.mediapipe.dev/>
SSD/OpenImages v4: <https://tfhub.dev/google/openimages_v4/ssd/mobilenet_v2/1>
Other: <https://github.com/tensorflow/models/tree/master/research/slim>

MobileNet v2:     DB ImageNet-1k  size  13 MB 125 tensors resolution 224 performance 137 ms avg
Inception v3:     DB ImageNet-1k  size  91 MB 194 tensors resolution 224 performance 193 ms avg
ResNet v2-50:     DB ImageNet-1k  size  98 MB 147 tensors resolution 224 performance 147 ms avg
ResNet v2-101:    DB ImageNet-1k  size 170 MB 283 tensors resolution 224 performance  96 ms avg
Inception-ResNet: DB ImageNet 1k  size 213 MB 500 tensors resolution 224 performance 165 ms avg
EfficientNet B0:  DB ImageNet 1k  size: 20 MB 168 tensors resolution 224 performance 131 ms avg
EfficientNet B7:  DB ImageNet 1k  size 253 MB 552 tensors resolution 600 performance 897 ms avg
BiT-S R101x1      DB ImageNet 21k size 162 MB 321 tensors resolution 224 performance 312 ms avg
BiT-M R101x1      DB ImageNet 21k size 333 MB 321 tensors resolution 224 performance 381 ms avg
