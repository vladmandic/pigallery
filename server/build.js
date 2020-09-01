const fs = require('fs');
const esbuild = require('esbuild');
const CleanCSS = require('clean-css');
const log = require('@vladmandic/pilogger');

const entryPoints = ['client/gallery.js', 'client/compare.js', 'client/worker.js'];
const cssFiles = ['assets/bootstrap.css', 'assets/fontawesome.css', 'assets/iv-viewer.css', 'assets/mapquest.css', 'client/gallery.css'];
let service;
let clean;

async function init() {
  service = await esbuild.startService();
  clean = new CleanCSS({
    level: {
      1: {
        all: true,
        // eslint-disable-next-line consistent-return
        transform: (propertyName, propertyValue) => {
          if (propertyName === 'src' && propertyValue.indexOf('webfonts/') > -1) return propertyValue.replace('webfonts/', '/assets/');
        },
      },
      // 2: {
      //  all: true,
      // },
    },
  });
}

async function compile() {
  if (!service) {
    log.error('ESBuild not initialized');
    return;
  }
  if (!clean) {
    log.error('CleanCSS not initialized');
    return;
  }
  try {
    await service.build({
      entryPoints,
      outdir: './dist',
      minify: true,
      bundle: true,
      sourcemap: true,
      external: ['fs', 'crypto', 'util'],
      logLevel: 'error',
      platform: 'browser',
      target: 'es2018',
      // format: 'cjs',
      format: 'esm',
      metafile: './asset-manifest.json',
    });
    log.state('Client application rebuild ready');
  } catch (err) {
    log.error('Client application build error', err.errors || err);
  }
  try {
    const css = clean.minify(cssFiles);
    fs.writeFileSync('dist/pigallery.css', css.styles);
    log.state('Client CSS rebuild ready', css.stats);
  } catch (err) {
    log.error('Client CSS build error', err.errors || err);
  }
}

exports.init = init;
exports.compile = compile;
