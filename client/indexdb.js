const log = require('./log.js');

let db;
let id = 0;

const database = 'pigallery';
const table = 'images';

async function open() {
  return new Promise((resolve) => {
    const request = indexedDB.open(database, 1);
    request.onerror = (evt) => {
      log.result(`IndexDB request error: ${evt}`);
      resolve(false);
    };
    request.onupgradeneeded = (evt) => {
      if (window.debug) log.result('IndexDB request create');
      db = evt.target.result;
      const tbl = db.createObjectStore(table, { keyPath: 'image' });
      tbl.createIndex('name', 'image', { unique: true });
      tbl.createIndex('date', 'exif.created', { unique: false });
      tbl.createIndex('size', 'pixels', { unique: false });
    };
    request.onsuccess = (evt) => {
      if (window.debug) log.result('IndexDB request open');
      db = evt.target.result;
      db.onerror = (event) => log.result(`IndexDB DB error: ${event}`);
      db.onsuccess = (event) => log.result(`IndexDB DB open: ${event}`);
      resolve(true);
    };
  });
}

async function reset() {
  return new Promise((resolve) => {
    if (window.debug) log.result('IndexDB reset');
    if (db) db.close();
    const request = indexedDB.deleteDatabase('pigallery');
    request.onsuccess = () => {
      if (window.debug) log.result('IndexDB delete success');
      resolve(true);
    };
    request.onerror = () => {
      if (window.debug) log.result('IndexDB delete error');
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

async function all(index, direction = true) {
  return new Promise((resolve) => {
    if (!index) {
      db.transaction([table], 'readonly')
        .objectStore(table)
        .getAll()
        .onsuccess = (evt) => {
          const res = evt.target.result;
          if (window.debug) log.result(`IndexDB All: all ${direction} ${res.length}`);
          resolve(res);
        };
    } else {
      const res = [];
      db.transaction([table], 'readonly')
        .objectStore(table)
        .index(index)
        .openCursor(null, direction ? 'next' : 'prev')
        .onsuccess = (evt) => {
          if (evt.target.result) {
            res.push(evt.target.result.value);
            evt.target.result.continue();
          } else {
            if (window.debug) log.result(`IndexDB All: ${index} ${direction} ${res.length}`);
            resolve(res);
          }
        };
    }
  });
}

async function count() {
  return new Promise((resolve) => {
    db.transaction([table], 'readwrite')
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
  log.result(`IndexDB insert ${window.results.length} records in ${(t1 - t0).toLocaleString()} ms`);
  window.results = await all();
  const t2 = window.performance.now();
  log.result(`IndexDB retrieve ${window.results.length} records in ${(t2 - t1).toLocaleString()} ms`);
}

exports.open = open; // open database
exports.reset = reset; // delete all records
exports.put = put; // store one record
exports.get = get; // get one record
exports.count = count; // get record count
exports.store = store; // store all records
exports.all = all; // get all records
exports.test = test; // test function
