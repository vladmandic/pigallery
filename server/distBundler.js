const path = require('path');
const log = require('pilogger');
const Parcel = require('parcel-bundler');

const entryFiles = path.join(__dirname, '../client/gallery.js');
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

function parcel(app) {
  const bundler = new Parcel(entryFiles, options);
  bundler.on('buildStart', (f) => log.state('Parcel start', f));
  bundler.on('buildEnd', () => {
    log.state('Parcel ready');
    // log.data(bundler.mainBundle.assets);
  });
  bundler.on('buildError', (err) => log.state('Parcel error', err));
  app.use('/client', bundler.middleware()); // use for bundle as express middle-ware
}

exports.init = parcel;
