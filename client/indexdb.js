const log = require('./log.js');

let db;
let id = 0;

const database = 'pigallery';
const table = 'images';

async function open() {
  const t0 = window.performance.now();
  return new Promise((resolve) => {
    const request = indexedDB.open(database, 1);
    request.onerror = (evt) => {
      log.result(`IndexDB request error: ${evt}`);
      resolve(false);
    };
    request.onupgradeneeded = (evt) => {
      log.debug(t0, 'IndexDB request create');
      db = evt.target.result;
      const tbl = db.createObjectStore(table, { keyPath: 'image' });
      tbl.createIndex('name', 'image', { unique: true });
      tbl.createIndex('date', 'exif.created', { unique: false });
      tbl.createIndex('size', 'pixels', { unique: false });
    };
    request.onsuccess = (evt) => {
      log.debug(t0, 'IndexDB request open');
      db = evt.target.result;
      db.onerror = (event) => log.result(`IndexDB DB error: ${event}`);
      db.onsuccess = (event) => log.result(`IndexDB DB open: ${event}`);
      db.onblocked = (event) => log.result(`IndexDB DB blocked: ${event}`);
      resolve(true);
    };
    request.onblocked = () => {
      log.debug(t0, 'IndexDB request open blocked');
    };
  });
}

async function reset() {
  const t0 = window.performance.now();
  return new Promise((resolve) => {
    log.debug(t0, 'IndexDB reset');
    if (db) db.close();
    const request = indexedDB.deleteDatabase('pigallery');
    request.onsuccess = () => {
      log.debug(t0, 'IndexDB delete success');
      resolve(true);
    };
    request.onerror = () => {
      log.debug(t0, 'IndexDB delete error');
      resolve(false);
    };
    request.onblocked = () => {
      log.debug(t0, 'IndexDB delete blocked');
      resolve(false);
    };
  });
}

async function put(obj) {
  obj.id = id++;
  db.transaction([table], 'readwrite')
    .objectStore(table)
    .put(obj);
}

async function get(name) {
  db.transaction([table], 'readonly')
    .objectStore(table)
    .get(name)
    .onsuccess = (evt) => evt.target.result;
}

async function all(index = 'date', direction = true, start = 1, end = Number.MAX_SAFE_INTEGER) {
  const t0 = window.performance.now();
  return new Promise((resolve) => {
    const res = [];
    if (!window.user || !window.user.user) resolve(res);
    let idx = 0;
    db.transaction([table], 'readonly')
      .objectStore(table)
      .index(index)
      .openCursor(null, direction ? 'next' : 'prev')
      .onsuccess = (evt) => {
        if (evt.target.result) {
          idx++;
          const obj = evt.target.result.value;
          if ((idx >= start) && (obj.image.startsWith(window.user.root))) res.push(obj);
          if (idx < end) evt.target.result.continue();
          else {
            log.debug(t0, `IndexDB All: sort by ${index} ${direction ? 'ascending' : 'descending'} ${res.length} images ${start}-${end}`);
            resolve(res);
          }
        } else {
          log.debug(t0, `IndexDB All: sort by ${index} ${direction ? 'ascending' : 'descending'} ${res.length} images`);
          resolve(res);
        }
      };
  });
}

async function count() {
  return new Promise((resolve) => {
    db.transaction([table], 'readonly')
      .objectStore(table)
      .count()
      .onsuccess = (evt) => resolve(evt.target.result);
  });
}

async function store(objects) {
  for (const obj of objects) {
    if (!obj.exif) obj.exif = {};
    if (!obj.exif.created) obj.exif.created = 0;
    put(obj);
  }
}

async function test() {
  await open();
  log.result(`IndexDB count on open ${await count()} records`);
  await reset();
  log.result(`IndexDB count on reset ${await count()} records`);
  for (const result of window.results) put(result);
  const t0 = window.performance.now();
  log.result(`IndexDB count on put ${await count()} records`);
  const t1 = window.performance.now();
  log.debug(t0, `IndexDB insert ${window.results.length} records`);
  window.results = await all();
  log.debug(t1, `IndexDB retrieve ${window.results.length} records`);
}

exports.open = open; // open database
exports.reset = reset; // delete all records
exports.put = put; // store one record
exports.get = get; // get one record
exports.count = count; // get record count
exports.store = store; // store all records
exports.all = all; // get all records
exports.test = test; // test function
