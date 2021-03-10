# PiGallery Architecture

<br><hr><br>

## 1. Server

Server is a single-process NodeJS app written in JavaScript ECMA2018  
Server configuration is in `config.json`  

Server consists of serveral functional groups:

### 1.1 Build server

- Watches source code for changes and triggers build & bundle of app
- Watches configuration files for external changes and reloads them as needed

### 1.2 Web server

- HTTP/HTTPS server that enumerates and mounts all pages  
  present in the source code as static endpoints
- Presents HTTPrest API endpoints for client access  
  [API documentation](https://github.com/vladmandic/pigallery/blob/master/docs/api.md)

### 1.3 Database server

- Loads and maintained main database  
  Access to database is internal to server,  
  only external access is via HTTPrest API  
- All database records are in JSON format
- Server also pre-loads WordNet database for definition lookups vs keywords during processing
- Server also pre-loads GeoLocation database for location matches during processing

### 1.4 Authentication/Authorization

Each server request goes through authentication/authorization

- Authentication is done using encrypted HTTP post requests  
  upon which server returns encoded session ID  
  that is stored in client's cookie for future usage
- Authorization is done via user matches in stored server configuration

### 1.5 Notes

- All server functionality is self-contained with no external dependencies and no internet access  
- Server is designed to run with user-level permissions for maximum security  

<br><hr><br>

## 2. Client

Client apps are static HMTL pages each with single JavaScript EMCA2018 prepared by *build server*  
There are no external dependencies or internet access required  

### 2.1 Client Viewer

This is the main user-visible module in user's browser

Viewer has number of configurable parameters that can be configured via UI or by modifying `client/shared/config.js`:

- Visuals such as thumbnail size and ratios, colors, fonts, date format
- Caching behavior for large objects such as ML models and static assets
- Gallery list options such as number of images to display

Viewer is designed to be as fast as possible with end-to-end startup time of 2-3 seconds  
Client-side caching is used whenever applicable, either for static resources or for dynamic database state

#### 2.1.1 Client Workflow

- Authentication  
  Client first authenticates with server via authentication dialog  
  Upon sucessfull authentication, encoded session cookie is stored  
  in browser so authentication dialog is bypassed for sucessful authentication via cookie
- Initializes PWA functionality  
  Performs offline caching of static resources  
  Configures application manifest to allow for application installation  
  Monitors client/server connectivity and automatically switches from online to offline mode
- Overrides browser history for the URL to allow for intelligent back/next operations  
  as well as refresh using pulldown on mobile platform, etc.
- Database download  
  If no database is present in browser (using browser's native IndexDB), client requests full update from server  
  If database is present in browser, client requests incremental update since last load  
  When performing database download, client requests specific chunk size from server to allow parallel download and recombines it client-side
- Client immediately displays gallery view of first `n` records  
  and performs further database updates and subsequent operations in the background
- Record enumeration
  Client analyzes all records in database and to dynamically build navigation menu

#### 2.1.2. Gallery View

Navigation:

- Folders, Locations, Classes  
  Record enumeration is performed upon each selection  
  For example, if specific folder is selected then location and classes are  
  re-enumerated to show only classes that would be present within that folder
- Keyboard naviation
  PiGallery supports keyboard navigation as [documented](https://github.com/vladmandic/pigallery/blob/master/README.md)

Scrolling:

- Intial gallery view is limited to `n` images for performance reasons  
  Upon scroll down, gallery automatically displays additional records

Sorting:

- By name, size, date, simmilarity

Map:

- Map view can be turned on/off to display clickable map in a cloud format of selected images

Search:

- Search can be performed on *any* tag stored in the record  
  see *processing workflow* on details how tags are build
- All search operations are performed client-side by filtering IndexDB in browser
- Search can be performed on multiple words thus creating a search sentence
- Search can include some simple language syntax operators such as "in", "on", etc
- Multi-search perfoms AND operation on each search term, so it's strict
- Example: *"Female in 20ies wearing dress having dinner in Miami outdoors"*:
  - person, dinner, dress are matched from ML classification and detection
  - female is matched as gender prediction for a person
  - 20ies is matches as age prediction with age between 20 and 29
  - Miami is matched based on Geolocation
  - Outdoors is matched based on camera settings
  - in, having, wearing are in the list of ignore words

Image-Level Operations:

- Most image-level operations are self-explanatory
  - Delete, View Details, Download
- View simmiar by:
  - Description: Performs logical compare of all tags for the specific image  
    to all images in database to find simmilar images and sort them by simmilarity
  - Simmilar images: Performs binary hash compare of perception hash for the specific image  
    to all images in database
  - Simmilar faces: Performs Euclidean distance compare of face embedding for the specific image  
    to all images in database

#### 2.1.3. Details View

Selecting an image opens a detailed view of the image with auto-resize and pan/zoom functionality  
Details view can display actual detection boxes around detected objects and people or just display image as-is

#### 2.1.4. Shares

Special functionality of PiGallery is to create and access anounymous shares

View:

- Select share to view its assigned URL

Create:

- To create share, user must have admin level authorization
- Preare list of images you want to share by:  
  Search for images, filtering them by folders, locations, classes, sorting them, etc.
- Select shares, assign share name and create share  
  Share is stored as list of images on the server  
  Each share is assigned unique URL on server
- Any access to share URL will immediately open list of images in the share  
  Example: <https://your.server.com?share=qoy6ic.ibnwn>  
  User that views a share cannot access any other images than ones selected in the share  
  Since user that views share is an anonymous user, he/she has lowest level authorization  
  and cannot modify database in any way

Delete:

- To delete a share, user must have admin level authorization
- Deleting a share deletes the share URL from server and share list from server databaase

### 2.2. Client Processor

- Processing is done in client to take advantage of client processing resources  
  such as GPU acceleration and to keep server load to absolute minimum.
- This separation also allows multiple clients to perform processing  
  while server maintains low load and is avaible for general access
- Only user with admin authorization can access processing
- Processing is done in client browser by accessing `/process` URL  
  either manually or via menu in the client viewer
- Processor is separate from client viewer to keep client viewer as light as possible  
  and also to enable processing separate from viewing  
- For details on processing module and processing workflow  
  see notes on `Processing Workflow` and `ML Workflow`

### 2.3. Video Module

- Accessed via menu or via `/video` URL  
- Loads separate module that performs ML operations on live webcam input  
- This is an add-on to main PiGallery application and is not related to its primary function

*TBD*: Details

### 2.4. Compare Module

Accessed via `/compare` URL  

Used mostly for purposes of selecting and tuning ML models by allowing direct result compare between different models

<br><hr><br>

## 3. Processing Workflow

### 3.1. Prepare Worklist

- Client authenticates with server
- Client requests list of file to be processed from server
- Server scans configured file systems and  
  compares each image matching search pattern with database records  
  Deleted files automaticallty trigger record removal from database  
  Added or modified files are added to processing queue  
- Queue is sent back to client  

### 3.2. Prepare Models

Upon receving non-empty processing queue from server client performs following operations:

- Read client-specific configuration  
  from `client/shared/config.js`
- Initialize TensorFlow/JS with WebGL backend  
  Initialization also allows for custom GL flags
- Requests current model configuration from server  
  Configuration is present on server in `model.json`  
  Models can be hosted on the server itself or anywhere with publically accessible location
- Loads all configured and enabled models from server
- Performs warmup procedure

### 3.3. Process Image

Client loops over each image in processing queue:

- Download image from server
- Resize image as needed
- Performs ML classification/detection
- Calculates image perception hash
- Prepares image thumbnail
- Merges all results  
  Binary data such as thumbnail is stored as base64 encoded string
- Sends record to server in JSON format

Server accepts new record

- Reads file header to analyze EXIF data
- Performs *meta* analysis based on multi-parameter rules  
  For example, based on ISO/exposure/apperture, it adds additional tags such as ligh/dark, indoor/outdoor, etc.
- Performs GeoLocation based on loaded database and information from EXIF
- Performs WordNet definition lookups based on detected keywords in the record received from client
- Recombines data received from client and data discovered on server
- Builds tag list from all record entries for future searches
- Stores record in database

Processing maintains record-level integrity, so if its interrupted or fails with error client can reload and get updated processing queue from server

## 4. ML Workflow

*TBD*: classifer, detector, batching, merges
