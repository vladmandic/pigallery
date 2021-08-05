# PiGallery API

All API is defined as HTTP Rest endpoints on PiGallery server in `server/api.js`

<br>

## Authentication

All PiGallery server access must start with call to:

### POST `/api/user/auth`

for anonymous access to a share, auth request should either `authShare` in the request body
for authenticated access,  
auth request should have `authEmail` and `authPassword` in the request body  

upon succesfull call, server creates a session key that is stored server side for future matching  
and in the client side in a cookie  

any subsequent requests will validate session key in cookie so there is no need to re-authenticate each new client session


### GET `/api/user/get`

returns object containing details on the currently logged in user  

<br>

## Working with Records

### GET `/api/record/get`

gets records from server database

### GET `/api/record/del`

deletes specific record from server database
requires admin level user

### POST `/api/record/put`

creates new record in server database
requires admin level user

<br>

## Working with Shares

### GET `/api/share/del`

deletes specified share from server  
requires admin level user  

### POST `/api/share/put`

creates new share on the server from the currently selected image set
requires admin level user  

<br>

## Other

### GET `/api/log/put`

Sends a log message to the server

### GET `/api/models/get`

Gets current `models.json` definition from the server

### GET `/api/file/all`

Enumerates all files on the server for client-side processing  

### GET `/api/file/dir`

Enumerates a content of a specific folder  
Requires that user has sufficient access to the folder  
