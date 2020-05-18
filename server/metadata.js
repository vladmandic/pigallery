/* eslint-disable no-underscore-dangle */

const fs = require('fs');
const crypto = require('crypto');
const parser = require('exif-parser');
const log = require('pilogger');
const distance = require('./geoNearest.js');

let wordNet = {};

function init() {
  let data;
  data = fs.readFileSync('assets/WordNet-Synset.json', 'utf8');
  let terms = 0;
  for (const line of data.split('\n')) {
    if (line.includes('_wnid')) terms++;
  }
  wordNet = JSON.parse(data);
  log.info('Loaded WordNet database:', terms, 'terms in', data.length, 'bytes');
  data = fs.readFileSync('assets/Cities.json');
  const cities = JSON.parse(data);
  const large = cities.data.filter((a) => a.population > 100000);
  log.info('Loaded all cities database:', cities.data.length, 'all cities', large.length, 'large cities');
  distance.init(cities.data, large);
  data = null;
}

function storeObject(json) {
  const index = global.results.findIndex((a) => a.image === json.image);
  if (index > -1) global.results[index] = json;
  else global.results.push(json);
  log.data(`${index > -1 ? 'Update' : 'Create'}: "${json.image}"`, JSON.stringify(json).length, 'bytes');
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

async function getExif(url) {
  // log.data('Lookup EXIF:', url);
  return new Promise((resolve) => {
    const json = {};
    if (!fs.existsSync(url)) resolve(json);
    const stream = fs.createReadStream(url, { start: 0, end: 65536 });
    stream
      .on('data', (chunk) => {
        const raw = parseExif(chunk, 5);
        if (!raw || !raw.tags) log.warn('Could not get EXIF data:', url);
        const stat = fs.statSync(url);
        json.bytes = stat.bytes;
        json.timestamp = raw && raw.tags ? (raw.tags.ModifyDate || raw.tags.CreateDate || raw.tags.DateTimeOriginal) : null;
        if (!json.timestamp) json.timestamp = parseFloat(stat.ctimeMs / 1000);
        if (raw && raw.tags) {
          json.make = raw.tags.Make;
          json.model = raw.tags.Model;
          json.lens = raw.tags.LensModel;
          json.software = raw.tags.Software;
          json.modified = raw.tags.ModifyDate;
          json.created = raw.tags.CreateDate || raw.tags.DateTimeOriginal;
          json.lat = raw.tags.GPSLatitude;
          json.lon = raw.tags.GPSLongitude;
          json.exposure = raw.tags.ExposureTime;
          json.apperture = raw.tags.FNumber;
          json.iso = raw.tags.ISO;
          json.fov = raw.tags.FocalLengthIn35mmFormat;
          json.width = raw.tags.ExifImageWidth;
          json.heigh = raw.tags.ExifImageHeight;
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

async function listFiles(inFolder, inMatch, recursive, force) {
  let files = [];
  const stats = {};
  const folder = inFolder ? decodeURI(inFolder) : '.';
  const match = inMatch ? decodeURI(inMatch) : null;
  try {
    if (fs.existsSync(folder)) files = fs.readdirSync(folder);
  } catch { /**/ }
  stats.all = files.length;
  files = files.filter((a) => {
    let stat;
    try {
      stat = fs.statSync(`${folder}/${a}`);
    } catch { /**/ }
    if (stat && stat.isFile()) return true;
    return false;
  });
  stats.files = files.length;
  if (match) {
    files = files.filter((a) => a.includes(match));
  }
  stats.matched = files.length;
  if (!force) {
    files = files.filter((a) => {
      for (const item of global.results) {
        if (item.image === `${folder}/${a}`) return false;
      }
      return true;
    });
  }
  stats.processed = stats.matched - files.length;
  stats.list = files.length;
  log.info(`Lookup files:${folder} matching:${match || '*'} recursive:${recursive} force:${force} total:${stats.all} files:${stats.files} matched:${files.length} processed:${stats.processed} returned:${stats.list}`);
  return { files, folder, recursive, force, stats };
}

exports.init = init;
exports.descriptions = getDescription;
exports.location = getLocation;
exports.exif = getExif;
exports.hash = getHash;
exports.tags = buildTags;
exports.store = storeObject;
exports.list = listFiles;
