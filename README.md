# PiGallery

## Multi-user image galley with TensorFlow/JS image processing and full EXIF data extraction and analysis

**Repository: <https://github.com/vladmandic/pigallery>**  
**Changelog: <CHANGELOG.md>**  
**Todo List: <TODO.md>**  
**Notes on Models: <MODELS.md> and <MODELS.xlsx>**

## Screenshots

<center>

### Gallery view

![alt text](assets/screenshot-gallery.png)

### Detailed View

![alt text](assets/screenshot-details.png)

![alt text](assets/screenshot-mobile.png)

### Complex Search Results

![alt text](assets/screenshot-search.png)

### Live Video

![alt text](assets/screenshot-video.png)

</center>

## Install, Configure & Run

### Install

- Install NodeJS: <https://nodejs.org/en/>
- Download PiGallery: `git clone --depth 1 https://github.com/vladmandic/pigallery`
- Install PiGallery: `./setup.js`

### Configure

Create `config.json` using `config.json.sample` as a reference

    users: must contain at least one valid user to be able to login into application  
      Note: users.*.mediaRoot is a starting point for a user,  
      can be same as server.mediaRoot if you want user to have access to all media files,  
      otherwise it should be the subfolder within server.mediaRoot
    locations: must contain at least one valid location containing images to be analyzed  
      Note: folder is relative to server.mediaRoot
    server: general section containing following key options:
      httpPort, httpsPort, http2Port: ports on which to run web server,  
        set to 0 if you want to disable a specific server  
        note that https and http2 require valid SSLKey and SSLCrt  
      allowPWA: should application be installable as progressive web application?
      authForce: force user authentication or allow anonymous users
      mediaRoot: must be set to a valid folder. used as a root for any location to be analyzed.
      defaultLimit: size of initial set of images to set to client before rest is downloaded as a background task
      forceHTTPS: should any http request be redirected to https?

Optionally edit `client/config.js` for image processing settings  
Key options are:

    backEnd: 'webgl',        // back-end used by tensorflow for image processing, can be webgl, cpu, wasm
    floatPrecision: true,    // use 32bit or 16bit float precision
    maxSize: 780,            // maximum image width or height that will be used for processing before resizing is required
    renderThumbnail: 230,    // resolution in which to store image thumbnail embedded in result set
    batchProcessing: 1,      // how many images to process in parallel

Optionally edit `client/model.js` to select active models  
Note that models can be loaded from either local storage or directly from an external http location such as <tfhub.com>

### Run

- Run server application using `npm start`
  - Server uses ESBuild to build client distribution in `./dist` and starts HTTP/HTTPS2/HTTP2 server
- Use your browser to connect to server
  - Default view is image gallery. If there are no processed images, it's blank
  - Select `User`->`Update DB` to start image processing (opens separate browesr window)
  - Select `Live Video` to play with your webcam or provide mp4 video file

## General Notes

### Metadata

Processing builds tags from all available image metadata:

- Image Metadata:
  - Size, Creation and Modification timestamps
  - Camera & lens details and settings used for image capture
  - Software used for editing, etc.
  - GPS Coordinates
    Matched to location database for place description and location of nearest larger center for purpose of groupping
- Image Analysis
  - Multiple iamge classification models
  - Multiple object detection models
  - Face age/gender/emotion detection
  - NSFW detection
  - Perception hash calculation
    Used to compare image simmilarity between any images or to find simmilar images
- Lexicon lookups for any detected terms
  - This includes hierarchical lookups - for example, *gown* will also include *dress, clothing, etc.*

Collected metadata is additionally analyzed to render human-readable search terms

- Age can be specified as: *20ies, 30ies, kid, old, etc.*
- Camera settings can be specified as: *bright, dark, indoors, outdoors, etc.*
- Lens settings can be specified as: *superzoom, zoom, portrait, wide, ultrawide*
- Special words can be used in search terms to form a sentence: *the, a, in, wearing, having, etc.*

### Search

Result of all metadata processing is a very flexbile search engine - take a look at this example:

<center>

`"Happy female in 20ies in Miami wearing dress and dining outdoors"`

</center>

### Keyboard shortcuts

      ENTER : Execute any open input
      ESC   : Close any dialogs and reset view
      \     : Reload data
      /     : Open search input
      .     : Open sort interface
      ,     : Show/hide image descriptions in gallery view
      Arrow Left & Right : Previous & Next image when in detailed view
      Arrow Up & Down: Scroll up & down by one line when in gallery view
      Page Up & Down: Scroll up & down by one page when in gallery view
      Home & End: Scroll to start & end when in gallery view

### TensorFlow Processing

- If you get `Error: Failed to compile fragment shader`, you've run out of GPU memory.  
  Just restart processing and it will continue from the last known good result.
- Model load time can be from few seconds to over a minute depending on model size (in MB)
- Model warm-up time can be from few seconds to over a minute depending on model complexity (number of tensors)

Details on tested models (sizes, number of tensors, performance, etc.) can be seen in attached `MODELS` spreadsheet <MODELS.xlsx>

### Model Benchmarks

- Using Intel i7 with nVidia GTX-1050
- Sample is of 1,000 random images with processing size normalized to 780px
- Testing is performed using 32bit float precision configured in `client/config.js`.

## Links

- TensorFlowJS: <https://www.tensorflow.org/js/>
- Datasets: <https://www.tensorflow.org/resources/models-datasets>
- MobileNet: <https://github.com/tensorflow/models/blob/master/research/slim/nets/mobilenet/README.md>
- Inception: <https://towardsdatascience.com/review-inception-v4-evolved-from-googlenet-merged-with-resnet-idea-image-classification-5e8c339d18bc>
- DarkNet Yolo: <https://pjreddie.com/darknet/yolo/>
- Face/Gender/Age: <https://github.com/justadudewhohacks/face-api.js>
- EfficientNet: <https://github.com/tensorflow/tpu/tree/master/models/official/efficientnet>

<center>

![alt text](favicon.ico)

</center>
