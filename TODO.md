# TODO

## Open Bugs

N/A

## Future Features

- Server-side processing using TFJS-Node: nVidia CUDA on WSL2 requires kernel 4.19.121 current 4.19.104
- Options editor
- Upgrade from @tensorflow/tfjs@1.7.4 to @tensorflow/tfjs@2.0.0: Face-API Incompatibility
- Use DeepDetect model

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

PlaNet: <https://tfhub.dev/google/planet/vision/classifier/planet_v2/1>
PoseNet: <https://github.com/tensorflow/tfjs-models/tree/master/posenet>
BodyPix: <https://github.com/tensorflow/tfjs-models/tree/master/body-pix>
TensorFlow zoo: <https://docs.openvinotoolkit.org/latest/_docs_MO_DG_prepare_model_convert_model_Convert_Model_From_TensorFlow.html>
ImageNet 21k: <https://tfhub.dev/google/collections/bit/1>

## Hosted Models

<https://www.clarifai.com/> <https://github.com/Clarifai/clarifai-javascript> Exposed as RestAPI
<https://www.mediapipe.dev/> project by Google, models are TFLite
<https://www.microsoft.com/en-us/ai/ai-for-earth-tech-resources>

## Data sets

iNaturalist: 5089 classs from 0.6M images in 237GB <https://www.tensorflow.org/datasets/catalog/i_naturalist2017>
OpenImages challenge: 500 classes from 9M images in 534GB <https://www.tensorflow.org/datasets/catalog/open_images_v4> <https://storage.googleapis.com/openimages/web/index.html>
Cars <https://www.tensorflow.org/datasets/catalog/cars196>

    tensorflowjs_converter --input_format tf_hub --output_format tfjs_graph_model --skip_op_check --weight_shard_size_bytes 4194304 ../models/inaturalist/q/ .
    Creating a model with inputs ['images'] and outputs ['module_apply_default/embed_norm'].

## iNaturalist

iNaturalist: <https://tfhub.dev/s?q=inaturalist> <https://github.com/richardaecn/cvpr18-inaturalist-transfer>
iNaturalist competition is uses obfucated taxonomy since 2018
Competitions: <https://github.com/visipedia/inat_comp>
Dataset: <https://www.kaggle.com/c/inaturalist-2019-fgvc6/data> <https://github.com/visipedia/inat_comp/tree/master/2017>
Model Small: <https://www.kaggle.com/sujoykg/xception-keras/>
Model Large: <https://www.kaggle.com/cedriclacrambe/inaturalist-xception-512/>
Lexicon Latin: <https://www.gbif.org/dataset/search>
Lexicon Government: <https://www.itis.gov/>
Lookup: <http://www.gbif.org/species/{gbid}> <https://api.gbif.org/v1/species?name={name}>
Hierarchy: categogy -> kingdom -> phylum -> class -> order -> family -> genus -> name
