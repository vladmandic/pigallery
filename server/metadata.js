/* eslint-disable no-underscore-dangle */

const fs = require('fs');
const path = require('path');
const proc = require('process');
const crypto = require('crypto');
const parser = require('exif-parser');
const log = require('pilogger');
const distance = require('./geoNearest.js');
const config = require('../config.json');

let wordNet = {};

function init() {
  let data;
  data = fs.readFileSync(config.server.descriptionsDB, 'utf8');
  let terms = 0;
  for (const line of data.split('\n')) {
    if (line.includes('_wnid')) terms++;
  }
  wordNet = JSON.parse(data);
  log.state('Loaded WordNet database:', config.server.descriptionsDB, terms, 'terms in', data.length, 'bytes');
  data = fs.readFileSync(config.server.citiesDB);
  const cities = JSON.parse(data);
  const large = cities.data.filter((a) => a.population > 100000);
  log.state('Loaded all cities database:', config.server.citiesDB, cities.data.length, 'all cities', large.length, 'large cities');
  distance.init(cities.data, large);
  data = null;
}

function storeObject(data) {
  if (data.image === config.server.warmupImage) return;
  // eslint-disable-next-line no-param-reassign
  const json = data;
  const analyzed = (json.classify && json.classify.length > 0) || (json.detect && json.detect.length > 0) || (json.exif && json.exif.camera);
  // eslint-disable-next-line no-param-reassign
  json.processed = new Date();
  if (config.server.dbEngine === 'json') {
    const index = global.json.findIndex((a) => a.image === json.image);
    if (index > -1) global.json[index] = json;
    else global.json.push(json);
    log.data(`${index > -1 ? 'Update' : 'Create'}: "${json.image}"`, JSON.stringify(json).length, 'bytes');
  } else {
    const record = { name: json.image, time: json.exif.timestamp, analyzed, data: JSON.stringify(json) };
    global.db.update({ name: json.image }, record, { upsert: true });
    log.data(`Insert: "${json.image}"`, JSON.stringify(json).length, 'bytes');
  }
}

function buildTags(object) {
  // log.data('Build tags:', object.image);
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
  if (object.classify) {
    tags.push({ property: 'classified' });
    for (const obj of object.classify) tags.push({ classified: obj.class });
  }
  if (object.alternative) {
    tags.push({ property: 'alternative' });
    for (const obj of object.alternative) tags.push({ classified: obj.class });
  }
  if (object.detect) {
    tags.push({ property: 'detected' });
    for (const obj of object.detect) tags.push({ detected: obj.class });
  }
  if (object.descriptions) {
    tags.push({ property: 'described' });
    for (const description of object.descriptions) {
      for (const lines of description) tags.push({ description: lines.name });
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
    if (object.exif.created) tags.push({ created: new Date(1000 * object.exif.created) });
    if (object.exif.created) tags.push({ year: new Date(1000 * object.exif.created).getFullYear() });
    if (object.exif.modified) tags.push({ edited: new Date(1000 * object.exif.modified) });
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

function getDescription(json) {
  // log.data('Lookup WordNet:', JSON.stringify(json));
  const results = [];
  if (!json || !Array.isArray(json)) return results;
  for (const guess of json) {
    const descriptions = searchClasses(guess.wnid);
    const lines = [];
    for (const description of descriptions) {
      lines.push({ name: description.name, desc: description.desc });
    }
    results.push(lines);
  }
  return results;
}

function getLocation(json) {
  // log.data('Lookup Location:', json.lat, json.lon);
  if (!json.lon || !json.lat) return json;
  const loc = distance.nearest(json.lat, json.lon, 'all', 1);
  const near = distance.nearest(json.lat, json.lon, 'large', 1);
  const state = isNaN(loc[0].state) ? loc[0].state : '';
  const res = { city: loc[0].name, near: near[0].name, state, country: loc[0].country, continent: loc[0].continent };
  return res;
}

function parseExif(chunk, tries) {
  let raw;
  let error = false;
  try {
    raw = parser.create(chunk).parse();
  } catch {
    error = true;
  }
  if (error && tries > 0) raw = parseExif(chunk, tries - 1);
  return raw;
}

function getTime(time) {
  if (!time) return null;
  let t = time.toString().match(/[^\d]/) ? new Date(time) : new Date(parseInt(time, 10));
  if (t.getFullYear === '1970') t = new Date(1000 * parseInt(time, 10));
  const epoch = parseInt(t.getTime() / 1000, 10);
  return epoch;
}
async function getExif(url) {
  // log.data('Lookup EXIF:', url);
  return new Promise((resolve) => {
    const json = {};
    if (!fs.existsSync(url)) resolve(json);
    const stream = fs.createReadStream(url, { start: 0, end: 65536 });
    stream
      .on('data', (chunk) => {
        let raw;
        if (url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg')) {
          raw = parseExif(chunk, 10);
          if (!raw || !raw.tags && url !== config.server.warmupImage) log.warn('Metadata EXIF:', url);
        }
        const stat = fs.statSync(url);
        json.bytes = stat.size;
        json.timestamp = raw && raw.tags ? getTime(raw.tags.CreateDate || raw.tags.DateTimeOriginal) : null;
        if (!json.timestamp) json.timestamp = Math.min(getTime(stat.mtimeMs), getTime(stat.ctimeMs));
        if (raw && raw.tags) {
          json.make = raw.tags.Make;
          json.model = raw.tags.Model;
          json.lens = raw.tags.LensModel;
          json.software = raw.tags.Software;
          json.modified = getTime(raw.tags.ModifyDate);
          json.created = getTime(raw.tags.CreateDate || raw.tags.DateTimeOriginal);
          json.lat = raw.tags.GPSLatitude;
          json.lon = raw.tags.GPSLongitude;
          json.exposure = raw.tags.ExposureTime;
          json.apperture = raw.tags.FNumber;
          json.iso = raw.tags.ISO;
          json.fov = raw.tags.FocalLengthIn35mmFormat;
          json.width = raw.tags.ExifImageWidth || raw.imageSize.width;
          json.heigh = raw.tags.ExifImageHeight || raw.imageSize.height;
        }
        stream.close();
      })
      .on('close', () => {
        resolve(json);
      })
      .on('error', (err) => {
        log.warn('EXIF', JSON.stringify(err));
        resolve(json);
      });
  });
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
        if (match) {
          if (path.includes(match)) files.push(name);
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
    log.warn('Filesystem:', folder, 'error:', err);
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
  if (force) {
    process = files;
  } else {
    // eslint-disable-next-line no-lonely-if
    if (config.server.dbEngine === 'json') {
      process = files.filter((a) => {
        for (const item of global.json) {
          if (item.image === a) {
            if (item.analyzed) {
              processed++;
              return false;
            }
            return true;
          }
        }
        return true;
      });
      process = process.map((a) => a.image);
    } else {
      for (const a of files) {
        const image = await global.db.find({ name: a });
        if (image && image[0] && image[0].analyzed) processed++;
        else process.push(a);
      }
    }
  }
  log.info(`Lookup files:${folder} matching:${match || '*'} recursive:`, recursive, 'force:', force, 'results:', files.length, 'processed:', processed, 'queued:', process.length);
  return { files, process };
}

async function checkRecords(list) {
  let before = 0;
  let after = 0;
  let deleted = 0;
  if (config.server.dbEngine === 'json') {
    deleted = global.json.filter((a) => !list.includes(a.image));
    deleted = deleted.map((a) => a.image);
    before = global.json.length;
    for (const remove of deleted) {
      log.data('Delete:', remove);
    }
    global.json = global.json.filter((a) => !deleted.includes(a.image));
    after = global.json.length;
    log.info(`Remove: ${deleted.length} deleted images from cache (before: ${before}, after: ${after})`);
  } else {
    let all = await global.db.find({});
    all = all.map((a) => a.name);
    deleted = all.filter((a) => !list.includes(a));
    for (const item of deleted) {
      log.data('Delete:', item);
      global.db.remove({ name: item });
    }
    before = all.length;
    after = await global.db.count({});
  }
  log.info(`Remove: ${deleted.length} deleted images from cache (before: ${before}, after: ${after})`);
}

async function test(url) {
  const exif = await getExif(url);
  // eslint-disable-next-line no-console
  console.log(exif);
}

exports.init = init;
exports.descriptions = getDescription;
exports.location = getLocation;
exports.exif = getExif;
exports.hash = getHash;
exports.tags = buildTags;
exports.store = storeObject;
exports.list = listFiles;
exports.check = checkRecords;

if (!module.parent) {
  test(proc.argv[2]);
}
