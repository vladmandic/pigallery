import * as log from '../shared/log';
import { user } from '../shared/user';

let db;

const database = 'pigallery';
let last:{ index: string, direction: boolean, start: number, end: number, tag: object | null, share: string | null } = { index: 'date', direction: true, start: 1, end: Number.MAX_SAFE_INTEGER, tag: null, share: null };

export async function open() {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const request = indexedDB.open(database, 1);
    request.onerror = (evt) => {
      log.div('log', true, `IndexDB request error: ${evt}`);
      resolve(false);
    };
    request.onupgradeneeded = (evt: any) => {
      log.debug(t0, 'IndexDB request create');
      db = evt.target?.result;

      const storesImage = db.createObjectStore('images', { keyPath: 'image' });
      storesImage.createIndex('name', 'image', { unique: true });
      storesImage.createIndex('date', 'timestamp', { unique: false });
      storesImage.createIndex('size', 'pixels', { unique: false });

      const storesThumbnail = db.createObjectStore('thumbnails', { keyPath: 'name' });
      storesThumbnail.createIndex('name', 'name', { unique: true });

      const storesPerson = db.createObjectStore('persons', { keyPath: 'name' });
      storesPerson.createIndex('name', 'name', { unique: true });
    };
    request.onsuccess = (evt: any) => {
      log.debug(t0, 'IndexDB request open');
      db = evt.target?.result;
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

export async function reset() {
  const t0 = performance.now();
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

export async function put(obj) {
  const thumbDetails = { name: obj.image, thumbnail: obj.thumbnail };
  const personDetails = { name: obj.image, person: obj.person };
  delete obj.thumbnail;
  delete obj.person;

  db.transaction(['images'], 'readwrite').objectStore('images').put(obj);
  db.transaction(['thumbnails'], 'readwrite').objectStore('thumbnails').put(thumbDetails);
  db.transaction(['persons'], 'readwrite').objectStore('persons').put(personDetails);
}

export async function thumbnail(name) {
  return new Promise((resolve) => {
    const request = db
      .transaction(['thumbnails'], 'readonly')
      .objectStore('thumbnails')
      .index('name')
      .get(name);
    request.onsuccess = (evt) => resolve(evt.target.result?.thumbnail);
  });
}

export async function person(name) {
  return new Promise((resolve) => {
    const request = db
      .transaction(['persons'], 'readonly')
      .objectStore('persons')
      .index('name')
      .get(name);
    request.onsuccess = (evt) => resolve(evt.target.result?.person);
  });
}

export async function getShare(share) {
  const t0 = performance.now();
  const res = await fetch(`/api/share/get?id=${share}`);
  let json = [];
  if (res.ok) json = await res.json();
  const filtered = [];
  for (const img of json) {
    if (img) filtered.push(img);
  }
  log.debug(t0, `Selected share: ${share} received:${json.length} valid:${filtered.length} invalid:${json.length - filtered.length}`);
  log.div('log', true, `Loaded ${filtered.length} images from server for share ${share}`);
  return filtered;
}

export async function all(index: string, direction: boolean, start: number, end: number, tag: object | null, share: string | null): Promise<any[]> {
  const t0 = performance.now();
  last = { index, direction, start: 1, end: Number.MAX_SAFE_INTEGER, tag, share };
  return new Promise((resolve) => {
    if (share) {
      // eslint-disable-next-line promise/catch-or-return
      getShare(share).then((res) => resolve(res));
    } else {
      const res:Array<any> = [];
      if (!user || !user.user) resolve(res);
      let idx = 0;
      const cursor = db
        .transaction(['images'], 'readwrite')
        .objectStore('images')
        .index(index)
        .openCursor(null, direction ? 'next' : 'prev');
      cursor.onerror = (evt) => log.debug('IndexDB All error:', evt);
      cursor.onabort = (evt) => log.debug('IndexDB All abort:', evt);
      cursor.oncomplete = (evt) => log.debug('IndexDB All complete:', evt);
      cursor.onsuccess = (evt) => {
        const e = evt.target.result;
        if (e) {
          if (Array.isArray(e)) {
            idx = e.length;
            log.debug(t0, `IndexDB All Get: sort by ${index} ${direction ? 'ascending' : 'descending'} ${res.length} start:${start} end:${end}`);
            resolve(e);
          } else {
            idx++;
            if ((idx >= start) && (e.value.image.startsWith(user.root))) {
              if (!tag) {
                res.push(e.value);
              } else {
                for (const val of e.value.tags) {
                  // @ts-ignore tag & value are unknown here
                  if (val[tag?.tag] === tag?.value) res.push(e.value);
                }
              }
            }
            if (idx < end) {
              e.continue();
            } else {
              log.debug(t0, `IndexDB Cursor: sort by ${index} ${direction ? 'ascending' : 'descending'} ${res.length} start:${start} end:${end}`);
              resolve(res);
            }
          }
        } else {
          log.debug(t0, `IndexDB Cursor: sort by ${index} ${direction ? 'ascending' : 'descending'} ${res.length} completed:${idx}`);
          resolve(res);
        }
      };
    }
  });
}

export async function refresh() {
  return all(last.index, last.direction, last.start, last.end, last.tag, last.share);
}

export async function count():Promise<number> {
  return new Promise((resolve) => {
    if (db) {
      const request = db.transaction(['images'], 'readwrite').objectStore('images').count();
      request.onsuccess = (evt) => resolve(evt.target.result);
    } else {
      resolve(0);
    }
  });
}

export async function store(objects) {
  for (const object of objects) {
    object.timestamp = object.exif?.created || object.exif?.modified || 0;
    put(object);
  }
}
