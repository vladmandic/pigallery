const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const log = require('@vladmandic/pilogger');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const api = require('./api');
const build = require('./build');
const watcher = require('./watcher');
const changelog = require('./changelog');
const database = require('./database');

let config;

function allowPWA(req, res, next) {
  if (req.url.endsWith('.js')) res.header('Service-Worker-Allowed', '/');
  next();
}

function forceSSL(req, res, next) {
  if (!req.secure) {
    log.data(`Redirecting unsecure user:${req.session.user} src:${req.client.remoteFamily}/${req.ip} dst:${req.protocol}://${req.headers.host}${req.baseUrl || ''}${req.url || ''}`);
    return res.redirect(`https://${req.hostname}:${config.server.HTTPSport}${req.baseUrl}${req.url}`);
  }
  return next();
}

async function main() {
  process.on('uncaughtException', (err) => log.error('Exception', err));
  process.on('unhandledRejection', (err) => log.error('Rejection', err));
  try {
    config = JSON.parse(fs.readFileSync('./config.json').toString());
  } catch (err) {
    log.error('Configuration file config.json cannot be read');
    process.exit(0);
  }
  log.configure({ logFile: config?.server?.logFile || 'pigallery.log' });
  log.header();
  log.info('Authentication required:', config?.server?.authForce || 'undefined');
  log.info('Media root:', config?.server?.mediaRoot || 'undefined');
  log.info('Allowed image file types:', config?.server?.allowedImageFileTypes || 'undefined');
  const root = path.join(__dirname, '../');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // update changelog
  await changelog.update('../CHANGELOG.md');

  if (!config) {
    log.error('Configuration missing, exiting...');
    process.exit(0);
  }

  // initialize esbuild bundler
  await build.compile();

  // initialize file watcher
  await watcher.watch(config);

  // load expressjs middleware
  // @ts-ignore not typescript compatible
  config.cookie.store = new FileStore({ path: config.cookie.path, retries: 1, logFn: log.warn, ttl: 24 * 3600, reapSyncFallback: true });
  app.use(express.json({ limit: 10485760 }));
  app.use(express.urlencoded({ extended: true, parameterLimit: 10485760, limit: 10485760 }));
  // @ts-ignore not typescript compatible
  app.use(session(config.cookie));
  if (config.server.allowPWA) app.use(allowPWA);
  if (config.server.forceHTTPS) app.use(forceSSL);

  // expressjs passthrough for all requests
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode !== 200 && res.statusCode !== 302 && res.statusCode !== 304 && !req.url.endsWith('.map') && (req.url !== '/true')) {
        const forwarded = (req.headers.forwarded || '').match(/for="\[(.*)\]:/);
        const ip = (Array.isArray(forwarded) ? forwarded[1] : null) || req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
        // @ts-ignore session does not register request property
        log.warn(`${req.method}/${req.httpVersion} code:${res.statusCode} user:${req.session.user} src:${req.client.remoteFamily}/${ip} dst:${req.protocol}://${req.headers.host}${req.baseUrl || ''}${req.url || ''}`, req.sesion);
      }
    });

    if (req.url === '/') res.set('cache-control', 'public, max-age=180');
    else if (req.url.startsWith('/api/')) res.set('cache-control', 'no-cache');
    else res.set('cache-control', 'public, max-age=31557600, immutable');

    if (req.url.startsWith('/api/user/auth')) next();
    else if (!req.url.startsWith('/api/')) next();
    // @ts-ignore session does not register request property
    else if (req.session['user'] || !config.server.authForce) next();
    else res.status(401).sendFile('client/auth.html', { root });
  });

  // expressjs generic request error handler
  app.use(async (err, req, res, next) => { // callback with error signature for middleware
    const forwarded = (req.headers.forwarded || '').match(/for="\[(.*)\]:/);
    const ip = (Array.isArray(forwarded) ? forwarded[1] : null) || req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
    // @ts-ignore session does not register request property
    log.warn(`${req.method}/${req.httpVersion} code:${res.statusCode} user:${req.session.user} src:${req.client.remoteFamily}/${ip} dst:${req.protocol}://${req.headers.host}${req.baseUrl || ''}${req.url || ''}`, req.sesion);
    next();
  });

  // define routes for static html files
  const html = fs.readdirSync('./client/');
  for (const f of html) {
    if (f.endsWith('.html')) {
      const mount = f.substr(0, f.indexOf('.html'));
      const name = path.join('./client', f);
      log.state(`Mounted: ${mount} from (${name}`);
      app.get(`/${mount}`, (req, res) => res.sendFile(name, { root }));
    }
  }
  // define routes for static files
  for (const f of ['/favicon.ico', '/pigallery.webmanifest', '/asset-manifest.json', '/README.md', '/CHANGELOG.md', '/LICENSE']) {
    app.get(f, (req, res) => res.sendFile(`.${f}`, { root }));
  }
  // define route for root
  app.get('/', (req, res) => res.sendFile('index.html', { root: './client' }));
  app.get('/true', (req, res) => res.status(200).send(true)); // used for is-alive checks
  // define routes for folders
  const optionsStatic = { maxAge: '365d', cacheControl: true, etag: true, lastModified: true };
  app.use('/assets', express.static(path.join(root, './assets'), optionsStatic));
  app.use('/models', express.static('/home/vlado/models', optionsStatic));
  app.use('/media', express.static(path.join(root, './media'), optionsStatic));
  app.use('/client', express.static(path.join(root, './client'), optionsStatic));
  app.use('/dist', express.static(path.join(root, './dist'), optionsStatic));
  app.use('/docs', express.static(path.join(root, './docs'), optionsStatic));
  app.use('/@vladmandic', express.static(path.join(root, './node_modules/@vladmandic'), optionsStatic));

  // start http server
  if (config.server.httpPort && config.server.httpPort !== 0) {
    const httpOptions = {
      maxHeaderSize: 65536,
    };
    const serverhttp = http.createServer(httpOptions, app);
    serverhttp.on('error', (err) => log.error(err.message));
    serverhttp.on('listening', () => log.state('Server HTTP listening:', serverhttp.address()));
    serverhttp.on('close', () => log.state('Server http closed'));
    serverhttp.listen(config.server.httpPort);
  }

  // start https server
  if (config.server.httpsPort && (config.server.httpsPort !== 0) && fs.existsSync(config.server.SSLKey) && fs.existsSync(config.server.SSLCrt)) {
    const httpsOptions = {
      maxHeaderSize: 65536,
      key: fs.readFileSync(config.server.SSLKey, 'utf8'),
      cert: fs.readFileSync(config.server.SSLCrt, 'utf8'),
      requestCert: false,
      rejectUnauthorized: false,
    };
    const serverHttps = https.createServer(httpsOptions, app);
    serverHttps.on('error', (err) => log.error(err.message));
    serverHttps.on('listening', () => log.state('Server HTTPS listening:', serverHttps.address()));
    serverHttps.on('close', () => log.state('Server HTTPS closed'));
    serverHttps.listen(config.server.httpsPort);
  }

  // load database
  log.info('Database engine:', config.server.db);
  const db = await database.init(config);
  if (!db) {
    log.error('Error loading database');
    process.exit(1);
  }

  // initialize api calls
  api.init(app, config, db);
}

main();
