# TODO

## Open Bugs

N/A

## Future Features

- Move long processing to worker thread
- Server-side search & data paging for large galleries
- Server-side processing using TFJS-Node once WSL2 supports CUDA
- Live video processing for Webcam feeds
- Hot reload for config
- Upgrade from @tensorflow/tfjs@1.7.4 to @tensorflow/tfjs@2.0.0: Face-API Incompatibility

## Convert

TF-Hub to TFJS: `tensorflowjs_converter --input_format tf_hub --output_format tfjs_graph_model --signature_name serving_default --skip_op_check --weight_shard_size_bytes 4194304 <url> .`

## Open Models

ImageNet 21k: <https://tfhub.dev/google/collections/bit/1>
iNaturalist: <https://tfhub.dev/s?q=inaturalist>
PlaNet: <https://tfhub.dev/google/planet/vision/classifier/planet_v2/1>
PoseNet: <https://github.com/tensorflow/tfjs-models/tree/master/posenet>
BodyPix: <https://github.com/tensorflow/tfjs-models/tree/master/body-pix>
SSD/OpenImages v4: <https://tfhub.dev/google/openimages_v4/ssd/mobilenet_v2/1>

## Hosted Models

<https://www.clarifai.com/> <https://github.com/Clarifai/clarifai-javascript>
<https://www.mediapipe.dev/>
<https://www.microsoft.com/en-us/ai/ai-for-earth-tech-resources>
