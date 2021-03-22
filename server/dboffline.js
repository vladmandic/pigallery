const fs = require('fs');
const nedb = require('nedb-promises');
const log = require('@vladmandic/pilogger');

const list = [
];

async function main() {
  log.header();
  const config = JSON.parse(fs.readFileSync('./config.json').toString());
  log.state('Config loaded');
  const db = nedb.create({ filename: config.server.db, inMemoryOnly: false, timestampData: true, autoload: false });
  await db.ensureIndex({ fieldName: 'image', unique: true, sparse: true });
  await db.ensureIndex({ fieldName: 'processed', unique: false, sparse: false });
  await db.load();
  const records = await db.count({});
  log.state('Image DB loaded:', config.server.db, 'records:', records);
  for (const f of list) {
    const data = await db.find({ image: f });
    if (data && data[0]) {
      log.data('Record:', f, 'data:', data[0].processed);
      await db.remove({ image: f }, { multi: true });
    } else {
      log.warn('Record not found:', f);
    }
  }
}

main();
