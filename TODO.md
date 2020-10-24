# TODO

## Future Features

- Validate full install from scratch
- User DB management client-side
- User DB check server-side
- Move compare to main app as test feature

## Desired Models

Didn't find:

- Places365: all found pre-trained weights are for PyTorch
- Objects365: new dataset, no public pre-trained weights so far
- ImageNet 21k: Huge
- iNaturalist: feature-vector only, no classification: <https://tfhub.dev/google/inaturalist/inception_v3/feature_vector/4>
- Wine: no tags in saved model: <https://tfhub.dev/google/on_device_vision/classifier/popular_wine_V1/1>
- Products: no tags in saved model: <https://tfhub.dev/google/on_device_vision/classifier/popular_us_products_V1/1>
- iMetropolitan: no tags in saved model: <https://tfhub.dev/metmuseum/vision/classifier/imet_attributes_V1/1>

## Random

- Jeeliz: https://github.com/jeeliz/jeelizFaceFilter

###

- Video scalling
- NudeNet
- CenterNet
- EfficientDet
- Error: Failed to compile fragment shader.

now that <https://github.com/tensorflow/tfjs/pull/4100> is comitted, i've tried it out and no luck.

fresh build from [master](https://github.com/tensorflow/tfjs/commit/cbaa09e5558f1eae6610704c2889222f9db4ea7b)  
tested with **node** (`tfjs-node`) and **browser** (`tfjs-backend-webgl`) environments - both **fail** exactly the same as 

```
TypeError: Cannot read property 'children' of undefined
    at operation_mapper.js:299
    at Array.forEach (<anonymous>)
    at operation_mapper.js:296
    at Array.forEach (<anonymous>)
    at OperationMapper.mapFunction (operation_mapper.js:294)
    at operation_mapper.js:129
    at Array.reduce (<anonymous>)
    at OperationMapper.transformGraph (operation_mapper.js:128)
    at GraphModel.loadSync (graph_model.js:123)
    at GraphModel.load (graph_model.js:105)
```

- browser: 

