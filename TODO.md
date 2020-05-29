# TODO

## Open Bugs

- Better handle duplicate folder names in gallery view
- View details text sometimes not sized corretly on initial image load

## Future Features

- Add body, hands, eyes analysis
- Server-side search & data paging for large galleries
- Server-side processing using TFJS-Node once WSL2 supports CUDA
- Live video processing for Webcam feeds
- Slideshow per folder
- Upgrade from @tensorflow/tfjs@1.7.4 to  @tensorflow/tfjs@2.0.0 causes errors:
  - processImage.js: tf.webgl.forceHalfFloat(); is unknown - not yet implemented in WebGL
  - process.js: t.batchNormalization is not a function - not yet implemented in WebGL

## Resolved

- Log lines not visible in gallery view
- Scrollable image details text
- Find Duplicate does not have a visual hint
- Search does not recognize 'on' word
- Live video should not require admin priviledges
- Keyboard ESC should not reset search filter or selected folder
- View details showed at the edge of the screen when deselected
- View options should shown when image is shown, not in main menu
- Mouse cursor as drag arrows when it should not be: drag arrows are always shown on mouse click & hold which is correct
- Detect boxes don't redraw on image zoom
