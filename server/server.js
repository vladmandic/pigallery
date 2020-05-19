const fs = require('fs');
const path = require('path');
const log = require('pilogger');
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
    maxAge: 1000 * 60 * 60 * 24 * 30, // 1 month
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
  app.use(session(cookie));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  log.info('CORS Enabled');
  app.use(allowCORS);
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

  // app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '../favicon.ico')));
  // app.get('/', (req, res) => res.sendFile('client/gallery.html', { root }));
  api.init(app); // initialize api calls
  app.use('/', express.static(path.join(root, '.')));
  app.get('/gallery', (req, res) => res.sendFile('client/gallery.html', { root }));
  app.get('/process', (req, res) => res.sendFile('client/process.html', { root }));
  app.get('/video', (req, res) => res.sendFile('client/video.html', { root }));
  app.use('/assets', express.static(path.join(root, './assets'), { maxAge: '365d', cacheControl: true }));
  app.use('/models', express.static(path.join(root, './models'), { maxAge: '365d', cacheControl: true }));
  // app.use('/media', express.static(path.join(root, './media'), { maxAge: '365d', cacheControl: true }));

  await parcel.init(app); // initialize parceljs bundler

  // const server = app.listen(80);
  // server.on('error', (err) => log.warn('Express', err));
  // server.on('listening', () => log.state('Express listening'));
  // server.on('close', () => log.state('Express close'));
  const httpOptions = {
    maxHeaderSize: 65536,
    key: fs.readFileSync(global.server.SSLKey, 'utf8'),
    cert: fs.readFileSync(global.server.SSLCrt, 'utf8'),
    requestCert: false,
    rejectUnauthorized: false,
  };
  const server = https.createServer(httpOptions, app);
  server.on('error', (err) => log.error(err.message));
  server.on('listening', () => log.state(`Server HTTPS listening on ${server.address().family} ${server.address().address}:${server.address().port}`));
  server.on('close', () => log.state('Server HTTPS closed'));
  server.listen(global.server.httpPort);

  if (fs.existsSync(path.join(__dirname, global.cache))) {
    const data = fs.readFileSync(path.join(__dirname, global.cache), 'utf8');
    global.results = JSON.parse(data);
    log.info('Image cache loaded:', path.join(__dirname, global.cache), 'records:', global.results.length, 'size:', data.length, 'bytes');
  } else {
    log.info('Image cache not found:', path.join(__dirname, global.cache));
  }
}

main();
