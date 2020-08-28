# PiGallery

## Secure & fast multi-user image gallery with machine learning image processing and analysis

<br>

## Key features

### At it's core, **PiGallery** builds a database of images which includes

- Image thumbnails for fast display
- Image analysis using machine learning using multiple image classification and object detection models
- Image perception hash to quickly locate duplicate image regardless of size or to search for simmilar images
- Image conditions using analysis of camera settings
- Person age, gender & emotion modelling and NSFW classification
- Image geo-location
- Lexicon definitions for complete image description
- Analysis is always incremental so only new or modified images will be analyzed
- All data is stored in a server-side database and original image is never modified

### As an image gallery viewer, **PiGallery** provides

- Secure, multi-user access to image database
- Fully responsive design for desktop & mobile usage
- Installable as an application (PWA) or can be used as a web page
- Client-side caching with incremental updates
- Flexible sorting and navigation using folders, locations or classes
- Flexible natural language search
- Quickly share generated albums with public users
- Locate and select images on a world map
- Find duplicate and/or simmilar images
- View image slideshow
- Multiple display themes (light & dark) and fully configurable user interface
- Play with machine learning detection of live video using your camera

### And it's **FAST**

- Initial access (no cache) of database with 10,000 images completes in less than 1 minute  
  (if your internet link is not a bottleneck)
- Subsequent access (cached) with incremental database updates: less than 5 seconds for application startup and gallery load

If you'd like to include any additional image analysis (additional machine models or static analysis), drop a note!

<br>
<br>
<br>

## Screenshots

<center>

### Gallery view

![alt text](assets/screenshot-gallery.png)

### Detailed View

![alt text](assets/screenshot-details.png)

### Complex Search Results

![alt text](assets/screenshot-search.png)

### Live Video

![alt text](assets/screenshot-video.png)

</center>

<br>
<br>
<br>

## Install, Configure & Run

### Install

- Install NodeJS: <https://nodejs.org/en/>
- Download PiGallery:
  using Git: `git clone --depth 1 https://github.com/vladmandic/pigallery`  
  or download archive from <https://github.com/vladmandic/pigallery/releases/>
- Install PiGallery:  
  run `./setup.js`

### Configure

Edit `config.json`:

    users: must contain at least one valid user to be able to login into application  
      Note: users.*.mediaRoot is a starting point for a user,  
      can be same as server.mediaRoot if you want user to have access to all media files,  
      otherwise it should be the subfolder within server.mediaRoot  
      Note: users includes one predefined user `share` used for anonymous album sharing
    locations: must contain at least one valid location containing images to be analyzed  
      Note: folder is relative to server.mediaRoot
    server: general section containing following key options:
      httpPort, httpsPort, http2Port: ports on which to run web server,  
        set to 0 if you want to disable a specific server  
        note that https and http2 require valid SSLKey and SSLCrt  
      allowPWA: should application be installable as progressive web application?
      authForce: force user authentication or allow anonymous users?
      mediaRoot: used as a root for any location to be analyzed - must be set to a valid folder on a local storage
      defaultLimit: size of initial set of images to set to client before rest is downloaded as a background task
      forceHTTPS: should any unsecure http request be redirected to https?

Optionally edit `client/config.js` for image processing settings  
Key options are:

    backEnd: 'webgl',        // back-end used by tensorflow for image processing, can be webgl, cpu, wasm
    floatPrecision: true,    // use 32bit or 16bit float precision
    maxSize: 780,            // maximum image width or height that will be used for processing before resizing is required
    renderThumbnail: 230,    // resolution in which to store image thumbnail embedded in result set
    batchProcessing: 1,      // how many images to process in parallel

Optionally edit `client/model.js` to select active models  
Note that models can be loaded from either local storage or directly from an external http location

### Run

- Run server application using `npm start`
  - Server uses ESBuild to build client distribution in `./dist` and starts HTTP/HTTPS2/HTTP2 server
- Use your browser to connect to server
  - Default view is image gallery. If there are no processed images, it's blank
  - Select `User`->`Update DB` to start image processing (opens separate browesr window)
  - Select `Live Video` to play with your webcam or provide mp4 video file

<br>
<br>
<br>

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
`"Happy female in 20ies in Miami wearing dress and dining outdoors"`

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

### Swipe controls

- Swipe down will refresh image database
- Swipe left and right are previous and next image in details view

<br>
<br>
<br>

## Image Processing

- If you get `Error: Failed to compile fragment shader`, you've run out of GPU memory.  
  Just restart processing and it will continue from the last known good result.
- Model load time can be from few seconds to over a minute depending on model size (in MB)
- Model warm-up time can be from few seconds to over a minute depending on model complexity (number of tensors)
- Once models are loaded and ready, actual processing is ~1sec per image
- Image analysis is maximized out-of-the-box for a GPU-accelerated system using WebGL acceleration and GPU with minimum of 4GB of memory  
- For high-end systems with 8GB or higher, you can further enable ImageNet 21k models  
- For low-end systems with 2GB or less, enable analysis based on MobileNet v2 and EfficientNet B0  
- Usage without GPU acceleration is not recommended  
- Note that GPU is not required for image gallery, only for initial processing  

### Recommended machine learning models

- **Image classification**:
  - Inception v4 trained on ImageNet 1000 dataset
  - EfficientNet B5 trained on ImageNet 1000 dataset
  - Inception v3 trained on DeepDetect 6000 dataset
  - MobileNet v1 trained on AIY 2000 dataset
  - Inception v3 trained on NSFW dataset
- **Object detection**:
  - SSD/MobileNet v2 trained on CoCo 90 dataset
  - SSD/MobileNet v2 trained on OpenImages 600 dataset
- **Age/Gender**:
  - SSD/MobileNet v1 from Face-API

<br>
<br>
<br>

### Links

- **Code Repository**: <https://github.com/vladmandic/pigallery>  
- **Changelog**: <https://github.com/vladmandic/pigallery/CHANGELOG.md>  
- **Todo List**: <https://github.com/vladmandic/pigallery/TODO.md>  
- **Notes on Models**: <https://github.com/vladmandic/pigallery/MODELS.md>  

<br>
<br>
<br>
