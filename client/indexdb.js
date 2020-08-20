const log = require('./log.js');

let db;
let id = 0;

const database = 'pigallery';
const table = 'images';

async function open() {
  if (window.share) return null;
  const t0 = window.performance.now();
  return new Promise((resolve) => {
    const request = indexedDB.open(database, 1);
    request.onerror = (evt) => {
      log.div('log', true, `IndexDB request error: ${evt}`);
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
      db.onerror = (event) => log.div('log', true, `IndexDB DB error: ${event}`);
      db.onsuccess = (event) => log.div('log', true, `IndexDB DB open: ${event}`);
      db.onblocked = (event) => log.div('log', true, `IndexDB DB blocked: ${event}`);
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

async function share() {
  const t0 = window.performance.now();
  const res = await fetch(`/api/share?id=${window.share}`);
  let json = {};
  if (res.ok) json = await res.json();
  log.debug(t0, `Selected share: ${window.share} received ${json.length} images`);
  log.div('log', true, `Loaded ${window.filtered.length} images from server for share ${window.share}`);
  return json;
}

async function all(index = 'date', direction = true, start = 1, end = Number.MAX_SAFE_INTEGER) {
  const t0 = window.performance.now();
  return new Promise((resolve) => {
    if (window.share) {
      let res;
      if (start === 1) res = share();
      else res = [];
      resolve(res);
    } else {
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
    }
  });
}

async function count() {
  if (window.share) return Number.MAX_SAFE_INTEGER;
  return new Promise((resolve) => {
    db.transaction([table], 'readonly')
      .objectStore(table)
      .count()
      .onsuccess = (evt) => resolve(evt.target.result);
  });
}

async function store(objects) {
  for (const i in objects) {
    if (!objects[i].exif) objects[i].exif = {};
    if (!objects[i].exif.created) objects[i].exif.created = 0;
    put(objects[i]);
  }
}

async function test() {
  await open();
  log.div('log', true, `IndexDB count on open ${await count()} records`);
  await reset();
  log.div('log', true, `IndexDB count on reset ${await count()} records`);
  for (const result of window.results) put(result);
  const t0 = window.performance.now();
  log.div('log', true, `IndexDB count on put ${await count()} records`);
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
