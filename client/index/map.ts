import $ from 'jquery';
import * as db from './indexdb';
import * as log from '../shared/log';
import * as nearest from './nearest';
import * as list from './list';
import * as config from '../shared/config';

let mapContainer;
let L;

async function find(images, lat, lon) {
  const t0 = performance.now();
  // get data
  let all;
  const sort = config.options.listSortOrder;
  if (sort.includes('alpha-down')) all = await db.all('name', true, 1, Number.MAX_SAFE_INTEGER, null, null);
  else if (sort.includes('alpha-up')) all = await db.all('name', false, 1, Number.MAX_SAFE_INTEGER, null, null);
  else if (sort.includes('numeric-down')) all = await db.all('date', false, 1, Number.MAX_SAFE_INTEGER, null, null);
  else if (sort.includes('numeric-up')) all = await db.all('date', true, 1, Number.MAX_SAFE_INTEGER, null, null);
  else if (sort.includes('amount-down')) all = await db.all('size', false, 1, Number.MAX_SAFE_INTEGER, null, null);
  else if (sort.includes('amount-up')) all = await db.all('size', true, 1, Number.MAX_SAFE_INTEGER, null, null);
  else all = await db.all('date', true, 1, Number.MAX_SAFE_INTEGER, null, null);
  // const all = await db.all();
  const points = all
    .filter((a) => (a.exif && a.exif.lat && a.exif.lon))
    .map((a) => ({ lat: a.exif.lat, lon: a.exif.lon }));
  // eslint-disable-next-line no-underscore-dangle
  const count = Math.trunc(11 - mapContainer._zoom / 2);
  const coord = nearest.find(points, lat, lon, count);
  images = all.filter((a) => {
    for (let i = 0; i < count; i++) {
      if (a.exif && a.exif.lat && a.exif.lon && a.exif.lat === coord[i].lat && a.exif.lon === coord[i].lon) return true;
    }
    return false;
  });
  log.debug(t0, `Map search: ${lat} ${lon} Found: ${coord[0].lat} ${coord[0].lon} Images: ${images.length} Level: ${count}`);
  list.redraw(images);
}

async function load() {
  return new Promise((resolve) => {
    /*
    $('<link>')
      .appendTo('head')
      .attr({
        type: 'text/css',
        rel: 'stylesheet',
        href: '/assets/mapquest.css',
      });
    */
    $.getScript('/assets/mapquest.js').done(() => {
      $.getScript('/assets/leaflet-heat.js').done(() => {
        log.debug('Loaded MapQuest');
        L = (window as any).L;
        resolve(true);
      });
    });
  });
}

export async function show(images, visible) {
  if (typeof L === 'undefined') await load();

  const t0 = performance.now();
  log.debug(t0, `Map show: ${visible}`);
  if (!visible && mapContainer) {
    mapContainer.off();
    mapContainer.remove();
    mapContainer = null;
    $('#map').toggle(false);
    return;
  }
  $('#map').toggle('slow');
  $('#map').width($('#all').width() || 0);
  $('#map').height(0.4 * ($('#main').height() || 0));
  if ($('#map').css('display') === 'none') return;
  L.mapquest.key = 'lYrP4vF3Uk5zgTiGGuEzQGwGIVDGuy24';
  mapContainer = L.mapquest.map('map', {
    center: [25.7632076, -80.1927073],
    layers: L.mapquest.tileLayer(config.theme.map),
    zoom: 3,
  });
  mapContainer.on('click', (evt) => {
    find(images, evt.latlng.lat, evt.latlng.lng);
  });
  L.mapquest.geocodingControl().addTo(mapContainer);
  $('.leaflet-bottom.leaflet-left').html(''); // hide branding
  $('.leaflet-bottom.leaflet-right').html(''); // hide branding
  const points = images
    .filter((a) => (a.exif && a.exif.lat && a.exif.lon))
    .map((a) => [a.exif.lat, a.exif.lon, 0.1]);
  const heat = { maxZoom: 15, max: 1.0, radius: 25, blur: 15, minOpacity: 0.3 };
  L.heatLayer(points, heat).addTo(mapContainer);
  log.debug(t0, `Map added ${points.length} points`);
}

// https://developer.mapquest.com/documentation/mapquest-js/v1.3/
