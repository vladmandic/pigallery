const fs = require('fs');
const parser = require('exif-parser');
const log = require('pilogger');

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
    log.info(`EXIF requested for: ${url}`);
    return new Promise((resolve) => {
      let json = {};
      const stream = fs.createReadStream(url, { start: 0, end: 65536, highWaterMark: 65536 });
      stream
        .on('data', (chunk) => {
          try {
            const raw = parser.create(chunk).parse();
            // log.data('EXIF', raw.tags);
            json = {
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
            log.warn('EXIF', err.code);
          }
          stream.close();
        })
        .on('close', () => {
          resolve(json);
        })
        .on('error', (err) => {
          log.warn('EXIF', err);
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
