/* global L */

const db = require('./indexdb.js');
const log = require('./log.js');
const nearest = require('./nearest.js');
const list = require('./list.js');

let mapContainer;

async function find(lat, lon) {
  const t0 = window.performance.now();
  // get data
  let all;
  const sort = window.options.listSortOrder;
  if (sort.includes('alpha-down')) all = await db.all('name', true);
  else if (sort.includes('alpha-up')) all = await db.all('name', false);
  else if (sort.includes('numeric-down')) all = await db.all('date', false);
  else if (sort.includes('numeric-up')) all = await db.all('date', true);
  else if (sort.includes('amount-down')) all = await db.all('size', false);
  else if (sort.includes('amount-up')) all = await db.all('size', true);
  else all = db.all();
  // const all = await db.all();
  const points = all
    .filter((a) => (a.exif && a.exif.lat && a.exif.lon))
    .map((a) => ({ lat: a.exif.lat, lon: a.exif.lon }));
  const count = Math.trunc(11 - mapContainer._zoom / 2);
  const coord = nearest.find(points, lat, lon, count);
  window.filtered = all.filter((a) => {
    for (let i = 0; i < count; i++) {
      if (a.exif && a.exif.lat && a.exif.lon && a.exif.lat === coord[i].lat && a.exif.lon === coord[i].lon) return true;
    }
    return false;
  });
  log.debug(t0, `Map search: ${lat} ${lon} Found: ${coord[0].lat} ${coord[0].lon} Images: ${window.filtered.length} Level: ${count}`);
  list.redraw();
}

async function load() {
  log.debug('Loading MapQuest');
  return new Promise((resolve) => {
    $('<link>')
      .appendTo('head')
      .attr({
        type: 'text/css',
        rel: 'stylesheet',
        href: '/assets/mapquest.css',
      });
    $.getScript('/assets/mapquest.js').done(() => {
      $.getScript('/assets/leaflet-heat.js').done(() => resolve());
    });
  });
}

async function show(visible) {
  if (typeof L === 'undefined') await load();
  const t0 = window.performance.now();
  log.debug(t0, `Map show: ${visible}`);
  if (!visible && mapContainer) {
    mapContainer.off();
    mapContainer.remove();
    mapContainer = null;
    $('#map').toggle(false);
    return;
  }
  $('#map').toggle('slow');
  $('#map').width($('#all').width());
  $('#map').height(0.4 * $('#main').height());
  if ($('#map').css('display') === 'none') return;
  L.mapquest.key = 'lYrP4vF3Uk5zgTiGGuEzQGwGIVDGuy24';
  mapContainer = L.mapquest.map('map', {
    center: [25.7632076, -80.1927073],
    layers: L.mapquest.tileLayer(window.theme.map),
    zoom: 3,
  });
  mapContainer.on('click', (evt) => {
    find(evt.latlng.lat, evt.latlng.lng);
  });
  L.mapquest.geocodingControl().addTo(mapContainer);
  $('.leaflet-bottom.leaflet-left').html(''); // hide branding
  $('.leaflet-bottom.leaflet-right').html(''); // hide branding
  const points = window.filtered
    .filter((a) => (a.exif && a.exif.lat && a.exif.lon))
    .map((a) => [a.exif.lat, a.exif.lon, 0.1]);
  const heat = { maxZoom: 15, max: 1.0, radius: 25, blur: 15, minOpacity: 0.3 };
  L.heatLayer(points, heat).addTo(mapContainer);
  log.debug(t0, `Map added ${points.length} points`);
}

exports.show = show;

// https://developer.mapquest.com/documentation/mapquest-js/v1.3/
