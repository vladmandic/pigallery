const fs = require('fs');
const path = require('path');
const log = require('pilogger');
const metadata = require('./metadata.js');
const config = require('../config.json');

function api(app) {
  log.state('RESTful API ready');
  metadata.init();

  app.get('/api/log', (req, res) => {
    res.status(200).send('true');
    const msg = decodeURI(req.query.msg || '').replace(/\s+/g, ' ');
    log.info(`Client ${req.session.user}@${req.client.remoteAddress}`, msg);
  });

  app.get('/api/save', (req, res) => {
    if (config.server.dbEngine === 'json') {
      const data = JSON.stringify(global.json);
      fs.writeFileSync(config.server.jsonDB, data);
      log.info('API Save:', config.server.jsonDB, 'records:', global.json.length, 'size:', data.length, 'bytes');
    }
    // nothing to do if using nedb
    res.status(200).send('true');
  });

  app.get('/api/list', async (req, res) => {
    const list = [];
    let filesAll = [];
    for (const location of config.locations) {
      const folder = await metadata.list(location.folder, location.match, location.recursive, location.force);
      list.push({ location, files: folder.process });
      filesAll = [...filesAll, ...folder.files];
    }
    res.json(list);
    metadata.check(filesAll);
  });

  app.get('/api/dir', async (req, res) => {
    if (!req.query.folder) {
      res.status(400).json([]);
      return;
    }
    const folder = await metadata.list(req.query.folder, '', true, true);
    res.json(folder.process);
  });

  app.get('/api/get', async (req, res) => {
    if (!req.query.find) {
      res.status(400).json([]);
      return;
    }
    let data = [];
    if (config.server.dbEngine === 'json') {
      data = global.json;
      if (config.server.authForce) data = data.filter((a) => a.image.startsWith(req.session.root));
    } else {
      const re = new RegExp(`^${req.session.root}`);
      const records = await global.db.find({ image: re }).sort({ time: -1 }).limit(req.query.limit || config.server.resultsLimit);
      for (const record of records) {
        // data.push(JSON.parse(record.data));
        data.push(record);
      }
    }
    res.json(data);
    log.info(`API Get ${req.session.user}@${req.client.remoteAddress} root: ${req.session.root} data:`, data.length);
  });

  app.post('/api/metadata', async (req, res) => {
    const data = req.body;
    const exif = await metadata.exif(data.image);
    const hash = await metadata.hash(data.image, 'sha256');
    const location = await metadata.location(exif);
    const descriptions = await metadata.descriptions(data);
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
    const found = config.users.find((a) => ((a.email && a.email === email) && (a.passwd && a.passwd === passwd) && (a.disabled ? a.disabled === 'false' : true)));
    if (found) {
      req.session.user = found.email;
      req.session.admin = found.admin;
      req.session.root = found.mediaRoot;
    }
    log.info(`API Login: ${email} from ${req.client.remoteAddress} ${req.session.user ? 'success' : 'fail'}`);
    res.redirect('/gallery');
  });
}

exports.init = api;
