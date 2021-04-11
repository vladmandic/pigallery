![Version](https://img.shields.io/github/package-json/v/vladmandic/pigallery?style=flat-square?svg=true)
![Last Commit](https://img.shields.io/github/last-commit/vladmandic/pigallery?style=flat-square?svg=true)
![License](https://img.shields.io/github/license/vladmandic/pigallery?style=flat-square?svg=true)
![Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/vladmandic/pigallery?style=flat-square?svg=true)
![Code Size](https://img.shields.io/github/languages/code-size/vladmandic/pigallery?style=flat-square?svg=true)

# PiGallery

## PiGallery: AI-powered Self-hosted Secure Multi-user Image Gallery and Detailed Image analysis using Machine Learning, EXIF Parsing and Geo Tagging

<br>

## Key features

### At it's core, **PiGallery** builds a searchable database of images  

- Image thumbnails for fast display
- Image analysis using machine learning using multiple image classification and object detection models
- Image perception hash to quickly locate duplicate image regardless of size or to search for similar images
- Image conditions using analysis of camera settings (light, dark, zoom, wide, etc.)
- Person age, gender & emotion modelling and NSFW classification
- Image geo-location including nearest city for quick searches
- Lexicon definitions for complete image description

### As an image gallery viewer, **PiGallery** provides

- Secure, multi-user access to image database
- Fully responsive design for desktop & mobile usage
- Installable as an application (PWA) or can be used as a web page
- Client-side caching with incremental updates
- Flexible sorting and navigation using folders, locations or classes
- Flexible natural language search
- Quickly share generated albums with public users
- Locate and select images on a world map
- Find duplicate and/or similar images
- View image slideshow
- Multiple display themes (light & dark) and fully configurable user interface
- Play with machine learning detection of live video using your camera

### And on a server side

- Analysis is always incremental so only new or modified images will be analyzed
- All data is stored in a server-side database and original image is never modified

### And it's **FAST**

- Initial access (no cache) of database with 10,000 images completes in less than 1 minute  
  (depending on your network speed)
- Subsequent access (cached) with incremental database updates:
  less than 5 seconds for application startup and gallery load

<br>

*If you'd like to include any additional image analysis (additional machine models or static analysis), drop a note!*

<br><hr><br>

## Screenshots

<center>

### Screenshot: Gallery view

![alt text](assets/screenshot-gallery.png)

### Screenshot: Detailed View

![alt text](assets/screenshot-details1.png)

![alt text](assets/screenshot-details2.png)

</center>

<br><hr><br>

## Install, Configure & Run

### Install

- Install NodeJS: <https://nodejs.org/en/>
- Download PiGallery:  
  using Git: `git clone --depth 1 https://github.com/vladmandic/pigallery`  
  or download archive from <https://github.com/vladmandic/pigallery/releases/>

### Configure

- Configure PiGallery:  
  `./setup.js` or `npm run setup`:  
  which automatically installs all dependencies  
  and creates default configuration in `config.json` and `models.json`:

  ```text
  Starting Setup
  @vladmandic/pigallery server v2.2.9
  Platform=linux Arch=x64 Node=v15.4.0
  Project dependencies
  production: 19
  development: 8
  optional: 0
  NPM install production modules completed in 7,516ms
  NPM install development modules completed in 5,819ms
  NPM update modules completed in 6,757ms
  NPM deduplicate modules completed in 2,370ms
  NPM prune unused modules completed in 2,513ms
  Deleting module samples completed in 49ms
  NPM outdated check completed in 6,257ms
  NPM indirect outdated modules: 75
  NPM list full completed in 1,225ms
  Total dependencies: production=176 development=450 optional=2
  Results written to setup.json
  Configuration file not found: config.json
  Creating default configuration
  Enter default admin user email: demo@example.com
  Enter default admin user password: demo
  Using media/ as image root containing sample images
  Using 10010 as default HTTP server port
  Using 10011 as default HTTPS server port  
  Default configuration created
  Configuration file not found: models.json
  Creating default configuration
  Default models configuration created
  ```

### Run

- Run server application:  
  `npm start`  
  - Optionally use provided `pigallery.service` as a template to run as a Linux **systemd** service
  - Server monitors client files for changes and runs automatic client application rebuild as needed
  - Server log is written to file specified in the `config.json` (default is `pigallery.log`)

  ```js
  2021-03-03 10:08:36 INFO:  @vladmandic/pigallery version 3.3.5
  2021-03-03 10:08:36 INFO:  User: vlado Platform: linux Arch: x64 Node: v15.7.0
  2021-03-03 10:08:36 STATE:  Application log: /home/vlado/dev/pigallery/pigallery.log
  2021-03-03 10:08:36 INFO:  Authentication required: true
  2021-03-03 10:08:36 INFO:  Media root: media/
  2021-03-03 10:08:36 INFO:  Allowed image file types: [ '.jpeg', '.jpg', [length]: 2 ]
  2021-03-03 10:08:36 DATA:  Build sources: [ 'client/compare/compare.js', 'client/index/index.js', 'client/process/process.js', 'client/video/video.js', [ 'client/index/worker.js', 'client/index/pwa-serviceworker.js' ]
  2021-03-03 10:08:36 STATE:  Change log updated: /home/vlado/dev/pigallery/docs/change-log.md
  2021-03-03 10:08:38 STATE:  Client application rebuild: 1545 ms 37 imports in 352312 bytes 1245 modules in 8452413 bytes 6 outputs in 16622342 bytes
  2021-03-03 10:08:40 STATE:  Client CSS rebuild: 2491 ms imports 554134 byes outputs 453911 bytes
  2021-03-03 10:08:40 STATE:  Mounted: auth from client/auth.html
  2021-03-03 10:08:40 STATE:  Mounted: compare from client/compare.html
  2021-03-03 10:08:40 STATE:  Mounted: index from client/index.html
  2021-03-03 10:08:40 STATE:  Mounted: offline from client/offline.html
  2021-03-03 10:08:40 STATE:  Mounted: process from client/process.html
  2021-03-03 10:08:40 STATE:  Mounted: video from client/video.html
  2021-03-03 10:08:40 STATE:  Server HTTP listening: { address: '::', family: 'IPv6', port: 10010 }
  2021-03-03 10:08:40 STATE:  Server HTTPS listening: { address: '::', family: 'IPv6', port: 10011 }
  2021-03-03 10:08:40 STATE:  Monitoring: [ 'config.json', 'package.json', 'server', 'client', 'assets' ]
  2021-03-03 10:08:48 STATE:  Image DB loaded: pigallery.db records: 7581
  2021-03-03 10:08:48 STATE:  Shares: Samples creator: mandic00@live.com key: qoy6ic.ibnwn images: 110
  2021-03-03 10:08:48 STATE:  RESTful API ready
  2021-03-03 10:08:48 STATE:  Loaded WordNet database: assets/wordnet-synset.json 60942 terms in 24034816 bytes
  2021-03-03 10:08:50 STATE:  Loaded all cities database: assets/cities.json 195175 all cities 4426 large cities    ```

- Use your browser to navigate to server:  
  `https://localhost:10010` or `https://localhost:10011` (default values)
  - Default view is image gallery.
  - Client access is logged on server:

  ```js
  2021-02-16 11:41:57 INFO:  API/User/Auth demo@example.com@::1 demo@example.com true
  2021-02-16 11:41:58 INFO:  API/User/Get demo@example.com@::1 { user: 'demo@example.com', admin: true, root: 'media/' }
  2021-02-16 11:41:58 INFO:  API/Record/Get demo@example.com@::1 root: media/ images: 0 limit: 100000 chunk: 200 since: 2021-02-16T16:41:59.585Z
  2021-02-16 11:41:58 INFO:  API/Record/Get Chunk page: 0 of 1 size: 2 total: 2
  2021-02-16 11:41:58 INFO:  API/Log demo@example.com@::1 Stats: images:0, latency:54, fetch:118, interactive:217, complete:244, load:52, store:0, size:2, speed:0, initial:3, remaining:2, enumerate:73, ready:272, cache:0, pageMode:Standalone, appMode:Browser
  ```

- If there are no processed images, gallery view is empty  
  Select `User`->`Update DB` to start image processing  
  of provided sample images using default models  
  specified in `models.json`:

  ```js
  12:09:03.640 Requesting file list from server ...
  12:09:05.218   Analyzing folder: Samples/ matching: * recursive: false force: false pending: 110
  12:09:05.219   Analyzing folder: People/ matching: * recursive: true force: false pending: 2309
  12:09:05.219   Analyzing folder: Photos/ matching: * recursive: true force: false pending: 4368
  12:09:05.220   Analyzing folder: Pictures/Samsung Gallery/Snapseed matching: * recursive: false force: false pending: 812
  12:09:05.220   Analyzing folder: Pictures/Camera Roll/ matching: -01.jp recursive: false force: false pending: 0
  12:09:05.221 Starting Image Analsys
  12:09:05.239 Image Classification models:
  12:09:05.239   ImageNet EfficientNet B4
  12:09:05.239   DeepDetect Inception v3
  12:09:05.239   Places365 ResNet-152
  12:09:05.239 Object Detection models:
  12:09:05.239   COCO CenterNet ResNet50-v2
  12:09:05.240   OpenImages SSD MobileNet v2
  12:09:05.240   NudeNet
  12:09:05.240 Face Detection model:
  12:09:05.240   Human
  12:09:05.240 TensorFlow models loading ...
  12:09:17.876 TensorFlow models loaded: 12,636ms
  12:09:17.876 Initializing TensorFlow/JS version 3.3.0
  12:09:17.881 Configuration:
  12:09:17.882   Backend: WEBGL
  12:09:17.882   Parallel processing: 1 parallel images
  12:09:17.882   Forced image resize: 720px maximum shape: native
  12:09:17.882   Auto reload on error: true
  12:09:17.882   WebGL: Enabling memory deallocator
  12:09:17.882   WebGL: webgl_delete_texture_threshold: 0
  12:09:17.882   WebGL: webgl_force_f16_textures: false
  12:09:17.882   WebGL: webgl_pack_depthwiseconv: false
  12:09:17.882   WebGL: webgl_cpu_forward: true
  12:09:17.905 TensorFlow engine state: Bytes: 781,759,369 Buffers: 10,345 Tensors: 10,345
  12:09:17.916 TensorFlow flags: IS_BROWSER:true, IS_NODE:false, DEBUG:false, WEBGL_VERSION:2, HAS_WEBGL:true, PROD:true, WEBGL_CHECK_NUMERICAL_PROBLEMS:false, TENSORLIKE_CHECK_SHAPE_CONSISTENCY:false, WEBGL_DELETE_TEXTURE_THRESHOLD:0, WEBGL_FORCE_F16_TEXTURES:false, WEBGL_PACK_DEPTHWISECONV:false, WEBGL_CPU_FORWARD:true
  12:09:17.916 TensorFlow warming up ...
  12:09:47.239 TensorFlow warmed up in 29,323ms
  12:09:47.245 Processing images: 7599 batch: 1
  ```

- Select `Live Video` to process live video from your device camera

<br><hr><br>

### Configuration Details

- [Server configuration documentation]('docs/client-server.md')
- [Client configuration documentation]('docs/client-config.md')
- [Model configuration documentation]('docs/config-models.md')

Additional nodes:

- [Default models configuration]('docs/models-default.md')
- [Recommended models configuration]('docs/models-recommended.md')
- [Model conversion notes]('docs/models-convert.md')
- [Server API]('docs/api.md')


<br><hr><br>

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
    Used to compare image similarity between any images or to find similar images
- Lexicon lookups for any detected terms
  - This includes hierarchical lookups - for example, *gown* will also include *dress, clothing, etc.*

Collected metadata is additionally analyzed to render human-readable search terms

- Age can be specified as: *20ies, 30ies, kid, old, etc.*
- Camera settings can be specified as: *bright, dark, indoors, outdoors, etc.*
- Lens settings can be specified as: *superzoom, zoom, portrait, wide, ultrawide*
- Special words can be used in search terms to form a sentence: *the, a, in, wearing, having, etc.*

<br>

### Image Processing

- If you get `Error: Failed to link vertex and fragment shaders`, you've run out of GPU memory.  
  Just restart processing and it will continue from the last known good result.  
  But if it continues, you need to reduce number of active models or use smaller models.  
- Model load time can be from few seconds to over a minute depending on model size (in MB)
- Model warm-up time can be from few seconds to over a minute depending on model complexity (number of tensors)
- Once models are loaded and ready, actual processing is ~0.1sec - ~1sec per image
- Image analysis is maximized out-of-the-box for a GPU-accelerated system using WebGL acceleration and GPU with minimum of 4GB of memory  
  For high-end systems with 8GB or higher, you can further enable ImageNet 21k models  
  For low-end systems with 2GB or less, enable analysis based on MobileNet v2 and EfficientNet B0 and do not use complex models  
- Usage without GPU acceleration is not recommended  
  Note that GPU is not required for image gallery, only for initial processing  

<br>

### Search

Result of all metadata processing is a very flexbile search engine - take a look at this example:  

  `"Happy female in 20ies in Miami wearing dress and dining outdoors"`

<br>

### Navigation

#### Keyboard shortcuts

```text
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
```

#### Swipe controlss

- Swipe down will refresh image database
- Swipe left and right are previous and next image in details view

<br><hr><br>

## Live Demo

This demo is an anonymous share of sample images on my home server:  
<https://pigallery.ddns.net?share=qqlny1.0cyk>

<br>

## Links

- **Code Repository**: <https://github.com/vladmandic/pigallery>  
- **Todo List**: <https://github.com/vladmandic/pigallery/docs/todo.md>  
- **Changelog**: <https://github.com/vladmandic/pigallery/CHANGELOG.md>  
- **License**: <https://github.com/vladmandic/pigallery/LICENSE>  

<br>
