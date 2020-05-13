const fs = require('fs');
const parser = require('exif-parser');
const log = require('pilogger');
const distance = require('./geoNearest.js');
const geo = require('../assets/cities.json');

function geoLookup(json) {
  if (!json.lon || !json.lat) return json;
  const loc = distance.nearest(json.lat, json.lon, geo.data, 1);
  const near = distance.nearest(json.lat, json.lon, geo.large, 1);
  const res = { city: loc[0].name, near: near[0].name, country: loc[0].country, continent: loc[0].continent };
  return res;
}

function api(app) {
  geo.large = geo.data.filter((a) => a.population > 100000);
  log.info('Geo all cities database:', geo.data.length);
  log.info('Geo large cities database:', geo.large.length);
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
    res.json({ files: dir });
  });

  async function getExif(url) {
    return new Promise((resolve) => {
      let json = {};
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
            raw = parser.create(chunk).parse();
            json = {
              bytes: fs.statSync(url).size,
              make: raw.tags.Make,
              model: raw.tags.Model,
              lens: raw.tags.LensModel,
              software: raw.tags.Software,
              modified: raw.tags.ModifyDate,
              created: raw.tags.CreateDate || raw.tags.DateTimeOriginal,
              lat: raw.tags.GPSLatitude,
              lon: raw.tags.GPSLongitude,
              exposure: raw.tags.ExposureTime,
              apperture: raw.tags.FNumber,
              iso: raw.tags.ISO,
              fov: raw.tags.FocalLengthIn35mmFormat,
              width: raw.tags.ExifImageWidth,
              heigh: raw.tags.ExifImageHeight,
            };
          } catch (err) {
            log.warn('EXIF', err);
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

  app.get('/exif', async (req, res) => {
    const json = await getExif(decodeURI(req.query.image));
    res.json(json);
  });
}

exports.init = api;
