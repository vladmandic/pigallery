const fs = require('fs');
const path = require('path');
const log = require('pilogger');
const metadata = require('./metadata.js');
const config = require('../data/config.json');

function api(app) {
  log.state('API ready');
  metadata.init();

  app.get('/api/log', (req, res) => {
    const msg = decodeURI(req.query.msg || '').replace(/\s+/g, ' ');
    log.info(`${req.session.user}@${req.client.remoteAddress}`, msg);
    res.status(200).send('true');
  });

  app.get('/api/save', (req, res) => {
    const data = JSON.stringify(global.results);
    fs.writeFileSync(path.join(__dirname, global.cache), data);
    log.info('Image cache saved:', path.join(__dirname, global.cache), 'records:', global.results.length, 'size:', data.length, 'bytes');
    res.status(200).send('true');
  });

  app.get('/api/list', async (req, res) => {
    const json = await metadata.list(req.query.folder || '', req.query.match || null, req.query.recursive || false, req.query.force || false);
    res.json(json);
  });

  app.get('/api/get', (req, res) => {
    if (!req.query.find) {
      res.status(400).json([]);
      return;
    }
    if (req.query.find === 'all') {
      const data = global.results.filter((a) => a.image.startsWith(req.session.root));
      log.info(`Get ${req.session.user}@${req.client.remoteAddress} root: ${req.session.root} data:`, data.length, 'of', global.results.length);
      res.json(data);
    }
  });

  app.post('/api/metadata', async (req, res) => {
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

  app.get('/api/user', (req, res) => {
    res.json({ user: req.session.user, admin: req.session.admin, root: req.session.root });
  });

  app.get(`${config.server.mediaRoot}/*`, async (req, res) => {
    // console.log(req); res.sendStatus(404); return;
    const fileName = decodeURI(req.url);
    if (fileName.startsWith('/')) fileName.substr(1);
    if (!fileName.startsWith(req.session.root)) {
      res.sendStatus(401);
      return;
    }
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

  app.post('/client/auth.html', (req, res) => {
    const email = req.body.authEmail;
    const passwd = req.body.authPassword;
    if (!req.body.authEmail || req.body.authEmail === '') req.session.user = undefined;
    const found = config.users.find((a) => (a.email === email && a.passwd === passwd));
    if (found) {
      req.session.user = found.email;
      req.session.admin = found.admin;
      req.session.root = found.mediaRoot;
    }
    log.info(`Login request: ${email} from ${req.client.remoteAddress} ${req.session.user ? 'success' : 'fail'}`);
    res.redirect('/gallery');
  });
}

exports.init = api;
