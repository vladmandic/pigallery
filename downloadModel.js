/* eslint-disable no-console */
const fs = require('fs');
const fetch = require('node-fetch');

function error(...msg) {
  console.log(...msg);
  process.exit(1);
}

function log(...msg) {
  console.log(...msg);
}

async function download() {
  log('TensorFlow model downloaded');
  log('Warning: no filesystem checks are performed');
  if (process.argv.length !== 4) error('Requires two parameters: model URL and destination folder');

  const url = process.argv[2];
  const dir = process.argv[3];
  log('URL:', url);
  log('Destination folder:', dir);

  if (!fs.existsSync(dir)) error(`Target folder does not exist: ${dir}`);

  let res;
  res = await fetch(`${url}/model.json`);
  if (!res.ok) error(`Model JSON not found at: ${url}`);
  const json = await res.json();
  log('Model JSON parsed');
  fs.writeFileSync(`${dir}/model.json`, JSON.stringify(json, null, 2));
  for (const manifest of json.weightsManifest) {
    for (const weight of manifest.paths) {
      log(' Weights Path: ', weight);
      res = await fetch(`${url}/${weight}`);
      if (!res.ok) error('Cannot fetch', weight);
      const dest = fs.createWriteStream(`${dir}/${weight}`);
      res.body.pipe(dest);
    }
  }
  fs.writeFileSync(`${dir}/model.json`, JSON.stringify(json, null, 2));
  log('Done...');
}

download();
