/* eslint-disable no-console */

const fs = require('fs');
const nedb = require('nedb-promises');
const log = require('@vladmandic/pilogger');

global.config = JSON.parse(fs.readFileSync('./config.json'));
const now = new Date();

function fix(obj) {
  const cur = new Date(obj);
  if (cur > now) {
    return new Date(cur.getTime() / 1000);
  }
  return obj;
}

function year(obj) {
  if (obj > now.getFullYear()) {
    const dt = new Date(0);
    dt.setFullYear(obj);
    const t = dt.getTime() / 1000;
    const y = new Date(t);
    return y.getFullYear();
  }
  return obj;
}

async function main() {
  if (!fs.existsSync(global.config.server.db)) log.warn('Image cache not found:', global.config.server.db);
  global.db = nedb.create({ filename: global.config.server.db, inMemoryOnly: false, timestampData: true, autoload: false });
  await global.db.ensureIndex({ fieldName: 'image', unique: true, sparse: true });
  await global.db.ensureIndex({ fieldName: 'processed', unique: false, sparse: false });
  await global.db.loadDatabase();
  const records = await global.db.count({});
  console.log('Image cache loaded:', global.config.server.db, 'records:', records);

  const images = await global.db.find({ hash: { $exists: true } });
  // console.log(new Date(i.exif.created), new Date(i.exif.modified), new Date(i.exif.modified).getFullYear());
  for (const i in images) {
    console.log(images[i].image);
    for (const tag in images[i].tags) {
      if (images[i].tags[tag].edited) images[i].tags[tag].edited = fix(images[i].tags[tag].edited);
      if (images[i].tags[tag].created) images[i].tags[tag].created = fix(images[i].tags[tag].created);
      if (images[i].tags[tag].year) images[i].tags[tag].year = year(images[i].tags[tag].year);
    }
    // console.log(images[i].tags);
    global.db.update({ image: images[i].image }, images[i], { upsert: true });
  }
}

main();
