const log = require('pilogger');
const express = require('express');
const Parcel = require('parcel-bundler');
const fs = require('fs');
const path = require('path');
const nodeconfig = require('../package.json');

const entryFiles = path.join(__dirname, './gallery.js');
const options = {
  outDir: './dist',
  outFile: 'gallery.js',
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
  scopeHoist: false,
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

  app.use('/assets', express.static(path.join(__dirname, '../assets'), { maxAge: '365d', cacheControl: true }));
  app.use('/models', express.static(path.join(__dirname, '../models'), { maxAge: '365d', cacheControl: true }));
  app.use('/samples', express.static(path.join(__dirname, '../samples'), { maxAge: '365d', cacheControl: true }));
  app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '../favicon.ico')));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'gallery.html')));
  app.get('/list/:prefix', (req, res) => {
    let matched = [];
    try {
      const match = req.params.prefix ? req.params.prefix : '';
      const dir = fs.readdirSync('./samples');
      if (match) matched = dir.filter((a) => a.includes(match));
      log.info(`Requested file listing for:${match} total:${dir.length} matched:${matched.length}`);
    } catch { /**/ }
    res.json({ files: matched, folder: '/samples' });
  });

  const bundler = new Parcel(entryFiles, options);
  bundler.on('buildStart', (f) => log.state('Parcel start', f));
  bundler.on('buildEnd', () => {
    log.state('Parcel ready');
    // log.data(bundler.mainBundle.assets);
  });
  bundler.on('buildError', (err) => log.state('Parcel error', err));
  app.use('/', bundler.middleware()); // use for bundle as express middle-ware

  const server = app.listen(80);
  server.on('error', (err) => log.warn('Express', err));
  server.on('listening', () => log.state('Express listening'));
  server.on('close', () => log.state('Express close'));
}

main();
