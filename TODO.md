# TODO

## Open Bugs

- Better handle duplicate folder names in gallery view

## Future Features

- Add body, hands, eyes analysis
- Duplicate image check using perception hashing
- Server-side search & data paging for large galleries
- Server-side processing using TFJS-Node once WSL2 supports CUDA
- Live video processing for Webcam feeds
- Infinite slideshow
- Upgrade from @tensorflow/tfjs@1.7.4 to  @tensorflow/tfjs@2.0.0 causes errors:
  - processImage.js: tf.webgl.forceHalfFloat(); is unknown - not yet implemented in WebGL
  - process.js: t.batchNormalization is not a function - not yet implemented in WebGL
