const fs = require('fs');
const process = require('process');
const esbuild = require('esbuild');
const CleanCSS = require('clean-css');
const log = require('@vladmandic/pilogger');

const root = 'client';
const jsFiles = ['client/index/worker.js', 'client/index/pwa-serviceworker.js'];
const cssFiles = ['assets/bootstrap.css', 'assets/fontawesome.css', 'client/index/iv-viewer.css', 'assets/mapquest.css', 'client/pigallery.css'];
let clean;
const metafile = './asset-manifest.json';

const banner = { js: `
  /*
  PiGallery
  homepage: <https://github.com/vladmandic/pigallery>
  author: <https://github.com/vladmandic>'
  */
` };

async function init() {
  clean = new CleanCSS({
    level: {
      1: { all: true },
      2: { all: true },
    },
  });
}

async function buildStats(meta) {
  const stats = { modules: 0, moduleBytes: 0, imports: 0, importBytes: 0, outputs: 0, outputBytes: 0, outputFiles: [] };
  try {
    fs.writeFileSync(metafile, JSON.stringify(meta, null, 2));
  } catch (err) {
    log.error('Failed to write metafile:', metafile, err);
  }
  if (!fs.existsSync(metafile)) return stats;
  const data = fs.readFileSync(metafile);
  const json = JSON.parse(data.toString());
  if (json && json.metafile?.inputs && json.metafile?.outputs) {
    for (const [key, val] of Object.entries(json.metafile.inputs)) {
      if (key.startsWith('node_modules')) {
        stats.modules += 1;
        stats.moduleBytes += val.bytes;
      } else {
        stats.imports += 1;
        stats.importBytes += val.bytes;
      }
    }
    for (const [key, val] of Object.entries(json.metafile.outputs)) {
      if (!key.endsWith('.map')) {
        stats.outputs += 1;
        // @ts-ignore
        stats.outputFiles.push(key);
        stats.outputBytes += val.bytes;
      }
    }
  }
  return stats;
}

async function compile() {
  if (!clean) {
    log.error('CleanCSS not initialized');
    return;
  }
  const dirs = fs.readdirSync(root);
  const files = [];
  for (const dir of dirs) {
    if (fs.lstatSync(`${root}/${dir}`).isDirectory() && fs.existsSync(`${root}/${dir}/${dir}.js`)) files.push(`${root}/${dir}/${dir}.js`);
  }
  log.data('Build sources:', files, jsFiles);
  try {
    const t0 = process.hrtime.bigint();
    const meta = esbuild.buildSync({
      banner,
      entryPoints: [...files, ...jsFiles],
      outdir: './dist',
      minifyWhitespace: false,
      minifySyntax: false,
      minifyIdentifiers: false,
      bundle: true,
      sourcemap: true,
      external: ['fs', 'crypto', 'util', 'os', 'string_decoder'],
      logLevel: 'error',
      platform: 'browser',
      target: 'es2018',
      format: 'esm',
      metafile: true,
      watch: false,
    });
    const t1 = process.hrtime.bigint();
    const s = await buildStats(meta);
    log.state('Client application rebuild:', Math.trunc(parseInt((t1 - t0).toString()) / 1000 / 1000), 'ms', s.imports, 'imports in', s.importBytes, 'bytes', s.modules, 'modules in', s.moduleBytes, 'bytes', s.outputs, 'outputs in', s.outputBytes, 'bytes');
  } catch (err) {
    log.error('Client application build error', JSON.stringify(err.errors || err, null, 2));
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

if (require.main === module) {
  log.header();
  init();
  compile();
} else {
  exports.init = init;
  exports.compile = compile;
}
