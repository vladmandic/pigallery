// @ts-nocheck

const fs = require('fs');
const chokidar = require('chokidar');
const log = require('@vladmandic/pilogger');
const build = require('./build.js');

const monitor = ['config.json', 'package.json', 'server', 'client', 'assets'];

async function processChange(f, msg) {
  log.data('Monitor: file', msg, f);
  if (f.startsWith('server/')) {
    log.warn('Server file modified: restart required');
  } else if (f.endsWith('.json')) {
    log.info('Reloading configuration');
    try {
      global.config = JSON.parse(fs.readFileSync('./config.json').toString());
      global.config.node = JSON.parse(fs.readFileSync('./package.json').toString());
    } catch (err) {
      log.warn('Configuration file cannot be reloaded');
    }
  } else {
    build.compile();
  }
}

async function watch() {
  const watcher = chokidar.watch(monitor, {
    persistent: true,
    ignorePermissionErrors: false,
    alwaysStat: false,
    ignoreInitial: true,
    followSymlinks: true,
    usePolling: false,
    useFsEvents: false,
    atomic: true,
  });
  watcher
    .on('add', (path) => processChange(path, 'add'))
    .on('change', (path) => processChange(path, 'modify'))
    .on('unlink', (path) => processChange(path, 'remove'))
    .on('error', (error) => log.error(`Client watcher error: ${error}`))
    .on('ready', () => log.state('Monitoring:', monitor));
}

exports.watch = watch;
