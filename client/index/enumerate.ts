import $ from 'jquery';
import * as log from '../shared/log';
import * as config from '../shared/config';
import { user } from '../shared/user';

let refreshNeeded = true;

let shares:Array<{ key: string, name: string }> = [];

async function setRefresh(refresh = true) {
  if (refresh) refreshNeeded = true;
}

// exctract top classe from classification & detection and builds sidebar menu
async function enumerateClasses(images) {
  const t0 = performance.now();
  const ignoreTags = ['name', 'ext', 'size', 'property', 'city', 'state', 'country', 'continent', 'near', 'year', 'created', 'edited'];
  $('#classes').html('');
  if (!Array.isArray(images)) images = [];
  const classesList:Array<{ tag: string, count: number }> = [];
  const namesList:Array<{ tag: string, count: number }> = [];
  let ops = 0;
  if (refreshNeeded) {
    for (const item of images) {
      let nameTagFound = false;
      for (const tag of item.tags) {
        const tags = Object.entries(tag)[0];
        if (!tags || tags.length !== 2 || ignoreTags.includes(tags[0])) continue;
        if (tags[0] === 'alias' && !nameTagFound) {
          nameTagFound = true;
          ops++;
          const name = tags[1] as string; // names array is already split
          let nameFound;
          for (let i = 0; i < namesList.length; i++) { // for loop is faster than array.find and here we're shaving some ms
            if (namesList[i].tag === name) {
              nameFound = namesList[i];
              break;
            }
          }
          if (nameFound) nameFound.count++;
          else namesList.push({ tag: name, count: 1 });
        } else {
          for (const val of (tags[1] as string).split(',')) {
            ops++;
            // const classFound = classesList.find((a) => a.tag === val);
            let classFound;
            for (let i = 0; i < classesList.length; i++) { // for loop is faster than array.find and here we're shaving some ms
              if (classesList[i].tag === val) {
                classFound = classesList[i];
                break;
              }
            }
            if (classFound) classFound.count++;
            else classesList.push({ tag: val, count: 1 });
          }
        }
      }
    }
    classesList.sort((a, b) => b.count - a.count); // sort by number of occurences
  }

  // add tags/classes
  const classesCount = classesList.length; // crop the list to top entries
  classesList.length = Math.min(config.options.topClasses, classesList.length);
  let html = '';
  for (const item of classesList) {
    const tag = item.tag.split(/ |-|,/)[0];
    html += `<li><span tag="${escape(tag)}" type="class" style="padding-left: 16px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${tag} (${item.count})</span></li>`;
  }
  $('#classes').append(html);

  namesList.sort((a, b) => b.count - a.count); // sort by number of occurences
  const namesCount = namesList.length; // crop the list to top entries
  namesList.length = Math.min(config.options.topClasses, namesCount);

  // add names
  html = '';
  $('#names').html('');
  for (const item of namesList) {
    html += `<li><span tag="${escape(item.tag)}" type="name" style="padding-left: 16px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${item.tag}</span></li>`;
  }
  $('#names').append(html);

  log.debug('Enumerated names:', namesCount);
  log.debug(t0, 'Enumerated classees: unique:', classesCount, 'total:', ops);
}

// extracts all locations from loaded images and builds sidebar menu
async function enumerateLocations(images) {
  const t0 = performance.now();
  $('#locations').html('');
  if (!Array.isArray(images)) images = [];
  let countries:Array<string> = [];
  if (refreshNeeded) {
    for (const item of images) {
      if (item && item.location.country && !countries.includes(item.location.country)) countries.push(item.location.country);
    }
    countries = countries.sort((a, b) => (a > b ? 1 : -1));
    countries.push('Unknown');
  }
  let i = 1;
  let locCount = 0;
  for (const country of countries) {
    let items = images.filter((a) => a && a.location.country === country);
    if (country === 'Unknown') items = images.filter((a) => a && a.location.country === undefined);
    let places:Array<{ name: string, sort: string }> = [];
    for (const item of items) {
      const state = item.location.state ? `, ${item.location.state}` : '';
      if ((country !== 'Unknown') && !places.find((a) => a.name === `${item.location.near}${state}`)) places.push({ name: `${item.location.near}${state}`, sort: `${state}${item.location.near}` });
    }
    let children = '';
    places = places.sort((a, b) => (a.sort > b.sort ? 1 : -1));
    locCount += places.length;
    for (const place of places) {
      children += `<li style="display: none"><span tag="${escape(place.name)}" type="location" style="padding-left: 32px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${place.name}</span></li>`;
    }
    const html = `<li id="loc-${i}"><span tag="${escape(country)}" type="location" style="padding-left: 16px" class="folder"><i class="collapsible fas fa-chevron-circle-right">&nbsp</i>${country} (${items.length})</span></li>`;
    $('#locations').append(html);
    $(`#loc-${i}`).append(children);
    i++;
  }
  log.debug(t0, 'Enumerated locations:', locCount);
}

// builds folder list from all loaded images and builds sidebar menu, can be used with entire image list or per-object
async function enumerateFolders(images) {
  const t0 = performance.now();
  $('#folders').html('');
  const root = user && user.root ? user.root : 'media/';
  const depth = root.split('/').length - 1;
  if (!Array.isArray(images)) images = [];

  let list:Array<{ path: string, folders: string[]; count: number }> = [];
  if (refreshNeeded) {
    for (const item of images) {
      if (!item) continue;
      const path = item.image.substr(0, item.image.lastIndexOf('/'));
      const folders = path.split('/').filter((a) => a !== '');
      const existing = list.find((a) => a.path === path);
      if (!existing) list.push({ path, folders, count: 1 });
      else existing.count += 1;
    }
    list = list.sort((a, b) => (a.path > b.path ? 1 : -1));
  }
  let folderCount = 0;
  for (let i = depth; i < 10; i++) {
    for (const item of list) {
      if (item.folders[i]) {
        let pathId = '';
        for (let j = depth; j <= i; j++) pathId += escape(item.folders[j]);
        let parentId = '';
        for (let j = depth; j < i; j++) parentId += escape(item.folders[j]);
        if (!document.getElementById(`dir-${pathId}`)) {
          const div = document.createElement('li');
          div.id = `dir-${pathId}`;
          if (i !== depth) div.style.display = 'none';
          let path = '';
          for (let j = 0; j <= i; j++) path += `${escape(item.folders[j])}/`;
          const count = i === item.folders.length - 1 ? `(${item.count})` : '';
          div.innerHTML = `<span tag="${path}" type="folder" style="padding-left: ${i * 16}px" class="folder"><i class="collapsible fas fa-chevron-circle-right">&nbsp</i>${item.folders[i]} ${count}</span>`;
          let parent = i === depth ? document.getElementById('folders') : document.getElementById(`dir-${parentId}`);
          if (parent?.nodeName !== 'UL') {
            let foundParent;
            for (const childNode of (parent?.childNodes || [])) {
              if (childNode.nodeName === 'UL') foundParent = childNode;
            }
            if (foundParent) {
              parent = foundParent;
            } else {
              const newParent = (parent as HTMLElement).appendChild(document.createElement('ul'));
              parent = newParent;
            }
          }
          parent?.appendChild(div);
          folderCount++;
        }
      }
    }
  }
  log.debug(t0, 'Enumerated folders:', folderCount);
}

async function enumerateNSFW(images) {
  const t0 = performance.now();
  let i = 0;
  for (const item of images) {
    let person = false;
    let nsfw = false;
    for (const detect of item.detect) {
      person = person || (detect.class === 'person');
      nsfw = nsfw || (detect.class === 'exposed breast' && detect.score > 0.52);
      if (person && nsfw) {
        i++;
        item.tags.push({ nsfw: 'nsfw' });
      }
    }
  }
  log.debug(t0, 'Enumerated NSFW:', i);
}

async function enumerateShares() {
  if (!user.admin) return shares;
  const t0 = performance.now();
  $('#shares').html('');
  const res = await fetch('/api/share/dir');
  if (res && res.ok) shares = await res.json();
  if (!shares || (shares.length < 1)) return shares;
  let html = '';
  for (const share of shares) {
    html += `<li><span tag="${share.key}" type="share" style="padding-left: 16px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${share.name}</span></li>`;
  }
  $('#shares').append(html);
  $('#shares').find('li').toggle(false);
  log.debug(t0, 'Enumerated shares:', shares.length);
  return shares;
}

let checkedShares = false;
async function getShares() {
  if (!checkedShares) {
    shares = await enumerateShares();
    checkedShares = true;
  }
  return shares;
}

async function enumerateResults(images) {
  // images = images.filter((a) => a); check for null
  const a1 = enumerateFolders(images);
  const a2 = enumerateLocations(images);
  const a3 = enumerateClasses(images);
  const a4 = enumerateNSFW(images);
  // const a6 = enumerateShares(); // enumerateShares is called explicitly so not part of general enumeration
  await Promise.all([a1, a2, a3, a4]);
  refreshNeeded = true;
}

export {
  enumerateClasses as classes,
  enumerateFolders as folders,
  enumerateLocations as locations,
  enumerateShares as shares,
  enumerateNSFW as nsfw,
  enumerateResults as enumerate,
  setRefresh as refresh,
  getShares,
};
