const path = require('path');
const log = require('pilogger');
const express = require('express');
const api = require('./api.js');
const parcel = require('./bundler.js');
const nodeconfig = require('../package.json');

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

  api.init(app); // initialize api calls
  parcel.init(app); // initialize parceljs bundler

  const server = app.listen(80);
  server.on('error', (err) => log.warn('Express', err));
  server.on('listening', () => log.state('Express listening'));
  server.on('close', () => log.state('Express close'));
}

main();
