const fs = require('fs');
const path = require('path');
const log = require('@vladmandic/pilogger');
const metadata = require('./metadata.js');
const exif = require('./exif.js');

let config;
let db;

const ms = (t0, t1) => Math.trunc(parseFloat((t1 - t0).toString()) / 1000000);

function sign(req) {
  const forwarded = (req.headers.forwarded || '').match(/for="\[(.*)\]:/);
  const ip = (Array.isArray(forwarded) ? forwarded[1] : null) || req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
  const user = req.session.share ? '' : req.session.user;
  return `${user}@${ip}`;
}

function api(app, inConfig, inDB) {
  log.state('RESTful API ready');
  app.set('json spaces', 2);
  config = inConfig;
  db = inDB;
  metadata.init(config, db);

  // log namespace

  app.get('/api/log/put', (req, res) => {
    res.status(200).send('true');
    const msg = decodeURIComponent(req.query.msg || '').replace(/\s+/g, ' ');
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
    let found = { email: null, passwd: '', admin: false, mediaRoot: '' };
    if (req.body.authShare) {
      found.email = config.share.email;
      found.passwd = config.share.passwd;
    } else {
      email = req.body.authEmail;
      passwd = req.body.authPassword;
      found = config.users.find((a) => ((a.email && a.email === email) && (a.passwd && a.passwd === passwd) && (a.disabled ? a.disabled === 'false' : true)));
    }
    if (found) {
      req.session.user = found.email;
      req.session.admin = found.admin || false;
      req.session.root = found.mediaRoot || config.server.mediaRoot;
      req.session.share = req.body.authShare;
    }
    log.info('API/User/Auth', sign(req), email, req.session.user !== undefined);
    res.redirect('/');
  });

  // share namespace
  app.get('/api/models/get', (req, res) => {
    log.info('API/Models/Get', __dirname, sign(req));
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../models.json')).toString());
    res.json(json);
  });

  app.get('/api/share/dir', async (req, res) => {
    if (req.session.share) res.json([]);
    else {
      let shares = await db.find({ images: { $exists: true } });
      if (shares.hasNext) shares = await shares.toArray();
      if (!shares) shares = [];
      const data = shares.map((a) => ({ key: a.share, processed: a.processed, name: a.name, creator: a.creator, size: a.images.length }));
      log.info('API/Share/Dir', sign(req), 'shares:', data.length);
      res.json(data);
    }
  });

  app.get('/api/share/get', async (req, res) => {
    if (req.query.id) {
      const data = await db.findOne({ share: req.query.id });
      const images = [];
      for (const image of data.images) images.push(await db.findOne({ image }));
      log.info(`API/Share/Get ${sign(req)} creator: ${data.creator} name: "${data.name}" key: ${data.share} images:`, images.length);
      res.json(images);
    } else {
      res.status(400).json([]);
    }
  });

  app.get('/api/share/del', async (req, res) => {
    if (req.query.rm) {
      const data = await db.findOne({ share: req.query.rm });
      log.info(`API/Share/Del ${sign(req)} ${data.creator} name: "${data.name}" key: ${data.share} images:`, data.images.length);
      if (db.deleteOne) await db.deleteOne({ share: data.share });
      else await db.remove({ share: data.share }, { multi: false });
      res.status(200).send('true');
    } else {
      res.status(400).json([]);
    }
  });

  app.post('/api/share/put', async (req, res) => {
    if (req.session.admin) {
      const data = req.body;
      const obj = {
        creator: data.creator,
        name: data.name,
        processed: new Date(),
        images: data.images,
        share: ((new Date()).getTime() / 1000).toString(36),
      };
      if (obj.images?.length > 0) {
        if (db.replaceOne) await db.replaceOne({ share: obj.share }, obj, { upsert: true });
        else await db.update({ share: obj.share }, obj, { upsert: true });
        log.info(`API/Share/Put ${sign(req)} "${obj.name}" key: ${obj.share} creator: ${obj.creator} images: `, obj.images?.length);
        res.status(200).json({ key: obj.share });
      } else {
        log.info(`API/Share/Put ${sign(req)} "${obj.name}" key: ${obj.share} creator: ${obj.creator} images: [empty]`);
        res.status(500).json({});
      }
    } else {
      res.status(401).json({});
    }
  });

  // files namespace

  app.get('/api/file/all', async (req, res) => {
    if (req.session.admin) {
      const list = [];
      let filesAll = [];
      for (const location of config.locations) {
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

  // record namespace

  let totalSize = 0;
  let totalImages = 0;
  let estImages = 0;
  app.get('/api/record/get', async (req, res) => {
    const chunkSize = req.query.chunksize ? parseInt(req.query.chunksize) : 200;
    const page = req.query.page ? parseInt(req.query.page) : 0;
    if (page === 0) {
      totalSize = 0;
      totalImages = 0;
    }
    if (!req.session.share || req.session.share === '') {
      const time = req.query.time && parseInt(req.query.time) !== 0 ? new Date(parseInt(req.query.time)) : null;
      const root = req.session.root !== config.server.mediaRoot ? new RegExp(`^${req.session.root || 'media/'}`) : null;
      const query = {};
      query.image = root || { $exists: true };
      query.processed = time ? { $gte: time } : { $exists: true };
      const t0 = process.hrtime.bigint();
      if (page === 0) estImages = await db.count(query);
      let data = await db
        .find(query)
        .sort({ processed: -1 })
        .skip(page * chunkSize)
        .limit(chunkSize);
      if (data.hasNext) data = await data.toArray(); // if mongodb convert to array
      const json = JSON.stringify(data);
      totalSize += json.length;
      const numPages = Math.trunc(estImages / chunkSize);
      const estSize = (numPages - page) * json.length + totalSize;
      totalImages += data.length;
      const t1 = process.hrtime.bigint();
      log.info(
        `API/Record/Get ${sign(req)} root: ${req.session.root}`,
        'page:', page, '/', numPages, 'images:', totalImages, '/', estImages,
        'pageSize:', json.length, 'estSize:', estSize, 'totalSize:', totalSize, 'chunkSize:', chunkSize,
        'sinceTime:', time ? new Date(time) : 'forever', 'perf', ms(t0, t1),
      );
      res.set('content-TotalSize', estSize);
      res.set('content-TotalImages', totalImages);
      res.set('content-EstImages', estImages);
      res.set('content-Pages', numPages);
      // res.send(json);
      res.json(data);
    } else {
      const records = await db.findOne({ share: req.session.share });
      const data = [];
      for (const image of records.images) {
        const record = await db.findOne({ image });
        data.push(record);
      }
      const json = JSON.stringify(data);
      log.info(`API/Record/Get Share ${sign(req)} images:`, data.length, 'size:', json.length);
      res.set('content-TotalSize', json.length);
      res.set('content-TotalImages', data.length);
      res.set('content-Pages', 0);
      res.send(json);
    }
  });

  app.get('/api/record/del', async (req, res) => {
    if (req.query.rm) {
      const data = await db.findOne({ image: req.query.rm });
      if (data) {
        log.info(`API/Record/Del ${sign(req)} req: ${req.query.rm} res:`, data.image);
        if (db.deleteOne) await db.deleteOne({ image: data.image });
        else await db.remove({ image: data.image }, { multi: false });
        res.status(200).json(data.image);
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
      const exifData = await exif.get(data.image);
      const hash = await metadata.hash(data.image, 'sha256');
      const location = await exif.location(exifData);
      const descriptions = await metadata.descriptions(data);
      const result = { ...data, exif: exifData, location, descriptions, hash };
      const tags = await metadata.tags(result);
      result.tags = tags;
      res.status(200).json(result);
      metadata.store(result);
      log.info('API/Record/Put', sign(req), data.image);
    } else {
      res.status(401).json({});
    }
  });

  app.get(`${config.server.mediaRoot}/*`, async (req, res) => {
    const fileName = decodeURIComponent(req.url);
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
    const share = req.session.share ? `Share: ${req.session.share}` : '';
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
