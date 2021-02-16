# PiGallery

## Secure & fast multi-user image gallery with machine learning image processing and analysis

<br>

## Key features:

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

- Initial access (no cache) of database with 10,000 images completes in less than 1 minute (depending on your network speed)
- Subsequent access (cached) with incremental database updates: less than 5 seconds for application startup and gallery load

<br>

*If you'd like to include any additional image analysis (additional machine models or static analysis), drop a note!*

<br>

## Screenshots

<center>

### Screenshot: Gallery view

![alt text](assets/screenshot-gallery.png)

### Screenshot: Detailed View

![alt text](assets/screenshot-details1.png)

![alt text](assets/screenshot-details2.png)

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

### Configure

- Configure PiGallery: `./setup.js`:  
  which automatically installs all dependencies  
  and creates default configuration in `config.json`:

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
  ```

### Run

- Run server application: `npm start`  
  - Optionally use provided `pigallery.service` as a template to run as a Linux **systemd** service

  ```js
  2021-02-16 10:45:19 INFO:  @vladmandic/pigallery version 2.2.9
  2021-02-16 10:45:19 INFO:  User: vlado Platform: linux Arch: x64 Node: v15.4.0
  2021-02-16 10:45:19 STATE:  Application log: /home/vlado/dev/pigallery/pigallery.log
  2021-02-16 10:45:19 INFO:  Authentication required: true
  2021-02-16 10:45:19 INFO:  Media root: media/
  2021-02-16 10:45:19 INFO:  Allowed image file types: [ '.jpeg', '.jpg', [length]: 2 ]
  2021-02-16 10:45:19 DATA:  Build sources: [ 'client/compare/compare.js', 'client/index/index.js', 'client/process/process.js', 'client/prototype/prototype.js', 'client/video/video.js', [length]: 5 ] [ 'client/index/worker.js', 'client/index/pwa-serviceworker.js', [length]: 2 ]
  2021-02-16 10:45:19 STATE:  Change log updated: /home/vlado/dev/pigallery/CHANGELOG.md
  2021-02-16 10:45:20 STATE:  Client application rebuild: 704 ms 40 imports in 383638 bytes 1248 modules in 8531007 bytes 7 outputs in 7201354 bytes
  2021-02-16 10:45:22 STATE:  Client CSS rebuild: 1903 ms imports 554067 byes outputs 454018 bytes
  2021-02-16 10:45:22 STATE:  Mounted: auth from client/auth.html
  2021-02-16 10:45:22 STATE:  Mounted: compare from client/compare.html
  2021-02-16 10:45:22 STATE:  Mounted: index from client/index.html
  2021-02-16 10:45:22 STATE:  Mounted: offline from client/offline.html
  2021-02-16 10:45:22 STATE:  Mounted: process from client/process.html
  2021-02-16 10:45:22 STATE:  Mounted: prototype from client/prototype.html
  2021-02-16 10:45:22 STATE:  Mounted: video from client/video.html
  2021-02-16 10:45:22 STATE:  RESTful API ready
  2021-02-16 10:45:22 STATE:  Loaded WordNet database: assets/wordnet-synset.json 60942 terms in 24034816 bytes
  2021-02-16 10:45:23 STATE:  Loaded all cities database: assets/cities.json 195175 all cities 4426 large cities
  2021-02-16 10:45:24 STATE:  Server HTTP listening: { address: '::', family: 'IPv6', port: 10010 }
  2021-02-16 10:45:24 STATE:  Server HTTPS listening: { address: '::', family: 'IPv6', port: 10011 }
  2021-02-16 10:45:24 STATE:  Monitoring: [ 'config.json', 'package.json', 'server', 'client', 'assets', [length]: 5 ]
  2021-02-16 10:45:24 STATE:  Image DB loaded: pigallery.db records: 0
  ```

- Use your browser to navigate to server: `https://localhost:10010` or `https://localhost:10011` (default values)
  - Default view is image gallery.
    If there are no processed images, it's blank
  - Select `User`->`Update DB` to start image processing
  - Select `Live Video` to process live video from your device camera

### Configuration Details

- [Server configuration documentation]('docs/SERVER-CONFIG.md')
- [Client configuration documentation]('docs/CLIENT-CONFIG.md')
- [Model configuration documentation]('docs/MODELS.md')

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

<br>

### Links

- **Code Repository**: <https://github.com/vladmandic/pigallery>  
- **Changelog**: <https://github.com/vladmandic/pigallery/CHANGELOG.md>  
- **Todo List**: <https://github.com/vladmandic/pigallery/TODO.md>  
- **License**: <https://github.com/vladmandic/pigallery/LICENSE>  

<br>
