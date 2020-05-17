const fs = require('fs');
const path = require('path');
const log = require('pilogger');
const metadata = require('./metadata.js');

function api(app) {
  log.info('API ready');
  metadata.init();

  app.get('/log', (req, res) => {
    const msg = decodeURI(req.query.msg || '').replace(/\s+/g, ' ');
    log.info(req.client.remoteAddress, msg);
    res.status(200).send('true');
  });

  app.get('/save', (req, res) => {
    const data = JSON.stringify(global.results);
    fs.writeFileSync(path.join(__dirname, global.cache), data);
    log.info('Image cache saved:', path.join(__dirname, global.cache), 'records:', global.results.length, 'size:', data.length, 'bytes');
    res.status(200).send('true');
  });

  app.get('/list', (req, res) => {
    let dir = [];
    try {
      if (req.query.folder) {
        const folder = decodeURI(req.query.folder);
        const match = req.query.match ? decodeURI(req.query.match) : null;
        if (fs.existsSync(folder)) dir = fs.readdirSync(folder);
        if (dir && match) dir = dir.filter((a) => a.includes(match));
        log.info(`Lookup files:${folder} matching:${match || '*'} matched:${dir.length}`);
      }
    } catch { /**/ }
    res.status(200).json({ files: dir });
  });

  app.get('/get', (req, res) => {
    if (!req.query.find) {
      res.status(400).json([]);
      return;
    }
    if (req.query.find === 'all') {
      res.json(global.results);
      log.info('Client requested all data: results:', global.results.length);
    } else {
      const img = decodeURI(req.query.find);
      const filtered = global.results.filter((a) => a.image === img);
      res.json(filtered || []);
      log.info('Client requested data for:', img, 'results:', filtered.length || 0);
    }
  });

  app.post('/metadata', async (req, res) => {
    const data = req.body;
    // log.data('Lookup meatadata:', data.image);
    const exif = await metadata.exif(data.image);
    const hash = await metadata.hash(data.image, 'sha256');
    const location = await metadata.location(exif);
    const descriptions = await metadata.descriptions(data.classify);
    const result = { ...data, exif, location, descriptions, hash };
    const tags = await metadata.tags(result);
    result.tags = tags;
    res.status(200).json(result);
    metadata.store(result);
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
    if (contentType && req.headers.range) {
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
    } else if (contentType) {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(fileName).pipe(res);
    } else {
      res.sendFile(fileName, { root: path.join(__dirname, '../') });
    }
  });
}

exports.init = api;
