const fs = require('fs');
const chokidar = require('chokidar');
const log = require('@vladmandic/pilogger');
const build = require('./build.js');

const monitor = ['config.json', 'package.json', 'server/*.js', 'client/*.js'];

async function processChange(f, msg) {
  log.data('Monitor: file', msg, f);
  if (f.startsWith('server/')) {
    log.warn('Server file modified: restart required');
  }
  if (f.startsWith('client/')) {
    build.compile();
  }
  if (f.endsWith('.json')) {
    log.info('Reloading configuration');
    global.config = JSON.parse(fs.readFileSync('./config.json'));
    global.config.node = JSON.parse(fs.readFileSync('./package.json'));
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
