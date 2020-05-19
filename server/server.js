const fs = require('fs');
const path = require('path');
const log = require('pilogger');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const api = require('./api.js');
const parcel = require('./distBundler.js');
const nodeconfig = require('../package.json');

global.results = [];
global.cache = '../cache.json';
global.users = [
  { email: 'mandic00@live.com', passwd: 'qwe' },
];
global.server = {
  httpPort: 8000,
  httpsPort: 8080,
  SSLKey: '/home/vlado/dev/pidash/cert/private.pem',
  SSLCrt: '/home/vlado/dev/pidash/cert/fullchain.pem',
};

const cookie = {
  secret: 'whaTEvEr!42',
  proxy: false,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  cookie: {
    httpOnly: false,
    sameSite: true,
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
  },
};

function allowCORS(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') res.send(200);
  else next();
}

async function main() {
  log.info(nodeconfig.name, 'version', nodeconfig.version);
  log.info('Platform:', process.platform, 'Arch:', process.arch, 'Node:', process.version);

  const root = path.join(__dirname, '../');
  const app = express();
  app.disable('x-powered-by');

  // load expressjs middleware
  app.use(session(cookie));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(allowCORS);

  // expressjs passthrough for all requests
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode !== 200 && res.statusCode !== 202 && res.statusCode !== 304 && !req.url.endsWith('.map')) {
        log.data(`${req.method}/${req.httpVersion} code:${res.statusCode} user:${req.session.user} src:${req.client.remoteFamily}/${req.ip} dst:${req.protocol}://${req.headers.host}${req.baseUrl || ''}${req.url || ''}`);
      }
    });
    if (req.url.startsWith('/assets') || req.url.startsWith('/client') || req.url.startsWith('/favicon.ico')) next();
    else if (req.session.user) next();
    else res.status(401).sendFile('client/auth.html', { root });
  });

  api.init(app); // initialize api calls
  // define routes
  app.use('/', express.static(path.join(root, '.')));
  app.get('/gallery', (req, res) => res.sendFile('client/gallery.html', { root }));
  app.get('/process', (req, res) => res.sendFile('client/process.html', { root }));
  app.get('/video', (req, res) => res.sendFile('client/video.html', { root }));
  app.use('/assets', express.static(path.join(root, './assets'), { maxAge: '365d', cacheControl: true }));
  app.use('/models', express.static(path.join(root, './models'), { maxAge: '365d', cacheControl: true }));
  // app.use('/media', express.static(path.join(root, './media'), { maxAge: '365d', cacheControl: true }));

  // initialize parceljs bundler
  await parcel.init(app);

  // start http server
  if (global.server.httpPort && global.server.httpPort !== 0) {
    const httpOptions = {
      maxHeaderSize: 65536,
    };
    const serverhttp = http.createServer(httpOptions, app);
    serverhttp.on('error', (err) => log.error(err.message));
    serverhttp.on('listening', () => log.state(`Server HTTP listening on ${serverhttp.address().family} ${serverhttp.address().address}:${serverhttp.address().port}`));
    serverhttp.on('close', () => log.state('Server http closed'));
    serverhttp.listen(global.server.httpPort);
  }

  // start https server
  if (global.server.httpsPort && global.server.httpsPort !== 0) {
    const httpsOptions = {
      maxHeaderSize: 65536,
      key: fs.readFileSync(global.server.SSLKey, 'utf8'),
      cert: fs.readFileSync(global.server.SSLCrt, 'utf8'),
      requestCert: false,
      rejectUnauthorized: false,
    };
    const serverHttps = https.createServer(httpsOptions, app);
    serverHttps.on('error', (err) => log.error(err.message));
    serverHttps.on('listening', () => log.state(`Server HTTPS listening on ${serverHttps.address().family} ${serverHttps.address().address}:${serverHttps.address().port}`));
    serverHttps.on('close', () => log.state('Server HTTPS closed'));
    serverHttps.listen(global.server.httpsPort);
  }

  // load image cache
  if (fs.existsSync(path.join(__dirname, global.cache))) {
    const data = fs.readFileSync(path.join(__dirname, global.cache), 'utf8');
    global.results = JSON.parse(data);
    log.state('Image cache loaded:', path.join(__dirname, global.cache), 'records:', global.results.length, 'size:', data.length, 'bytes');
  } else {
    log.warn('Image cache not found:', path.join(__dirname, global.cache));
  }
}

main();
