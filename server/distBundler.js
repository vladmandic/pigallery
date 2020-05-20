const log = require('pilogger');
const Parcel = require('parcel-bundler');

const entryFiles = ['client/gallery.js', 'client/video.js', 'client/process.js'];
const options = {
  outDir: './dist',
  // outFile: ['gallery.js', 'video.js'],
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
  // bundler.on('buildStart', (f) => log.state('Build start', f));
  bundler.on('buildEnd', () => log.state('Application ready'));
  bundler.on('buildError', (err) => log.state('Build error', err));
  app.use('/client', bundler.middleware()); // use for bundle as express middle-ware
}

exports.init = parcel;
