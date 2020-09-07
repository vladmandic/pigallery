const fs = require('fs');
const process = require('process');
const esbuild = require('esbuild');
const CleanCSS = require('clean-css');
const log = require('@vladmandic/pilogger');

const entryPoints = ['client/gallery.js', 'client/compare.js', 'client/worker.js'];
const cssFiles = ['assets/bootstrap.css', 'assets/fontawesome.css', 'assets/iv-viewer.css', 'assets/mapquest.css', 'client/gallery.css'];
let service;
let clean;
const metafile = './asset-manifest.json';

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
      2: {
        all: false,
      },
    },
  });
}

async function buildStats() {
  const stats = { modules: 0, moduleBytes: 0, imports: 0, importBytes: 0, outputs: 0, outputBytes: 0, outputFiles: [] };
  if (!fs.existsSync(metafile)) return stats;
  const data = fs.readFileSync(metafile);
  const json = JSON.parse(data);
  if (json && json.inputs && json.outputs) {
    for (const [key, val] of Object.entries(json.inputs)) {
      if (key.startsWith('node_modules')) {
        stats.modules += 1;
        stats.moduleBytes += val.bytes;
      } else {
        stats.imports += 1;
        stats.importBytes += val.bytes;
      }
    }
    for (const [key, val] of Object.entries(json.outputs)) {
      if (!key.endsWith('.map')) {
        stats.outputs += 1;
        stats.outputFiles.push(key);
        stats.outputBytes += val.bytes;
      }
    }
  }
  return stats;
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
    const t0 = process.hrtime.bigint();
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
      metafile,
    });
    const t1 = process.hrtime.bigint();
    const s = await buildStats();
    log.state('Client application rebuild:', Math.trunc(parseInt(t1 - t0) / 1000 / 1000), 'ms', s.imports, 'imports in', s.importBytes, 'bytes', s.modules, 'modules in', s.moduleBytes, 'bytes', s.outputs, 'outputs in', s.outputBytes, 'bytes');
  } catch (err) {
    log.error('Client application build error', err.errors || err);
  }
  try {
    const data = [];
    for (let i = 0; i < cssFiles.length; i++) {
      if (fs.existsSync(cssFiles[i])) {
        const styles = fs.readFileSync(cssFiles[i], 'utf-8');
        const obj = {};
        obj[cssFiles[i]] = { styles };
        data.push(obj);
      }
    }
    const css = clean.minify(data);
    fs.writeFileSync('dist/pigallery.css', css.styles);
    log.state('Client CSS rebuild:', css.stats.timeSpent, 'ms imports', css.stats.originalSize, 'byes outputs', css.stats.minifiedSize, 'bytes');
  } catch (err) {
    log.error('Client CSS build error', err.errors || err);
  }
}

exports.init = init;
exports.compile = compile;

if (!module.parent) {
  //
}
