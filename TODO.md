# TODO

## Open Bugs

N/A

## Future Features

- Move long processing to worker thread // https://stackoverflow.com/questions/10344498/best-way-to-iterate-over-an-array-without-blocking-the-ui/10344560
- Avoid 'page isn't responding'
- Server-side search & data paging for large galleries
- Server-side processing using TFJS-Node once WSL2 supports CUDA
- Live video processing for Webcam feeds
- Hot reload for config
- Upgrade from @tensorflow/tfjs@1.7.4 to @tensorflow/tfjs@2.0.0: Face-API Incompatibility

## Convert

TF-Hub to TFJS:

    tensorflowjs_converter --input_format tf_hub --output_format tfjs_graph_model --signature_name serving_default --skip_op_check --weight_shard_size_bytes 4194304 <url> .

TF-Saved to TFJS:
Requires that model has tags

    saved_model_cli show --dir . --all
    tensorflowjs_converter --input_format tf_saved_model --output_format tfjs_graph_model --skip_op_check --weight_shard_size_bytes 4194304 . ./tfjs/

TF-Frozen to TFJS:
Requires --output_node_names

    pip3 install tensorflow
    git clone https://github.com/tensorflow/tensorflow
    cd tensorflow
    wget https://github.com/bazelbuild/bazel/releases/download/3.1.0/bazel-3.1.0-installer-linux-x86_64.sh
    sudo ./bazel-3.1.0-installer-linux-x86_64.sh
    bazel build tensorflow/tools/graph_transforms:summarize_graph
    bazel-bin/tensorflow/tools/graph_transforms/summarize_graph --in_graph="/home/vlado/dev/tf-saved-models/inception-v4/saved-f32/inceptionv4_fp32_pretrained_model.pb"
      Found 1 possible inputs: (name=input, type=float(1), shape=[?,299,299,3])
      Found 1 possible outputs: (name=InceptionV4/Logits/Predictions, op=Softmax)
    tensorflowjs_converter --input_format tf_frozen_model --output_format tfjs_graph_model --skip_op_check --weight_shard_size_bytes 4194304 --output_node_names "InceptionV4/Logits/Predictions" "/home/vlado/dev/tf-saved-models/inception-v4/saved-f32/inceptionv4_fp32_pretrained_model.pb" ./tfjs/

    bazel-bin/tensorflow/tools/graph_transforms/summarize_graph --in_graph="/home/vlado/dev/tf-saved-models/deepdetect-6k/saved_model.pb"
    Found 1 possible inputs: (name=InputImage, type=float(1), shape=[1,299,299,3])
    Found 1 possible outputs: (name=multi_predictions, op=Sigmoid)

TF-Lite to TFJS:
Not possible.

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
