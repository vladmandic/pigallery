const fs = require('fs');
const path = require('path');
const log = require('@vladmandic/pilogger');
const metadata = require('./metadata.js');

function sign(req) {
  const forwarded = (req.headers['forwarded'] || '').match(/for="\[(.*)\]:/);
  const ip = (Array.isArray(forwarded) ? forwarded[1] : null) || req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
  const user = req.session.share ? '' : req.session.user;
  return `${user}@${ip}`;
}

function api(app) {
  log.state('RESTful API ready');
  app.set('json spaces', 2);
  metadata.init();

  // log namespace

  app.get('/api/log/put', (req, res) => {
    res.status(200).send('true');
    const msg = decodeURI(req.query.msg || '').replace(/\s+/g, ' ');
    log.info('API/Log', sign(req), msg);
  });

  // user namespace

  app.get('/api/user/get', (req, res) => {
    const rec = { user: req.session.user, admin: req.session.admin, root: req.session.root };
    res.json(rec);
    log.info('API/User/Get', sign(req), rec);
  });

  app.post('/api/user/auth', (req, res) => {
    req.session.user = undefined;
    let email;
    let passwd;
    let found = {};
    if (req.body.authShare) {
      found = { email: global.config.share.email, passwd: global.config.share.passwd };
    } else {
      email = req.body.authEmail;
      passwd = req.body.authPassword;
      found = global.config.users.find((a) => ((a.email && a.email === email) && (a.passwd && a.passwd === passwd) && (a.disabled ? a.disabled === 'false' : true)));
    }
    if (found) {
      req.session.user = found.email;
      req.session.admin = found.admin || false;
      req.session.root = found.mediaRoot || global.config.server.mediaRoot;
      req.session.share = req.body.authShare;
    }
    log.info('API/User/Auth', sign(req), email, req.session.user !== undefined);
    res.redirect('/');
  });

  // share namespace

  app.get('/api/share/dir', async (req, res) => {
    if (req.session.share) res.json([]);
    else {
      let shares = await global.db.find({ images: { $exists: true } });
      if (!shares) shares = [];
      const data = shares.map((a) => ({ key: a.share, processed: a.processed, name: a.name, creator: a.creator, size: a.images.length }));
      log.info('API/Share/Dir', sign(req), 'shares:', data.length);
      res.json(data);
    }
  });

  app.get('/api/share/get', async (req, res) => {
    if (req.query.id) {
      const data = await global.db.findOne({ share: req.query.id });
      const images = [];
      for (const image of data.images) {
        images.push(await global.db.findOne({ image }));
      }
      log.info(`API/Share/Get ${sign(req)} creator: ${data.creator} name: "${data.name}" key: ${data.share} images:`, images.length);
      res.json(images);
    } else {
      res.status(400).json([]);
    }
  });

  app.get('/api/share/del', async (req, res) => {
    if (req.query.rm) {
      const data = await global.db.findOne({ share: req.query.rm });
      log.info(`API/Share/Del ${sign(req)} ${data.creator} name: "${data.name}" key: ${data.share} images:`, data.images.length);
      global.db.remove({ share: data.share }, { multi: false });
      res.status(200).send('true');
    } else {
      res.status(400).json([]);
    }
  });

  app.post('/api/share/put', (req, res) => {
    if (req.session.admin) {
      const data = req.body;
      const obj = {};
      obj.creator = data.creator;
      obj.name = data.name;
      obj.processed = new Date();
      obj.images = data['images[]'];
      obj.share = parseInt(obj.processed.getTime() / 1000).toString(36);
      global.db.update({ share: obj.share }, obj, { upsert: true });
      log.info(`API/Share/Put ${sign(req)} "${obj.name}" key: ${obj.share} creator: ${obj.creator} images: `, obj.images.length);
      res.status(200).json({ key: obj.share });
    } else {
      res.status(401).json({});
    }
  });

  // files namespace

  app.get('/api/file/all', async (req, res) => {
    if (req.session.admin) {
      const list = [];
      let filesAll = [];
      for (const location of global.config.locations) {
        const folder = await metadata.list(location.folder, location.match, location.recursive, location.force);
        list.push({ location, files: folder.process });
        filesAll = [...filesAll, ...folder.files];
      }
      res.json(list);
      metadata.check(filesAll);
      log.info(`API/File/All ${sign(req)} locations:`, list.length, 'files:', filesAll.length);
    } else {
      res.status(401).json([]);
    }
  });

  app.get('/api/file/dir', async (req, res) => {
    if (req.session.admin) {
      if (!req.query.folder) {
        res.status(400).json([]);
        return;
      }
      const folder = await metadata.list(req.query.folder, '', true, true);
      res.json(folder.process);
      log.info(`API/File/Dir ${sign(req)} folder: ${req.query.folder} process:`, folder.process.length);
    } else {
      res.status(401).json([]);
    }
  });

  let pagedData = [];
  let pagedSize = 0;
  let pagedCount = 0;

  // record namespace

  app.get('/api/record/get', async (req, res) => {
    const chunks = req.query.chunks ? parseInt(req.query.chunks) : 2000;
    const page = req.query.page ? parseInt(req.query.page) : 0;
    if (page === 0) {
      const data = [];
      if (!req.session.share || req.session.share === '') {
        const root = new RegExp(`^${req.session.root || 'media/'}`);
        const limit = req.query.limit || global.config.server.resultsLimit;
        const time = req.query.time ? new Date(parseInt(req.query.time)) : new Date(0);
        const records = await global.db
          .find({ image: root, processed: { $gte: time } })
          .sort({ processed: -1 })
          .limit(limit);
        for (const i in records) data.push(records[i]);
        log.info(`API/Record/Get ${sign(req)} root: ${req.session.root} images:`, data.length, 'limit:', limit, 'chunk:', chunks, 'since:', new Date(time));
      } else {
        const records = await global.db.findOne({ share: req.session.share });
        for (const image of records.images) {
          data.push(await global.db.findOne({ image }));
        }
        log.info(`API/Record/Get Share ${sign(req)} creator: ${data.creator} name: "${data.name}" key: ${data.share} images: ${data.length}`);
      }
      pagedData = data;
      pagedSize = JSON.stringify(pagedData).length;
      pagedCount = Math.trunc((data.length + chunks) / chunks);
    }
    res.set('content-TotalSize', pagedSize);
    res.set('content-Pages', pagedCount);
    const data = [];
    for (let i = (page * chunks); i < (page * chunks + chunks); i++) {
      if (pagedData[i]) data.push(pagedData[i]);
    }
    const json = JSON.stringify(data);
    res.send(json);
    log.info('API/Record/Get Chunk', 'page:', page, 'of', pagedCount, 'size:', json.length, 'total:', pagedSize);
    if (page === pagedCount) {
      pagedData = [];
      pagedSize = 0;
      pagedCount = 0;
    }
  });

  app.get('/api/record/del', async (req, res) => {
    if (req.query.rm) {
      const data = await global.db.findOne({ image: req.query.rm });
      if (data) {
        log.info(`API/Record/Del ${sign(req)} req: ${req.query.rm} res:`, data.image);
        global.db.remove({ image: data.image }, { multi: false });
        res.json(data.image);
      } else {
        res.status(400).json({ error: 'image not found' });
      }
    } else {
      res.status(400).json([]);
    }
  });

  app.post('/api/record/put', async (req, res) => {
    if (req.session.admin) {
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
      log.info('API/Record/Put', sign(req), data.image);
    } else {
      res.status(401).json({});
    }
  });

  app.get(`${global.config.server.mediaRoot}/*`, async (req, res) => {
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
    const share = req.session.share ? 'Share: ' + req.session.share : '';
    log.info(`API/File ${sign(req)} ${share} ${fileName} ${fileSize} bytes`);
    let contentType;
    if (fileExt === 'jpeg' || fileExt === 'jpg') contentType = 'image/jpeg';
    if (fileExt === 'mp4') contentType = 'video/mp4';
    if (contentType && req.headers.range) {
      const parts = req.headers.range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0]);
      const end = parts[1] ? parseInt(parts[1]) : fileSize - 1;
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
