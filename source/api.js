const fs = require('fs');
const parser = require('exif-parser');
const log = require('pilogger');
const distance = require('./distance.js');
const geo = require('../assets/cities.json');

function geoLookup(json) {
  if (!json.lon || !json.lat) return json;
  const loc = distance.nearest(json.lat, json.lon, geo.data, 2);
  return { ...json, city: loc[0].name, near: loc[1] ? loc[1].name : '', country: loc[0].country, continent: loc[0].continent };
}

function api(app) {
  app.get('/list/:prefix', (req, res) => {
    let matched = [];
    try {
      const match = req.params.prefix ? req.params.prefix : '';
      const dir = fs.readdirSync('./samples');
      if (match) matched = dir.filter((a) => a.includes(match));
      log.info(`Requested file listing for:${match} total:${dir.length} matched:${matched.length}`);
    } catch { /**/ }
    res.json({ files: matched, folder: '/samples' });
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
          const data = geoLookup(json);
          resolve(data);
        })
        .on('error', (err) => {
          log.warn('EXIF', err.code ? err.code : err);
          resolve(json);
        });
    });
  }

  app.get('/exif', async (req, res) => {
    const url = `.${decodeURI(req.query.image)}`;
    const json = await getExif(url);
    res.json(json);
  });
}

exports.init = api;
