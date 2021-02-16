# Configuration Details

Active client configuration can be edited in the client app via 'User' -> 'Settings'  
Active model configuration can be seen in the client app via 'User' -> 'Params'  

To modify client configuration advanced parameters, edit `client/shared/config.js`  

Main parameters are:
```js
  const config = {
    backEnd: 'webgl',     // back-end used by tensorflow for image processing, can be webgl, cpu, wasm
    floatPrecision: true, // use true (32bit) or false (16bit) float precision
    maxSize: 780,         // maximum image width or height that will be used for processing
                          // all images are resized to this resolution for in-memory processing only
                          // originals are never modified
    renderThumbnail: 230, // resolution in which to store image thumbnail embedded in result set
    batchProcessing: 1,   // how many images to process in parallel
                          // can be increased for faster processing, but uses extra GPU memory
  }
```

To modify model configuration, edit `model.json` to select active models for both image processing and live video  
