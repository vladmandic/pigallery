const log = require('@vladmandic/pilogger');
const fs = require('fs');
const path = require('path');
const exif = require('jpeg-exif');
const parser = require('exif-parser');
const proc = require('process');
const moment = require('moment');
const distance = require('./nearest.js');
const metadata = require('./metadata');

function getTime(time) {
  if (!time) return null;
  let t;
  if (time.toString().match(/[^\d]/)) {
    t = moment(time, 'YYYY:MM:DD HH:mm:ss');
    if (!t.isValid()) t = new Date(time);
    else t = t.toDate();
  } else {
    t = new Date(parseInt(time));
  }
  if (t.getFullYear() < 1971) t = new Date(1000 * parseInt(time));
  return t.getTime();
}

function getLocation(json) {
  if (!json.lon || !json.lat) return {};
  const loc = distance.nearest(json.lat, json.lon, 'all', 1);
  const near = distance.nearest(json.lat, json.lon, 'large', 1);
  const state = loc[0] && Number.isNaN(parseInt(loc[0].state)) ? loc[0].state : '';
  const res = { city: loc[0]?.name, near: near[0]?.name, state, country: loc[0]?.country, continent: loc[0]?.continent };
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
  const tags = raw ? raw.tags : {};
  return tags;
}

async function getExif(url) {
  return new Promise((resolve) => {
    const json = {};
    if (!fs.existsSync(url)) resolve(json);
    const stat = fs.statSync(url);
    json.bytes = stat.size;
    json.ctime = stat.ctime;
    json.mtime = stat.mtime;
    let chunk = Buffer.alloc(0);
    if (url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg')) {
      // const stream = fs.createReadStream(url, { highWaterMark: 4 * 1024 * 1024 });
      const stream = fs.createReadStream(url, { highWaterMark: 65536, start: 0, end: 65535, flags: 'r', autoClose: true, emitClose: true });
      stream
        .on('data', (buf) => {
          // @ts-ignore missing type for buffer
          chunk = Buffer.concat([chunk, buf]);
          if (chunk.length >= 65536) {
            stream.close();
          }
        })
        .on('close', () => {
          const meta1 = parseExif(chunk, 10) || {};
          let meta2;
          try {
            meta2 = exif.fromBuffer(chunk) || {};
          } catch {
            meta2 = {};
          }
          if (!meta2.SubExif) meta2.SubExif = {};
          if (!meta2.GPSInfo) meta2.GPSInfo = {};
          json.make = meta1.Make || meta2.Make;
          json.model = meta1.Model || meta2.Model;
          json.lens = meta1.LensModel || meta2.SubExif.LensModel;
          json.software = meta1.Software || meta2.Software;
          json.created = getTime(meta1.CreateDate || meta1.DateTimeOriginal || meta2.DateTime || meta2.SubExif.DateTimeOriginal || meta2.GPSInfo.GPSDateStamp) || undefined;
          json.modified = getTime(meta1.ModifyDate) || undefined;
          json.exposure = meta1.ExposureTime || (meta2.SubExif.ExposureTime ? meta2.SubExif.ExposureTime[0] : undefined);
          json.apperture = meta1.FNumber || (meta2.SubExif.FNumber ? meta2.SubExif.FNumber[0] : undefined);
          json.iso = meta1.ISO || meta2.SubExif.ISO || meta2.SubExif.PhotographicSensitivity;
          json.fov = meta1.FocalLengthIn35mmFilm || meta2.SubExif.FocalLengthIn35mmFilm;
          const west = meta2.GPSInfo.GPSLongitudeRef === 'W' ? -1 : 1;
          json.lat = meta1.GPSLatitude || (meta2.GPSInfo.GPSLatitude ? (meta2.GPSInfo.GPSLatitude[0] || 0) + ((meta2.GPSInfo.GPSLatitude[1] || 0) / 60) + ((meta2.GPSInfo.GPSLatitude[2] || 0) / 3600) : undefined);
          json.lon = meta1.GPSLongitude || (meta2.GPSInfo.GPSLongitude ? west * (meta2.GPSInfo.GPSLongitude[0] || 0) + ((meta2.GPSInfo.GPSLongitude[1] || 0) / 60) + ((meta2.GPSInfo.GPSLongitude[2] || 0) / 3600) : undefined);
          json.width = meta1.ImageWidth || meta1.ExifImageWidth || meta2.ImageWidth || meta2.SubExif.PixelXDimension || null;
          json.height = meta1.ImageHeight || meta1.ExifImageHeight || meta2.ImageHeight || meta2.SubExif.PixelYDimension || null;
          if (!json.width) json.width = meta1.XResolution || meta2.XResolution || undefined;
          if (!json.height) json.height = meta1.YResolution || meta2.YResolution || undefined;
          json.unit = (meta1.ResolutionUnit || meta2.ResolutionUnit) === 2 ? 'inch' : 'cm';
          resolve(json);
        })
        .on('error', (err) => {
          log.warn('EXIF Error', err);
          resolve(json);
        });
    }
  });
}

async function testExif(dir) {
  // eslint-disable-next-line no-console
  console.log('Test', dir);
  /*
  db = nedb.create({ filename: config.server.nedb, inMemoryOnly: false, timestampData: true, autoload: false });
  await db.loadDatabase();
  const list = [];
  let filesAll = [];
  for (const location of config.locations) {
    const folder = await listFiles(location.folder, location.match, location.recursive, location.force);
    list.push({ location, files: folder.process });
    filesAll = [...filesAll, ...folder.files];
  }
  console.log('list', list);
  console.log('all', filesAll);
  */
  const config = JSON.parse(fs.readFileSync('./config.json').toString());
  await metadata.init(config, null);
  if (fs.statSync(dir).isFile()) {
    const data = await getExif(dir);
    const geo = await getLocation(data);
    // eslint-disable-next-line no-console
    console.log(dir, data, geo);
  } else {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const data = await getExif(path.join(dir, file));
      const geo = await getLocation({ lat: data.lat, lon: data.lon });
      // eslint-disable-next-line no-console
      console.log(path.join(dir, file), geo, data);
    }
  }
}

if (require.main === module) {
  testExif(proc.argv[2]);
}

exports.get = getExif;
exports.location = getLocation;
