const fs = require('fs');
const path = require('path');
const log = require('pilogger');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const shrinkRay = require('shrink-ray-current');
const nedb = require('nedb-promises');
const api = require('./api.js');
const build = require('./build.js');
const watcher = require('./watcher.js');
const changelog = require('./changelog.js');
// const nodeconfig = require('../package.json');
// const config = require('../global.config.json');

global.json = [];
global.config = JSON.parse(fs.readFileSync('./config.json'));

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
    return res.redirect(`https://${req.hostname}:${global.global.config.server.HTTPSport}${req.baseUrl}${req.url}`);
  }
  return next();
}

async function main() {
  global.config.node = JSON.parse(fs.readFileSync('./package.json'));
  log.logFile(global.config.server.logFile);
  log.info(global.config.node.name, 'version', global.config.node.version);
  log.info('Platform:', process.platform, 'Arch:', process.arch, 'Node:', process.version);
  log.info('Authentication required:', global.config.server.authForce);
  log.info('Media root:', global.config.server.mediaRoot);
  log.info('Allowed image file types:', global.config.server.allowedImageFileTypes);
  const root = path.join(__dirname, '../');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // update changelog
  changelog.update('CHANGELOG.md');

  // initialize parceljs bundler
  // const parcel = require('./bundler.js');
  // await parcel.init(app);

  // initialize esbuild bundler
  await build.init();
  await build.compile();

  // initialize file watcher
  await watcher.watch();

  // load expressjs middleware
  app.use(session(global.config.cookie));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(shrinkRay({ useZopfliForGzip: false, brotli: { quality: 4 } }));
  if (global.config.server.allowCORS) app.use(allowCORS);
  if (global.config.server.allowPWA) app.use(allowPWA);
  if (global.config.server.forceHTTPS) app.use(forceSSL);

  // expressjs passthrough for all requests
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode !== 200 && res.statusCode !== 302 && res.statusCode !== 304 && !req.url.endsWith('.map')) {
        log.data(`${req.method}/${req.httpVersion} code:${res.statusCode} user:${req.session.user} src:${req.client.remoteFamily}/${req.ip} dst:${req.protocol}://${req.headers.host}${req.baseUrl || ''}${req.url || ''}`);
      }
    });
    if (!req.url.startsWith('/api/')) next();
    else if (req.session.user || !global.config.server.authForce) next();
    else res.status(401).sendFile('client/auth.html', { root });
  });

  // define routes for static html files
  const html = fs.readdirSync('./client/');
  for (const f of html) {
    if (f.endsWith('.html')) {
      const mount = f.substr(0, f.indexOf('.html'));
      const name = path.join('./client', f);
      log.state(`Mounted: ${mount} from ${name}`);
      app.get(`/${mount}`, (req, res) => res.sendFile(name, { root }));
    }
  }
  // define routes for static files
  for (const f of ['/favicon.ico', '/manifest.json', '/README.md', '/CHANGELOG.md', '/LICENSE']) {
    app.get(f, (req, res) => res.sendFile(`.${f}`, { root }));
  }
  // define route for root
  app.get('/', (req, res) => res.redirect('/gallery'));
  // define routes for folders
  app.use('/assets', express.static(path.join(root, './assets'), { maxAge: '365d', cacheControl: true }));
  app.use('/models', express.static(path.join(root, './models'), { maxAge: '365d', cacheControl: true }));
  app.use('/media', express.static(path.join(root, './media'), { maxAge: '365d', cacheControl: true }));
  app.use('/client', express.static(path.join(root, './client'), { cacheControl: false }));
  app.use('/dist', express.static(path.join(root, './dist'), { cacheControl: false }));

  // start http server
  if (global.config.server.httpPort && global.config.server.httpPort !== 0) {
    const httpOptions = {
      maxHeaderSize: 65536,
    };
    const serverhttp = http.createServer(httpOptions, app);
    serverhttp.on('error', (err) => log.error(err.message));
    serverhttp.on('listening', () => log.state('Server HTTP listening on', serverhttp.address().family, serverhttp.address().address, serverhttp.address().port));
    serverhttp.on('close', () => log.state('Server http closed'));
    serverhttp.listen(global.config.server.httpPort);
  }

  // start https server
  if (global.config.server.httpsPort && global.config.server.httpsPort !== 0) {
    const httpsOptions = {
      maxHeaderSize: 65536,
      key: fs.readFileSync(global.config.server.SSLKey, 'utf8'),
      cert: fs.readFileSync(global.config.server.SSLCrt, 'utf8'),
      requestCert: false,
      rejectUnauthorized: false,
    };
    const serverHttps = https.createServer(httpsOptions, app);
    serverHttps.on('error', (err) => log.error(err.message));
    serverHttps.on('listening', () => log.state('Server HTTPS listening on', serverHttps.address().family, serverHttps.address().address, serverHttps.address().port));
    serverHttps.on('close', () => log.state('Server HTTPS closed'));
    serverHttps.listen(global.config.server.httpsPort);
  }

  // initialize api calls
  api.init(app);

  // load image cache
  log.state('Database engine ready:', global.config.server.dbEngine);
  if (global.config.server.dbEngine === 'json') {
    if (fs.existsSync(global.config.server.jsonDB)) {
      const data = fs.readFileSync(global.config.server.jsonDB, 'utf8');
      global.json = JSON.parse(data);
      log.state('Image cache loaded:', global.config.server.jsonDB, 'records:', global.json.length, 'size:', data.length, 'bytes');
    } else {
      log.warn('Image cache not found:', global.config.server.jsonDB);
    }
  } else if (global.config.server.dbEngine === 'nedb') {
    if (!fs.existsSync(global.config.server.nedbDB)) log.warn('Image cache not found:', global.config.server.nedbDB);
    global.db = nedb.create({ filename: global.config.server.nedbDB, inMemoryOnly: false, timestampData: true, autoload: false });
    await global.db.ensureIndex({ fieldName: 'image', unique: true });
    await global.db.ensureIndex({ fieldName: 'processed', unique: false });
    await global.db.loadDatabase();
    const records = await global.db.count({});
    log.state('Image cache loaded:', global.config.server.nedbDB, 'records:', records);
  } else {
    log.error('Unknown Database Engine');
    process.exit(1);
  }
}

main();
