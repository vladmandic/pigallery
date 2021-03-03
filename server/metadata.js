/* eslint-disable no-underscore-dangle */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('@vladmandic/pilogger');
const distance = require('./nearest.js');

let wordNet = {};
let config;
let db;

async function init(inConfig, inDB) {
  let data;
  config = inConfig;
  db = inDB;
  data = fs.readFileSync(config.server.descriptionsDB, 'utf8');
  let terms = 0;
  for (const line of data.split('\n')) {
    if (line.includes('_wnid')) terms++;
  }
  wordNet = JSON.parse(data);
  log.state('Loaded WordNet database:', config.server.descriptionsDB, terms, 'terms in', data.length, 'bytes');
  data = fs.readFileSync(config.server.citiesDB);
  const cities = JSON.parse(data.toString());
  const large = cities.data.filter((a) => a.population > 100000);
  log.state('Loaded all cities database:', config.server.citiesDB, cities.data.length, 'all cities', large.length, 'large cities');
  distance.init(cities.data, large);
  data = null;
}

function storeObject(data) {
  if (data.image === config.server.warmupImage) return;
  const json = data;
  json.processed = new Date();
  db.update({ image: json.image }, json, { upsert: true });
  log.data(`DB Insert "${json.image}"`, JSON.stringify(json).length, 'bytes');
}

function buildTags(object) {
  const tags = [];
  const filePart = object.image.split('/');
  for (const name of filePart) tags.push({ name: name.toLowerCase() });
  const fileExt = object.image.split('.');
  tags.push({ ext: fileExt[fileExt.length - 1].toLowerCase() });
  if (object.pixels) {
    let size;
    if (object.pixels / 1024 / 1024 > 40) size = 'huge';
    else if (object.pixels / 1024 / 1024 > 10) size = 'large';
    else if (object.pixels / 1024 / 1024 > 1) size = 'medium';
    else size = 'small';
    tags.push({ size });
  }
  let found;
  found = [];
  for (const obj of object.classify) {
    if (!found.includes(obj.class)) {
      found.push(obj.class);
      tags.push({ classified: obj.class });
    }
  }
  found = [];
  for (const obj of object.detect) {
    if (!found.includes(obj.class)) {
      found.push(obj.class);
      tags.push({ detected: obj.class });
    }
  }
  found = [];
  for (const obj of object.descriptions) {
    for (const line of obj) {
      if (!found.includes(line.name)) {
        found.push(line.name);
        tags.push({ desc: line.name });
      }
    }
  }
  if (object.person && object.person.length > 0) {
    for (const person of object.person) {
      let age;
      if (person.age < 10) age = 'kid';
      else if (person.age < 20) age = 'teen';
      else if (person.age < 30) age = '20ies';
      else if (person.age < 40) age = '30ies';
      else if (person.age < 50) age = '40ies';
      else if (person.age < 60) age = '50ies';
      else if (person.age < 100) age = 'old';
      else age = 'uknown';
      tags.push({ property: 'face' });
      tags.push({ gender: person.gender }, { emotion: person.emotion }, { age });
    }
  }
  if (object.exif && object.exif.created) {
    tags.push({ property: 'exif' });
    if (object.exif.make) tags.push({ camera: object.exif.make.toLowerCase() });
    if (object.exif.model) tags.push({ camera: object.exif.model.toLowerCase() });
    if (object.exif.lens) tags.push({ lens: object.exif.lens.toLowerCase() });
    if (object.exif.created) tags.push({ created: new Date(object.exif.created) });
    if (object.exif.created) tags.push({ year: new Date(object.exif.created).getFullYear() });
    if (object.exif.modified) tags.push({ edited: new Date(object.exif.modified) });
    if (object.exif.software) tags.push({ software: object.exif.software.toLowerCase() });
    if (object.exif.iso && object.exif.apperture && object.exif.exposure) {
      const conditions = object.exif.iso / (object.exif.apperture ** 2) * object.exif.exposure;
      if (conditions < 0.01) tags.push({ conditions: 'bright' }, { conditions: 'outdoors' });
      else if (conditions < 0.1) tags.push({ conditions: 'outdoors' });
      else if (conditions < 5) tags.push({ conditions: 'indoors' });
      else if (conditions < 20) tags.push({ conditions: 'night' });
      else tags.push({ conditions: 'night' }, { conditions: 'long' });
    }
    if (object.exif.fov) {
      if (object.exif.fov > 200) tags.push({ zoom: 'superzoom' }, { zoom: 'zoom' });
      else if (object.exif.fov > 100) tags.push({ zoom: 'zoom' });
      else if (object.exif.fov > 40) tags.push({ zoom: 'portrait' });
      else if (object.exif.fov > 20) tags.push({ zoom: 'wide' });
      else tags.push({ zoom: 'wide' }, { zoom: 'ultrawide' });
    }
  }
  if (object.location && object.location.city) {
    tags.push(
      { city: object.location.city.toLowerCase() },
      { state: object.location.state.toLowerCase() },
      { country: object.location.country.toLowerCase() },
      { continent: object.location.continent.toLowerCase() },
      { near: object.location.near.toLowerCase() },
    );
  }
  return tags;
}

function searchClasses(wnid) {
  const res = [];
  if (wnid === '') return res;
  // eslint-disable-next-line consistent-return
  function recursive(obj) {
    for (const item of obj) {
      if (item._wnid === wnid) return res.push({ id: item._wnid, name: item._words, desc: item._gloss });
      if (item.synset && recursive(item.synset)) return res.push({ id: item._wnid, name: item._words, desc: item._gloss });
    }
  }
  recursive(wordNet.ImageNetStructure.synset[0].synset);
  return res;
}

function getDescription(image) {
  const results = [];
  const found = [];
  const ids = [];
  for (const item of image.classify) {
    if (!found.includes(item.class)) {
      found.push(item.class);
      ids.push(item.wnid);
    }
  }
  for (const id of ids) {
    const descriptions = searchClasses(id);
    const lines = [];
    for (const description of descriptions) {
      if (description.name) lines.push({ name: description.name, desc: description.desc });
    }
    if (lines.length > 0) {
      if (lines.length > 3) lines.length = 3;
      results.push(lines);
    }
  }
  return results;
}

async function getHash(file, hashType) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return new Promise((resolve) => {
    const stream = fs.createReadStream(file, { highWaterMark: 4 * 16 * 65536 });
    stream.on('data', (chunk) => {
      const digest = crypto
        .createHash(hashType)
        .update(chunk)
        .digest('hex');
      stream.close();
      resolve(digest);
    });
  });
}

function readDir(folder, match = null, recursive = false) {
  let files = [];
  try {
    if (!fs.existsSync(folder)) return files;
    const dir = fs.readdirSync(folder);
    for (const file of dir) {
      const name = path.join(folder, file);
      const stat = fs.statSync(name);
      if (stat.isFile()) {
        if (config.exclude.includes(file)) log.info('FS Exclude:', name);
        else if (match) {
          if (name.includes(match)) files.push(name);
        } else {
          files.push(name);
        }
      }
      if (stat.isSymbolicLink()) {
        const subdir = readDir(name, match, recursive);
        files = [...files, ...subdir];
      }
      if (stat.isDirectory()) {
        if (recursive) {
          const subdir = readDir(name, match, recursive);
          files = [...files, ...subdir];
        }
      }
    }
  } catch (err) {
    log.warn('FS Error', folder, err);
  }
  return files;
}

async function listFiles(folder, match = '', recursive = false, force = false) {
  let files = readDir(`${config.server.mediaRoot}${folder}`, match, recursive);
  files = files.filter((a) => {
    for (const ext of config.server.allowedImageFileTypes) {
      if (a.toLowerCase().endsWith(ext)) return true;
    }
    return false;
  });
  let process = [];
  let processed = 0;
  let updated = 0;
  if (force) {
    process = files;
  } else {
    for (const a of files) {
      const image = await db.find({ image: a });
      if (image && image[0]) {
        const stat = fs.statSync(a);
        if (stat.ctime.getTime() !== image[0].exif.ctime.getTime()) {
          log.data(`  FS ctime updated ${a} ${image[0].exif.ctime} ${stat.ctime}`);
          process.push(a);
          updated++;
        } else if (stat.mtime.getTime() !== image[0].exif.mtime.getTime()) {
          log.data(`  FS mtime updated ${a} ${image[0].exif.mtime} ${stat.mtime}`);
          process.push(a);
          updated++;
        /*
        else if (!image[0].location || !image[0].location.country) {
          log.data(`  Location data missing ${a}`);
          process.push(a);
          updated++;
        */
        } else processed++;
      } else {
        process.push(a);
      }
    }
  }
  log.info(`FS Lookup ${folder} matching:${match || '*'} recursive: ${recursive} force: ${force} results: ${files.length} processed: ${processed} updated: ${updated} queued: ${process.length}`);
  return { files, process };
}

async function checkRecords(list) {
  let all = await db.find({ hash: { $exists: true } });
  all = all.map((a) => a.image);
  const deleted = all.filter((a) => !list.includes(a));
  for (const item of deleted) {
    log.data('Delete:', item);
    db.remove({ image: item });
  }
  const before = all.length;
  const after = await db.count({});
  if (deleted.length > 0) log.info(`DB Remove ${deleted.length} deleted images from cache (before: ${before}, after: ${after})`);
}

exports.init = init;
exports.descriptions = getDescription;
exports.hash = getHash;
exports.tags = buildTags;
exports.store = storeObject;
exports.list = listFiles;
exports.check = checkRecords;
