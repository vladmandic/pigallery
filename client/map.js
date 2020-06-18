/* global L */

let mapContainer;

async function show() {
  // $('#map').toggle('slow');
  // const div = document.getElementById('results');
  // div.html = '<div id="map" style="width: 100%; height: 100%;>map</div>';
  $('#results').html('<div id="map" style="width: 100%; height: 100%;"></div>');
  if (mapContainer) {
    mapContainer.off();
    mapContainer.remove();
  }
  L.mapquest.key = 'lYrP4vF3Uk5zgTiGGuEzQGwGIVDGuy24';
  mapContainer = L.mapquest.map('map', {
    center: [25.7632076, -80.1927073],
    layers: L.mapquest.tileLayer('map'),
    zoom: 3,
  });
  L.mapquest.geocodingControl().addTo(mapContainer);
  $('.leaflet-bottom.leaflet-left').html(''); // hide branding
  $('.leaflet-bottom.leaflet-right').html(''); // hide branding
  const points = window.filtered
    .filter((a) => (a.exif && a.exif.lat && a.exif.lon))
    .map((a) => [a.exif.lat, a.exif.lon, 0.1]);
  const heat = { maxZoom: 15, max: 1.0, radius: 25, blur: 15, minOpacity: 0.3 };
  L.heatLayer(points, heat).addTo(mapContainer);
}

exports.show = show;

// https://developer.mapquest.com/documentation/mapquest-js/v1.3/
