const esbuild = require('esbuild');
const log = require('pilogger');

const entryPoints = ['client/gallery.js', 'client/video.js', 'client/process.js', 'client/compare.js', 'client/worker.js'];
let service;

async function init() {
  service = await esbuild.startService();
}

async function compile() {
  try {
    await service.build({
      entryPoints,
      outdir: './dist',
      minify: true,
      bundle: true,
      sourcemap: true,
      external: ['fs', 'crypto', 'util'],
      logLevel: 'error',
    });
    log.state('Client application rebuild ready');
  } catch (err) {
    log.state('Client application build error', err.errors);
  }
}

exports.init = init;
exports.compile = compile;
