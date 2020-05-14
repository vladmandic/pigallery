const fs = require('fs');
const parser = require('exif-parser');
const log = require('pilogger');
const distance = require('./geoNearest.js');
const geo = require('../assets/cities.json');

function geoLookup(json) {
  if (!json.lon || !json.lat) return json;
  const loc = distance.nearest(json.lat, json.lon, 'all', 1);
  const near = distance.nearest(json.lat, json.lon, 'large', 1);
  const res = { city: loc[0].name, near: near[0].name, country: loc[0].country, continent: loc[0].continent };
  return res;
}

async function getExif(url) {
  return new Promise((resolve) => {
    const json = {};
    if (!fs.existsSync(url)) resolve(json);
    const stream = fs.createReadStream(url, { start: 0, end: 65536 });
    stream
      .on('data', (chunk) => {
        let raw;
        let error = false;
        try {
          raw = parser.create(chunk).parse();
        } catch {
          error = true;
        }
        try {
          if (error) raw = parser.create(chunk).parse();
        } catch {
          error = true;
        }
        try {
          if (error) raw = parser.create(chunk).parse();
        } catch {
          error = true;
        }
        json.bytes = fs.statSync(url).size;
        if (!error && raw.tags) {
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
        const loc = geoLookup(json);
        resolve({ ...json, ...loc });
      })
      .on('error', (err) => {
        log.warn('EXIF', JSON.stringify(err));
        resolve(json);
      });
  });
}

function api(app) {
  geo.large = geo.data.filter((a) => a.population > 100000);
  distance.init(geo.data, geo.large);
  log.info('API ready');

  app.get('/list', (req, res) => {
    let dir = [];
    try {
      if (req.query.folder) {
        const folder = decodeURI(req.query.folder);
        const match = req.query.match ? decodeURI(req.query.match) : null;
        if (fs.existsSync(folder)) dir = fs.readdirSync(folder);
        if (dir && match) dir = dir.filter((a) => a.includes(match));
        log.info(`Requested file listing for:${folder} matching:${match || '*'} matched:${dir.length}`);
      }
    } catch { /**/ }
    res.status(200).json({ files: dir });
  });

  app.get('/exif', async (req, res) => {
    const json = await getExif(decodeURI(req.query.image));
    res.status(200).json(json);
  });

  app.get('/media/*', async (req, res) => {
    // console.log(req); res.sendStatus(404); return;
    const fileName = decodeURI(req.url).replace('/media/', 'media/');
    if (!fs.existsSync(fileName)) {
      res.sendStatus(404);
      return;
    }
    const stat = fs.statSync(fileName);
    const fileSize = stat.size;
    const splitName = fileName.split('.');
    const fileExt = splitName[splitName.length - 1].toLowerCase();
    let contentType;
    if (fileExt === 'jpeg' || fileExt === 'jpg') contentType = 'image/jpeg';
    if (fileExt === 'mp4') contentType = 'video/mp4';
    if (!contentType) {
      res.sendStatus(405);
      return;
    }
    if (req.headers.range) {
      const parts = req.headers.range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      fs.createReadStream(fileName, { start, end }).pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(fileName).pipe(res);
    }
  });
}

exports.init = api;
