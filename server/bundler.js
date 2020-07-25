/*
const log = require('pilogger');
const Parcel = require('parcel-bundler');

const entryFiles = ['client/gallery.js', 'client/video.js', 'client/process.js', 'client/compare.js', 'client/worker.js'];
const options = {
  outDir: './dist',
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

// eslint-disable-next-line no-unused-vars
async function parcel(app) {
  const bundler = new Parcel(entryFiles, options);
  // bundler.on('buildStart', (f) => log.state('Build start', f));
  bundler.on('buildEnd', () => log.state('Client application rebuild ready'));
  bundler.on('buildError', (err) => log.state('Client application build error', err));
  // app.use('/client', bundler.middleware()); // use for bundle as express middle-ware
  await bundler.bundle();
}

exports.init = parcel;
*/
