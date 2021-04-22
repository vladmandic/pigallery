const fs = require('fs');
const process = require('process');
const esbuild = require('esbuild');
const log = require('@vladmandic/pilogger');

const root = 'client';
const jsFiles = ['client/index/worker.ts', 'client/index/pwa-serviceworker.ts'];
const metafile = './asset-manifest.json';

const banner = { js: `
  /*
  PiGallery
  homepage: <https://github.com/vladmandic/pigallery>
  author: <https://github.com/vladmandic>'
  */
` };

const buildOptions = {
  banner,
  outdir: './dist',
  minifyWhitespace: false,
  minifySyntax: false,
  minifyIdentifiers: false,
  bundle: true,
  sourcemap: true,
  external: ['fs', 'crypto', 'util', 'os', 'string_decoder', '*.ttf', '*.woff', '*.woff2', '*.eot', '*#iefix', '*#fontawesome'],
  logLevel: 'error',
  platform: 'browser',
  target: 'es2018',
  format: 'esm',
  metafile: true,
  watch: false,
};

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
  const dirs = fs.readdirSync(root);
  const files = [];
  for (const dir of dirs) {
    if (fs.lstatSync(`${root}/${dir}`).isDirectory() && fs.existsSync(`${root}/${dir}/${dir}.ts`)) files.push(`${root}/${dir}/${dir}.ts`);
  }
  log.data('Build sources:', files, jsFiles);
  try {
    const t0 = process.hrtime.bigint();
    buildOptions.entryPoints = [...files, ...jsFiles];
    // @ts-ignore
    const meta = esbuild.buildSync({ ...buildOptions });
    const t1 = process.hrtime.bigint();
    const s = await buildStats(meta);
    log.state('Client application rebuild:', Math.trunc(parseInt((t1 - t0).toString()) / 1000 / 1000), 'ms', s.imports, 'imports in', s.importBytes, 'bytes', s.modules, 'modules in', s.moduleBytes, 'bytes', s.outputs, 'outputs in', s.outputBytes, 'bytes');
  } catch (err) {
    log.error('Client application build error', JSON.stringify(err.errors || err, null, 2));
  }
}

if (require.main === module) {
  log.header();
  compile();
} else {
  exports.compile = compile;
}
