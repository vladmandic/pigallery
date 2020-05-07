const log = require('pilogger');
const express = require('express');
const Parcel = require('parcel-bundler');
const fs = require('fs');
const path = require('path');
const nodeconfig = require('./package.json');

const entryFiles = path.join(__dirname, './gallery.html');
const options = {
  outDir: './dist',
  outFile: 'gallery.html',
  publicUrl: '/',
  watch: true,
  cache: false,
  contentHash: false,
  minify: false,
  target: 'browser',
  bundleNodeModules: true,
  logLevel: 1,
  sourceMaps: true,
  detailedReport: false,
  autoInstall: false,
  // cacheDir: '.cache',
  // global: 'moduleName', // Expose modules as UMD under this name, disabled by default
  // scopeHoist: false, // Turn on experimental scope hoisting/tree shaking flag, for smaller production bundles
  hmr: false,
  hmrPort: 0,
  hmrHostname: '',
};

function allowCORS(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') res.send(200);
  else next();
}

async function main() {
  log.info(`${nodeconfig.name} server v${nodeconfig.version}`);
  log.info(`Platform: ${process.platform} Arch: ${process.arch} Node: ${process.version}`);

  const app = express();
  app.disable('x-powered-by');
  app.use(allowCORS);
  app.use((req, res, next) => {
    res.on('finish', () => log.data(`${req.method}/${req.httpVersion} code:${res.statusCode} src:${req.client.remoteFamily}/${req.ip} dst:${req.protocol}://${req.headers.host}/${req.baseUrl || ''}${req.url || ''}`));
    next();
  });

  app.use('/assets', express.static(path.join(__dirname, './assets'), { maxAge: '365d', cacheControl: true }));
  app.use('/models', express.static(path.join(__dirname, './models'), { maxAge: '365d', cacheControl: true }));
  app.use('/samples', express.static(path.join(__dirname, './samples'), { maxAge: '365d', cacheControl: true }));
  app.get('/list/:prefix', (req, res) => {
    log.info('Requested file listing for', req.params.prefix);
    let dir = [];
    try {
      dir = fs.readdirSync('./samples');
      if (req.params.prefix) dir = dir.filter((a) => a.includes(req.params.prefix));
    } catch { /**/ }
    res.json({ files: dir, folder: '/samples' });
  });

  const bundler = new Parcel(entryFiles, options);
  bundler.on('buildStart', (f) => log.state('Parcel start', f));
  bundler.on('buildEnd', () => log.state('Parcel ready'));
  bundler.on('buildError', (err) => log.state('Parcel error', err));
  app.use('/', bundler.middleware()); // use for bundle as express middle-ware

  const server = app.listen(80);
  server.on('error', (err) => log.warn('Express', err));
  server.on('listening', () => log.state('Express listening'));
  server.on('close', () => log.state('Express close'));
}

main();
