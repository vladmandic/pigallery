const fs = require('fs');
const zlib = require('zlib');
const log = require('@vladmandic/pilogger');
const nedb = require('nedb-promises');
const mongodb = require('mongodb');

let db;

async function createNeDBBackup(src) {
  const dt = new Date();
  // const ts = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}.${dt.getMilliseconds().toString().padStart(3, '0')}`;
  const ts = (dt.getFullYear().toString() + '-')
    + (dt.getMonth() + 1).toString().padStart(2, '0')
    + '-'
    + (dt.getDate().toString().padStart(2, '0'));
    // + '-'
    // + (dt.getHours().toString().padStart(2, '0')) + '-'
    // + (dt.getMinutes().toString().padStart(2, '0'));
  const tgt = `backup/${src}-${ts}.gz`;
  if (fs.existsSync(tgt)) {
    log.state('Image DB backup exists:', tgt);
    return true;
  }
  // fs.copyFileSync(src, tgt);
  const compress = zlib.createGzip();
  const input = fs.createReadStream(src);
  const output = fs.createWriteStream(tgt);
  fs.openSync(tgt, 'w', null);
  return new Promise((resolve) => {
    log.state('Image DB backup start:', src, 'size:', fs.statSync(src).size);
    output.on('close', () => {
      log.state('Image DB backup complete:', tgt, 'size:', fs.statSync(tgt).size);
      resolve(true);
    });
    input.pipe(compress).pipe(output);
  });
}

async function init(config) {
  if (config.server.db === 'nedb') {
    // create image db backup
    if (!fs.existsSync(config.server.nedb)) log.warn('Image cache not found:', config.server.nedb);
    else await createNeDBBackup(config.server.nedb);

    db = await nedb.create({ filename: config.server.nedb, inMemoryOnly: false, timestampData: true, autoload: false });
    await db.ensureIndex({ fieldName: 'image', unique: true, sparse: true });
    await db.ensureIndex({ fieldName: 'processed', unique: false, sparse: false });
    await db.load();
    const records = await db.count({});
    log.state('Image DB loaded:', config.server.nedb, 'records:', records);

    const shares = await db.find({ images: { $exists: true } });
    for (const share of shares) {
      log.state('Shares:', share.name, 'creator:', share.creator, 'key:', share.share, 'images:', share.images.length);
    }
  } else if (config.server.db === 'mongodb') {
    // connect to mongodb instance
    const client = new mongodb.MongoClient(config.server.mongoURI, config.server.mongoOptions);
    log.info('MongoDB Client:', client['s'].options.hosts[0]);
    log.info('MongoDB Driver:', client['s'].options.metadata.driver);
    client.on('commandFailed', (event) => log.warn('MongoDB command:', event.commandName, event.failure));
    client.on('serverOpening', () => log.state('MongoDB server connection opening'));
    client.on('serverClosed', () => log.state('MongoDB server connection closed'));
    try {
      await client.connect();
    } catch (err) {
      log.error('MongoDB:', err.errmsg || err);
    }
    const state = client['topology'].s.state;
    log.state('MongoDB State:', state);
    if (state === 'closed') process.exit(1);
    // init mongodb database
    const database = client.db(config.server.mongoDB);
    db = database.collection('data');
    await db.createIndex({ image: 1 });
    await db.createIndex({ processed: 1 });

    log.info('Image DB loaded:', await db.countDocuments());

    // TODO
    // const shares = await db.find({ images: { $exists: true } });
    // for (const share of shares) {
    //  log.state('Shares:', share.name, 'creator:', share.creator, 'key:', share.share, 'images:', share.images.length);
    // }
  } else {
    log.error('Database engine not recognized:', config.server.db);
  }
  return db;
}

exports.init = init;
