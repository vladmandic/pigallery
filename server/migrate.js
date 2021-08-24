/*
  migrate existing nedb database to mongodb database

  notes:
    - safe to run multiple times as it will update existing records in mongodb
    - for large nedb database, increase nodejs stack and heap sizes
      node --stack-size=8192 --max-old-space-size=8192 --optimize-for-size server/migrate.js
    - flags for running lightweight mongodb on localhost
      /bin/mongod --quiet --bind_ip 127.0.0.1 --wiredTigerCacheSizeGB 0.4 --noauth --tlsMode disabled --logappend --dbpath /home/vlado/dev/pigallery/data
*/

const fs = require('fs');
const MongoClient = require("mongodb").MongoClient;
const nedb = require('nedb-promises');
const log = require('@vladmandic/pilogger');

const options = {
  mongoURI: 'mongodb://127.0.0.1:27017',
  mongoDB: 'pigallery',
  mongoOptions: { monitorCommands:true, directConnection: true, connectTimeoutMS: 10000, socketTimeoutMS: 10000 },
  neDB: 'pigallery.db',
}

async function main() {
  log.header();

  // connect to mongodb instance
  const client = new MongoClient(options.mongoURI, options.mongoOptions);
  log.state('mongodb client:', client['s'].options.hosts[0]);
  log.info('mongodb driver:', client['s'].options.metadata.driver);
  client.on('commandFailed', (event) => log.warn('mongodb command:', event.commandName, event.failure));
  client.on('serverOpening', () => log.state('mongodb server connection opening'));
  client.on('serverClosed', () => log.state('mongodb server connection closed'));
  try {
    await client.connect();
  } catch (err) {
    log.error('mongodb:', err.errmsg || err);
  }
  const state = client['topology'].s.state;
  log.state('mongodb state:', state);
  if (state === 'closed') process.exit(1);

  // init mongodb database
  const database = client.db(options.mongoDB);
  const images = database.collection('images');
  const shares = database.collection('shares');
  await images.createIndex({ 'image': 1 });
  await images.createIndex({ 'processed': 1 });

  // mongodb state before migration
  log.info('mongodb image documents:', await images.countDocuments());
  log.info('mongodb share documents:', await shares.countDocuments());

  // init nedb
  if (!fs.existsSync(options.neDB)) {
    log.error('nedb missing:', options.neDB);
    process.exit(1);
  }
  const stat = fs.statSync(options.neDB);
  if (!stat.isFile && stat.size === 0) {
    log.error('nedb is not a valid file:', options.neDB);
    process.exit(1);
  }
  log.info('nedb size:', stat.size);
  let db = await nedb.create({ filename: options.neDB, inMemoryOnly: false, timestampData: true, autoload: false });
  db.persistence.setAutocompactionInterval(24 * 60 * 60 * 1000); // skip auto-compact
  await db.load();
  log.state('nedb loaded:', options.neDB);
  log.info('nedb records:', await db.count({}));

  // migrate
  log.state('migrating nedb to mongodb');
  const records = await db.find({});
  for (let i = 0; i < records.length; i++) {
    if (i % 50 === 0) process.stdout.write('.');
    if (records[i].image) images.replaceOne({ image: records[i].image }, records[i], { upsert: true });
    else if (records[i].share) shares.replaceOne({ share: records[i].share }, records[i], { upsert: true });
  }
  process.stdout.write('\n');
  db = await nedb.create({ inMemoryOnly: true, timestampData: true, autoload: false }); // unload database
  log.state('nedb unloaded')

  // compact
  log.state('mongodb compacting...')
  database.command({ compact: 'images' });
  database.command({ compact: 'shares' });

  // finish
  log.info('mongodb image documents:', await images.countDocuments());
  log.info('mongodb share documents:', await shares.countDocuments());
  await client.close();
  process.exit();
}

main();
