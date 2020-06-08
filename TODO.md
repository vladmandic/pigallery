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
