Optionally edit `client/shared/config.js` for image processing settings  

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
