const log = require('./log.js');

// exctract top classe from classification & detection and builds sidebar menu
async function enumerateClasses() {
  const t0 = window.performance.now();
  $('#classes').html('');
  if (!Array.isArray(window.filtered)) window.filtered = [];
  const classesList = [];
  for (const item of window.filtered) {
    for (const tag of item.tags) {
      if (Object.keys(tag).length === 0) continue;
      const key = Object.keys(tag)[0];
      if (['name', 'ext', 'size', 'property', 'city', 'state', 'country', 'continent', 'near', 'year', 'created', 'edited'].includes(key)) continue;
      const val = Object.values(tag)[0].toString().split(',')[0];
      const found = classesList.find((a) => a.tag === val);
      if (found) found.count += 1;
      else classesList.push({ tag: val, count: 1 });
    }
  }
  classesList.sort((a, b) => b.count - a.count);
  const classesCount = classesList.length;
  classesList.length = Math.min(window.options.topClasses, classesList.length);
  let html = '';
  for (const item of classesList) {
    const tag = item.tag.split(/ |-|,/)[0];
    html += `<li><span tag="${escape(tag)}" type="class" style="padding-left: 16px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${tag} (${item.count})</span></li>`;
  }
  $('#classes').append(html);
  log.debug(t0, `Enumerated classees: ${classesCount}`);
}

// extracts all locations from loaded images and builds sidebar menu
async function enumerateLocations() {
  const t0 = window.performance.now();
  $('#locations').html('');
  if (!Array.isArray(window.filtered)) window.filtered = [];
  let countries = [];
  for (const item of window.filtered) {
    if (item.location.country && !countries.includes(item.location.country)) countries.push(item.location.country);
  }
  countries = countries.sort((a, b) => (a > b ? 1 : -1));
  countries.push('Unknown');
  let i = 1;
  let locCount = 0;
  for (const country of countries) {
    let items = window.filtered.filter((a) => a.location.country === country);
    if (country === 'Unknown') items = window.filtered.filter((a) => a.location.country === undefined);
    let places = [];
    for (const item of items) {
      const state = item.location.state ? `, ${item.location.state}` : '';
      if ((country !== 'Unknown') && !places.find((a) => a.name === `${item.location.near}${state}`)) places.push({ name: `${item.location.near}${state}`, sort: `${state}${item.location.near}` });
    }
    let children = '';
    places = places.sort((a, b) => (a.sort > b.sort ? 1 : -1));
    locCount += places.length;
    for (const place of places) {
      children += `<li><span tag="${escape(place.name)}" type="location" style="padding-left: 32px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${place.name}</span></li>`;
    }
    const html = `<li id="loc-${i}"><span tag="${escape(country)}" type="location" style="padding-left: 16px" class="folder"><i class="collapsible fas fa-chevron-circle-right">&nbsp</i>${country} (${items.length})</span></li>`;
    $('#locations').append(html);
    $(`#loc-${i}`).append(children);
    i++;
  }
  log.debug(t0, `Enumerated locations: ${locCount}`);
}

// builds folder list from all loaded images and builds sidebar menu, can be used with entire image list or per-object
async function enumerateFolders() {
  const t0 = window.performance.now();
  $('#folders').html('');
  const root = window.user && window.user.root ? window.user.root : 'media/';
  const depth = root.split('/').length - 1;
  if (!Array.isArray(window.filtered)) window.filtered = [];

  let list = [];
  for (const item of window.filtered) {
    const path = item.image.substr(0, item.image.lastIndexOf('/'));
    const folders = path.split('/').filter((a) => a !== '');
    const existing = list.find((a) => a.path === path);
    if (!existing) list.push({ path, folders, count: 1 });
    else existing.count += 1;
  }
  list = list.sort((a, b) => (a.path > b.path ? 1 : -1));
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
          let path = '';
          for (let j = 0; j <= i; j++) path += `${escape(item.folders[j])}/`;
          const count = i === item.folders.length - 1 ? `(${item.count})` : '';
          div.innerHTML = `<span tag="${path}" type="folder" style="padding-left: ${i * 16}px" class="folder"><i class="collapsible fas fa-chevron-circle-right">&nbsp</i>${item.folders[i]} ${count}</span>`;
          if (i === depth) document.getElementById('folders').appendChild(div);
          else document.getElementById(`dir-${parentId}`).appendChild(div);
          folderCount++;
        }
      }
    }
  }
  log.debug(t0, `Enumerated folders: ${folderCount}`);
}

async function enumerateShares() {
  const t0 = window.performance.now();
  $('#shares').html('');
  window.shares = [];
  const shares = await fetch('/api/shares');
  if (shares.ok) window.shares = await shares.json();
  if (!window.shares || (window.shares.length < 1)) return;
  let html = '';
  for (const share of window.shares) {
    html += `<li><span tag="${share.key}" type="share" style="padding-left: 16px" class="folder"><i class="fas fa-chevron-circle-right">&nbsp</i>${share.name}</span></li>`;
  }
  $('#shares').append(html);
  $('#shares').find('li').toggle(false);
  log.debug(t0, `Enumerated shares: ${window.shares.length}`);
}

async function enumerateResults() {
  const a1 = enumerateFolders();
  const a2 = enumerateLocations();
  const a3 = enumerateClasses();
  // const a4 = enumerateShares();
  await Promise.all([a1, a2, a3]);
}

exports.classes = enumerateClasses;
exports.folders = enumerateFolders;
exports.locations = enumerateLocations;
exports.enumerate = enumerateResults;
exports.shares = enumerateShares;
