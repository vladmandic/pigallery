const log = require('./log.js');

let db;
let id = 0;

async function open() {
  return new Promise((resolve) => {
    const request = indexedDB.open('pigallery', 1);
    request.onerror = (evt) => {
      log.result(`IndexDB request error: ${evt}`);
      resolve(false);
    };
    request.onupgradeneeded = (evt) => {
      if (window.debug) log.result('IndexDB request create');
      const table = evt.target.result.createObjectStore('images', { keyPath: 'image' });
      table.createIndex('name', 'image', { unique: true });
      table.createIndex('date', 'exif.created', { unique: false });
      table.createIndex('size', 'pixels', { unique: false });
    };
    request.onsuccess = (evt) => {
      if (window.debug) log.result('IndexDB request open');
      db = evt.target.result;
      db.onerror = (event) => log.result(`IndexDB DB error: ${event}`);
      db.onsuccess = (event) => log.result(`IndexDB DB open: ${event}`);
      // transaction = db.transaction(['images'], 'readwrite');
      // transaction.onerror = (event) => log.result(`IndexDB transaction error: ${event}`);
      resolve(true);
    };
  });
}

async function reset() {
  return new Promise((resolve) => {
    const transaction = db.transaction(['images'], 'readwrite');
    transaction
      .objectStore('images')
      .clear()
      .onsuccess = (evt) => evt.target.result;
    if (window.debug) log.result('IndexDB clear');
    resolve(true);
  });
}

async function put(obj) {
  obj.id = id++;
  db.transaction(['images'], 'readwrite')
    .objectStore('images')
    .put(obj);
}

async function get(name) {
  db.transaction(['images'], 'readonly')
    .objectStore('images')
    .get(name)
    .onsuccess = (evt) => evt.target.result;
}

async function all(index, direction = true) {
  if (window.debug) log.result(`IndexDB all: ${index} ${direction}`);
  return new Promise((resolve) => {
    if (!index) {
      db.transaction(['images'], 'readonly')
        .objectStore('images')
        .getAll()
        .onsuccess = (evt) => resolve(evt.target.result);
    } else {
      const res = [];
      db.transaction(['images'], 'readonly')
        .objectStore('images')
        .index(index)
        .openCursor(null, direction ? 'next' : 'prev')
        .onsuccess = (evt) => {
          if (evt.target.result) {
            res.push(evt.target.result.value);
            evt.target.result.continue();
          } else {
            resolve(res);
          }
        };
    }
  });
}

async function count() {
  return new Promise((resolve) => {
    db.transaction(['images'], 'readwrite')
      .objectStore('images')
      .count()
      .onsuccess = (evt) => resolve(evt.target.result);
  });
}

async function store(objects) {
  for (const obj of objects) put(obj);
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
