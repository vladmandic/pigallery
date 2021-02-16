Default server configuration is created during setup step and written to `config.json`

```json
  {
    // list of users and their home folders (which is relative to global server.mediaRoot property)
    // if server.authForce is set to true, at least one valid user should be configured
    // admin property controlls if user has rights to process images
    // or just view them as well as to manage anonymous shares
    // users mediaRoot property must either match server mediaRoot or point to a subfolder of it
    "users": [
      { "email": "demo@example.com", "passwd": "demo", "admin": true, "mediaRoot": "media/" },
    ],
    // predefined user used for anonymous sharing, only works with generated share links
    "share": {
      "email": "share@pigallery.ddns.net", "passwd": "d1ff1cuTpa33w0RD", "admin": false, "mediaRoot": "share/"
    },
    // list of locations to scan for images to be processed
    // match is used as substring match, so do not use explict wildcards
    "locations": [
      { "folder": "samples/", "match": ".jp", "recursive": true }
    ],
    "server": {
      "logFile": "pigallery.log",                     // application log files
      "authForce": true,                              // force user authentication or allow anounymous users
      "httpPort": 10000,                              // http server port, to disable set port to 0
      "httpsPort": 10011,                             // https server port, to disable set port to 0
      "SSLKey": "server/https.key",                   // https server key
      "SSLCrt": "server/https.crt",                   // https server certificate
      "forceHTTPS": false,                            // redirect unsecure http requests to https
      "allowPWA": true,                               // allow application installation as PWA or limit to browser-only
      "db": "pigallery.db",                           // application image database
      "descriptionsDB": "assets/wordnet-synset.json", // application lexicon database, used during image processing
      "citiesDB": "assets/cities.json",               // application geo-location database, used during image processing
      "warmupImage": "assets/warmup.jpg",             // test image used to warm-up models
                                                      // at the start of image processing
      "mediaRoot": "media/", // root folder which serves as starting point for image search for all image processing
                             // user's 'mediaRoot' property must either match this folder or point to a subfolder
                             // to limit users access
      "allowedImageFileTypes": [ ".jpeg", ".jpg" ],   // list of image file exensions that application
                                                      // will enumerate for processing during search
      "defaultLimit": 500, // number of images that server will send to browser in initial requests,
                           // remaining images are loaded in the background
    },
    // how to handle sessions from authenticated users, probably no need to modify
    "cookie": {
      "path": "./sessions",
      "secret": "whaTEvEr!42", "proxy": false, "resave": false, "rolling": true, "saveUninitialized": false,
      "cookie": { "httpOnly": false, "sameSite": true, "secure": false, "maxAge": 6048000001000 }
    }
  }
```
