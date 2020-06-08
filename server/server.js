const fs = require('fs');
const path = require('path');
const log = require('pilogger');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const nedb = require('nedb-promises');
const api = require('./api.js');
const parcel = require('./distBundler.js');
const nodeconfig = require('../package.json');
const config = require('../config.json');

global.json = [];

function allowCORS(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') res.send(200);
  else next();
}

function allowPWA(req, res, next) {
  if (req.url.endsWith('.js')) res.header('Service-Worker-Allowed', '/');
  next();
}

function forceSSL(req, res, next) {
  if (!req.secure) {
    log.data(`Redirecting unsecure user:${req.session.user} src:${req.client.remoteFamily}/${req.ip} dst:${req.protocol}://${req.headers.host}${req.baseUrl || ''}${req.url || ''}`);
    return res.redirect(`https://${req.hostname}:${global.config.server.HTTPSport}${req.baseUrl}${req.url}`);
  }
  return next();
}

async function main() {
  log.logFile(config.server.logFile);
  log.info(nodeconfig.name, 'version', nodeconfig.version);
  log.info('Platform:', process.platform, 'Arch:', process.arch, 'Node:', process.version);
  log.info('Authentication required:', config.server.authForce);
  log.info('Media root:', config.server.mediaRoot);
  log.info('Allowed image file types:', config.server.allowedImageFileTypes);
  const root = path.join(__dirname, '../');
  const app = express();
  app.disable('x-powered-by');

  // load expressjs middleware
  app.use(session(config.cookie));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(compression());
  if (config.server.allowCORS) app.use(allowCORS);
  if (config.server.allowPWA) app.use(allowPWA);
  if (config.server.forceHTTPS) app.use(forceSSL);

  // expressjs passthrough for all requests
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode !== 200 && res.statusCode !== 202 && res.statusCode !== 304 && !req.url.endsWith('.map')) {
        log.data(`${req.method}/${req.httpVersion} code:${res.statusCode} user:${req.session.user} src:${req.client.remoteFamily}/${req.ip} dst:${req.protocol}://${req.headers.host}${req.baseUrl || ''}${req.url || ''}`);
      }
    });
    if (!req.url.startsWith('/api/')) next();
    else if (req.session.user || !config.server.authForce) next();
    else res.status(401).sendFile('client/auth.html', { root });
  });

  api.init(app); // initialize api calls

  // define routes
  app.use('/', express.static(path.join(root, '.')));
  app.get('/', (req, res) => res.redirect('/gallery'));
  app.get('/gallery', (req, res) => res.sendFile('client/gallery.html', { root }));
  app.get('/process', (req, res) => res.sendFile('client/process.html', { root }));
  app.get('/video', (req, res) => res.sendFile('client/video.html', { root }));
  app.use('/assets', express.static(path.join(root, './assets'), { maxAge: '365d', cacheControl: true }));
  app.use('/models', express.static(path.join(root, './models'), { maxAge: '365d', cacheControl: true }));

  // initialize parceljs bundler
  await parcel.init(app);

  // load image cache
  log.info('Database Engine:', config.server.dbEngine);
  if (config.server.dbEngine === 'json') {
    if (fs.existsSync(config.server.jsonDB)) {
      const data = fs.readFileSync(config.server.jsonDB, 'utf8');
      global.json = JSON.parse(data);
      log.state('Image cache loaded:', config.server.jsonDB, 'records:', global.json.length, 'size:', data.length, 'bytes');
    } else {
      log.warn('Image cache not found:', config.server.jsonDB);
    }
  } else if (config.server.dbEngine === 'nedb') {
    if (!fs.existsSync(config.server.nedbDB)) log.warn('Image cache not found:', config.server.nedbDB);
    global.db = nedb.create({ filename: config.server.nedbDB, inMemoryOnly: false, timestampData: true, autoload: false });
    await global.db.loadDatabase();
    const records = await global.db.count({});
    log.state('Image cache loaded:', config.server.nedbDB, 'records:', records);
  } else {
    log.error('Unknown Database Engine');
    process.exit(1);
  }

  // start http server
  if (config.server.httpPort && config.server.httpPort !== 0) {
    const httpOptions = {
      maxHeaderSize: 65536,
    };
    const serverhttp = http.createServer(httpOptions, app);
    serverhttp.on('error', (err) => log.error(err.message));
    serverhttp.on('listening', () => log.state(`Server HTTP listening on ${serverhttp.address().family} ${serverhttp.address().address}:${serverhttp.address().port}`));
    serverhttp.on('close', () => log.state('Server http closed'));
    serverhttp.listen(config.server.httpPort);
  }

  // start https server
  if (config.server.httpsPort && config.server.httpsPort !== 0) {
    const httpsOptions = {
      maxHeaderSize: 65536,
      key: fs.readFileSync(config.server.SSLKey, 'utf8'),
      cert: fs.readFileSync(config.server.SSLCrt, 'utf8'),
      requestCert: false,
      rejectUnauthorized: false,
    };
    const serverHttps = https.createServer(httpsOptions, app);
    serverHttps.on('error', (err) => log.error(err.message));
    serverHttps.on('listening', () => log.state(`Server HTTPS listening on ${serverHttps.address().family} ${serverHttps.address().address}:${serverHttps.address().port}`));
    serverHttps.on('close', () => log.state('Server HTTPS closed'));
    serverHttps.listen(config.server.httpsPort);
  }
}

main();
