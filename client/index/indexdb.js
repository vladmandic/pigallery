import * as log from '../shared/log.js';

let db;
let id = 0;

const database = 'pigallery';
const table = 'images';
let last = { index: 'date', direction: true, start: 1, end: Number.MAX_SAFE_INTEGER };

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
      window.db = db;
      db.onerror = (event) => log.div('log', true, 'IndexDB DB error:', event.target.error || event);
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
  const res = await fetch(`/api/share/get?id=${window.share}`);
  let json = {};
  if (res.ok) json = await res.json();
  const filtered = [];
  for (const img of json) {
    if (img) filtered.push(img);
  }
  log.debug(t0, `Selected share: ${window.share} received:${json.length} valid:${filtered.length} invalid:${json.length - filtered.length}`);
  log.div('log', true, `Loaded ${filtered.length} images from server for share ${window.share}`);
  return filtered;
}

async function all(index = 'date', direction = true, start = 1, end = Number.MAX_SAFE_INTEGER, tag = null) {
  const t0 = window.performance.now();
  last = { index, direction, start: 1, end: Number.MAX_SAFE_INTEGER };
  return new Promise((resolve) => {
    if (window.share) {
      const res = share();
      resolve(res);
    } else {
      const res = [];
      if (!window.user || !window.user.user) resolve(res);
      let idx = 0;
      const transaction = db.transaction([table], 'readonly')
        .objectStore(table)
        .index(index)
        .openCursor(null, direction ? 'next' : 'prev');
      transaction.onerror = (evt) => log.debug('IndexDB All error:', evt);
      transaction.onabort = (evt) => log.debug('IndexDB All abort:', evt);
      transaction.oncomplete = (evt) => log.debug('IndexDB All complete:', evt);
      transaction.onsuccess = (evt) => {
        const e = evt.target.result;
        if (e) {
          idx++;
          if ((idx >= start) && (e.value.image.startsWith(window.user.root))) {
            if (!tag) {
              res.push(e.value);
            } else {
              for (const val of e.value.tags) {
                if (val[tag.tag] === tag.value) res.push(e.value);
              }
            }
          }
          if (idx < end) e.continue();
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

async function refresh() {
  return all(last.index, last.direction, last.start, last.end);
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
exports.refresh = refresh; // get all records in the same manner as the last call to all
exports.test = test; // test function
