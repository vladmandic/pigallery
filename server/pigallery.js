const fs = require('fs');
const path = require('path');
const log = require('@vladmandic/pilogger');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const nedb = require('nedb-promises');
const api = require('./api.js');
const build = require('./build.js');
const watcher = require('./watcher.js');
const changelog = require('./changelog.js');

global.json = [];
global.config = JSON.parse(fs.readFileSync('./config.json'));

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
  log.configure({ logFile: global.config.server.logFile });
  log.header();
  log.info('Authentication required:', global.config.server.authForce);
  log.info('Media root:', global.config.server.mediaRoot);
  log.info('Allowed image file types:', global.config.server.allowedImageFileTypes);
  const root = path.join(__dirname, '../');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // update changelog
  changelog.update('CHANGELOG.md');

  // initialize esbuild bundler
  await build.init();
  await build.compile();

  // initialize file watcher
  await watcher.watch();

  // load expressjs middleware
  global.config.cookie.store = new FileStore({ path: global.config.cookie.path, retries: 1, logFn: log.warn, ttl: 24 * 3600, reapSyncFallback: true });
  app.use(session(global.config.cookie));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 10000 }));
  if (global.config.server.allowPWA) app.use(allowPWA);
  if (global.config.server.forceHTTPS) app.use(forceSSL);

  // expressjs passthrough for all requests
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode !== 200 && res.statusCode !== 302 && res.statusCode !== 304 && !req.url.endsWith('.map') && (req.url !== '/true')) {
        const ip = (req.headers['forwarded'] || '').match(/for="\[(.*)\]:/)[1] || req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
        log.data(`${req.method}/${req.httpVersion} code:${res.statusCode} user:${req.session.user} src:${req.client.remoteFamily}/${ip} dst:${req.protocol}://${req.headers.host}${req.baseUrl || ''}${req.url || ''}`, req.sesion);
      }
    });
    if (req.url.startsWith('/api/auth')) next();
    else if (!req.url.startsWith('/api/')) next();
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
  for (const f of ['/favicon.ico', '/manifest.json', '/asset-manifest.json', '/README.md', '/CHANGELOG.md', '/LICENSE']) {
    app.get(f, (req, res) => res.sendFile(`.${f}`, { root }));
  }
  // define route for root
  app.get('/', (req, res) => res.sendFile('gallery.html', { root: './client' }));
  app.get('/true', (req, res) => res.status(200).send(true));
  // define routes for folders
  const optionsStatic = { maxAge: '365d', cacheControl: true, etag: true, lastModified: true };
  app.use('/assets', express.static(path.join(root, './assets'), optionsStatic));
  app.use('/models', express.static(path.join(root, './models'), optionsStatic));
  app.use('/media', express.static(path.join(root, './media'), optionsStatic));
  app.use('/client', express.static(path.join(root, './client'), optionsStatic));
  app.use('/dist', express.static(path.join(root, './dist'), optionsStatic));

  // start http server
  if (global.config.server.httpPort && global.config.server.httpPort !== 0) {
    const httpOptions = {
      maxHeaderSize: 65536,
    };
    const serverhttp = http.createServer(httpOptions, app);
    serverhttp.on('error', (err) => log.error(err.message));
    serverhttp.on('listening', () => log.state('Server HTTP listening:', serverhttp.address()));
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
    serverHttps.on('listening', () => log.state('Server HTTPS listening:', serverHttps.address()));
    serverHttps.on('close', () => log.state('Server HTTPS closed'));
    serverHttps.listen(global.config.server.httpsPort);
  }

  // start http2 server
  if (global.config.server.http2Port && global.config.server.http2Port !== 0) {
    const http2Options = {
      allowHTTP1: true,
      maxHeaderSize: 65536,
      key: fs.readFileSync(global.config.server.SSLKey, 'utf8'),
      cert: fs.readFileSync(global.config.server.SSLCrt, 'utf8'),
      requestCert: false,
      rejectUnauthorized: false,
    };
    const serverHttp2 = http2.createServer(http2Options, app);
    serverHttp2.on('error', (err) => log.error(err.message));
    serverHttp2.on('listening', () => log.state('Server HTTP2 listening:', serverHttp2.address()));
    serverHttp2.on('close', () => log.state('Server HTTPS closed'));
    serverHttp2.listen(global.config.server.http2Port);
  }

  // initialize api calls
  api.init(app);

  // load image cache
  if (!fs.existsSync(global.config.server.db)) log.warn('Image cache not found:', global.config.server.db);
  global.db = nedb.create({ filename: global.config.server.db, inMemoryOnly: false, timestampData: true, autoload: false });
  await global.db.ensureIndex({ fieldName: 'image', unique: true, sparse: true });
  await global.db.ensureIndex({ fieldName: 'processed', unique: false, sparse: false });
  await global.db.loadDatabase();
  const records = await global.db.count({});
  log.state('Image DB loaded:', global.config.server.db, 'records:', records);
  const shares = await global.db.find({ images: { $exists: true } });
  for (const share of shares) {
    log.state('Shares:', share.name, 'creator:', share.creator, 'key:', share.share, 'images:', share.images.length);
  }
  // await global.db.remove({ images: { $exists: true } }, { multi: true });
}

main();
