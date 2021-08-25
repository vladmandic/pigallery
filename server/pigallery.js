const fs = require('fs');
const log = require('@vladmandic/pilogger');
const api = require('./api');
const webserver = require('./webserver');
const build = require('./build');
const watcher = require('./watcher');
const changelog = require('./changelog');
const database = require('./database');

let config;

async function main() {
  process.on('uncaughtException', (err) => log.error('Exception', err));
  process.on('unhandledRejection', (err) => log.error('Rejection', err));

  // init logging and configuration
  try {
    config = JSON.parse(fs.readFileSync('./config.json').toString());
  } catch (err) {
    log.error('Configuration file config.json cannot be read');
    process.exit(0);
  }
  log.configure({ logFile: config?.server?.logFile || 'pigallery.log' });
  log.header();
  if (!config) {
    log.error('Configuration missing, exiting...');
    process.exit(0);
  }
  log.info('Authentication required:', config?.server?.authForce || 'undefined');
  log.info('Media root:', config?.server?.mediaRoot || 'undefined');
  log.info('Allowed image file types:', config?.server?.allowedImageFileTypes || 'undefined');

  // update changelog
  await changelog.update('../CHANGELOG.md');

  // initialize esbuild bundler
  await build.compile();

  // initialize file watcher
  await watcher.watch(config);

  // load database
  log.info('Database engine:', config.server.db);
  const db = await database.init(config);
  if (!db) {
    log.error('Error loading database');
    process.exit(1);
  }

  // start http server and initialize api calls
  const app = await webserver.init(config);
  api.init(app, config, db);
}

main();
