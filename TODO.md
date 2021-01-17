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
- iMetropolitan: no tags in saved model: <https://tfhub.dev/metmuseum/vision/classifier/imet_attributes_V1/1>

## Random

- Jeeliz: https://github.com/jeeliz/jeelizFaceFilter

###

- Compare: Human
- Video:
  Input scalling
  Add Various
  Add Object Detection to Various
  Add Image Classification to Various
- Process: 
  All Verify
- Model errors:
  - COCO CenterNet
- Switch backend DB from NEDB to Mongo

<edge://gpu> lose_context_on_out_of_memory

<https://tensorflow.github.io/tfjs/e2e/benchmarks/local-benchmark/index.html>
1st inference	204.4 ms
Peak memory	19.63 MB
Leaked tensors	0
2nd inference	233.5 ms
Number of kernels	122
Subsequent average(50 runs)	120.0 ms
Best time	117.7 ms

async function resetBackend(backendName) {
  const engine = tf.engine();
  if (backendName in engine.registry) {
    const backendFactory = tf.findBackendFactory(backendName);
    tf.removeBackend(backendName);
    tf.registerBackend(backendName, backendFactory);
  }
  await tf.setBackend(backendName);
}
