const moment = require('moment');
const details = require('./details.js');
const log = require('./log.js');

function busy(working) {
  $('body').css('cursor', working ? 'wait' : 'default');
  $('main').css('cursor', working ? 'wait' : 'default');
  $('#btn-number').css('color', working ? 'lightcoral' : 'var(--fg)');
  $('#btn-number').toggleClass('fa-images fa-clock');
  $('#number').css('color', working ? 'gray' : 'var(--fg)');
}

// adds dividiers to list view based on sort order
let previous;
function addDividers(object) {
  if (!window.options.listTitle) return '';
  let divider;
  if (window.options.listDivider === 'simmilarity' && object.simmilarity) {
    const curr = `${100 - object.simmilarity}%`;
    const prev = previous ? `${100 - previous.simmilarity}%` : 'none';
    if (curr !== prev) divider = curr;
  }
  if (window.options.listDivider === 'month') {
    const curr = (object && object.exif.created && (object.exif.created !== 0)) ? moment(object.exif.created).format(window.options.dateDivider) : 'Date unknown';
    const prev = (previous && previous.exif.created && (previous.exif.created !== 0)) ? moment(previous.exif.created).format(window.options.dateDivider) : 'Date unknown';
    if (curr !== prev) divider = curr;
  }
  if (window.options.listDivider === 'size') {
    const curr = Math.round(object.pixels / 1000 / 1000);
    const prev = Math.round((previous ? previous.pixels : 1) / 1000 / 1000);
    if (curr !== prev) divider = curr;
  }
  if (window.options.listDivider === 'folder') {
    const curr = object.image.substr(0, object.image.lastIndexOf('/'));
    const prev = previous ? previous.image.substr(0, previous.image.lastIndexOf('/')) : 'none';
    if (curr !== prev) divider = curr;
  }
  let div;
  if (divider) {
    div = document.createElement('div');
    div.className = 'row divider';
    div.innerText = divider;
  }
  return div;
}

// print results element with thumbnail and description for a given object
function printResult(object) {
  previous = object;

  let classified = 'Classified';
  for (const item of details.combine(object.classify)) {
    classified += ` | ${item.score}% ${item.name}`;
  }

  let detected = 'Detected';
  let personCount = 0;
  for (const item of details.combine(object.detect)) {
    if (item.name !== 'person') detected += ` | ${item.score}% ${item.name}`;
    else personCount++;
  }
  personCount = Math.max(personCount, object.person ? object.person.length : 0);
  if (personCount === 1) detected += ' | person';
  else if (personCount > 1) detected += ` | ${personCount} persons`;

  let person = '';
  if (object.person && object.person[0]) {
    person = 'People';
    for (const i of object.person) {
      person += ` | ${i.gender} ${i.age.toFixed(0)}`;
    }
  }

  let location = '';
  if (object.location && object.location.city) {
    location = `Location | ${object.location.city}, ${object.location.state} ${object.location.country} (near ${object.location.near})`;
  }

  const camera = (object.exif && object.exif.make) ? `Camera | ${object.exif.make || ''} ${object.exif.model || ''} ${object.exif.lens || ''}` : '';
  const settings = (object.exif && object.exif.iso) ? `Settings | ${object.exif.fov ? object.exif.fov + 'mm' : ''} ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec` : '';
  const timestamp = object.exif.created ? moment(object.exif.created).format(window.options.dateShort) : 'Date unknown';
  const root = window.user && window.user.root ? window.user.root : 'media/';

  const thumb = document.createElement('div');
  thumb.className = 'col thumbnail';
  thumb.id = object.id;
  const square = window.options.listThumbSquare ? `width=${window.options.listThumbSize}px` : '';
  thumb.innerHTML = `
    <img class="thumbnail" id="thumb-${object.id}" img="${object.image}" src="${object.thumbnail}" onclick="details.show('${escape(object.image)}');"
    align="middle" ${square} height=${window.options.listThumbSize}px>
    <div class="thumb-top">
      <p class="btn-tiny fa fa-play-circle" onclick="details.show('${escape(object.image)}');" title="View image details"></p>
      <a class="btn-tiny fa fa-arrow-alt-circle-down" href="${object.image}" download title="Download image"></a>
    </div>
    <div class="thumb-bottom">
      <p class="btn-tiny fab fa-gg-circle" onclick="simmilarClasses('${escape(object.image)}');" title="Find images with simmilar classes"></p>
      <p class="btn-tiny fa fa-adjust" onclick="simmilarImage('${escape(object.image)}');" title="Find with simmilar features"></p>
      <p class="btn-tiny fa fa-user-circle" onclick="simmilarPerson('${escape(object.image)}');" title="Find images with simmilar faces"></p>
    </div>
  `;

  const desc = document.createElement('div');
  desc.className = 'col description';
  desc.id = object.id;
  desc.style = `display: ${window.options.listDetails ? 'block' : 'hidden'}`;
  desc.innerHTML = `
    <p class="listtitle">${decodeURI(object.image).replace(root, '')}</p>
    ${timestamp} | Size ${object.naturalSize.width} x ${object.naturalSize.height}<br>
    ${location}<br>
    ${classified}<br>
    ${detected}<br>
    ${person}<br>
    ${camera}<br>
    ${settings}<br>
  `;

  const div = document.createElement('div');
  div.className = 'listitem';
  div.style = `min-height: ${16 + window.options.listThumbSize}px; max-height: ${16 + window.options.listThumbSize}px`;
  div.appendChild(thumb);
  div.appendChild(desc);
  return div;
}

// adds items to gallery view on scroll event - infinite scroll
let current = 0;
async function scrollResults() {
  const scrollHeight = $('#results').prop('scrollHeight');
  const bottom = $('#results').scrollTop() + $('#all').height();
  if (((bottom + 16) >= scrollHeight) && (current < window.filtered.length)) {
    const t0 = window.performance.now();
    const res = document.getElementById('results');
    const count = Math.min(window.options.listItemCount, window.filtered.length - current);
    let i = current;
    while (i < (current + count)) {
      const divider = addDividers(window.filtered[i]);
      const item = printResult(window.filtered[i]);
      if (divider) res.appendChild(divider);
      res.appendChild(item);
      i++;
    }
    current = i;
    log.debug(t0, `Results scroll: added: ${count} current: ${current} total: ${window.filtered.length}`);
  }
  document.getElementById('number').innerText = `${(parseInt(current - 1, 10) + 1)}/${window.filtered.length || 0}`;
  $('.listitem').mouseenter((evt) => $(evt.target).find('.btn-tiny').toggle(true));
  $('.listitem').mouseleave((evt) => $(evt.target).find('.btn-tiny').toggle(false));
  $('.description').click((evt) => $(evt.target).parent().find('.btn-tiny').toggle(true));
  $('.description').toggle(window.options.listDetails);
}

// redraws gallery view and rebuilds sidebar menu
async function redrawResults() {
  window.location = `#${new Date().getTime()}`;
  busy(true);
  const t0 = window.performance.now();
  const res = document.getElementById('results');
  res.innerHTML = '';
  current = 0;

  document.documentElement.style.setProperty('--fg', window.options.colorHigh);
  document.documentElement.style.setProperty('--tx', window.options.colorText);
  document.documentElement.style.setProperty('--hl', window.options.colorHover);
  document.documentElement.style.setProperty('--bg', window.options.colorBack);
  document.documentElement.style.setProperty('--bd', window.options.colorBody);
  document.documentElement.style.setProperty('--shadow', window.options.listShadow ? '5px 5px #222222' : '0');

  $('#results').off('scroll');
  $('#results').scroll(() => scrollResults());
  scrollResults();
  log.debug(t0, 'Redraw results complete');
  busy(false);
}

// resize gallery view depending on user configuration
async function resizeResults() {
  const thumbSize = parseInt($('#thumbsize')[0].value, 10);
  if (thumbSize !== window.options.listThumbSize) {
    window.options.listThumbSize = thumbSize;
    $('#thumblabel').text(`Size: ${window.options.listThumbSize}px`);
    $('#thumbsize')[0].value = window.options.listThumbSize;
    $('.thumbnail').width(window.options.listThumbSize);
    $('.thumbnail').height(window.options.listThumbSize);
    $('.listitem').css('min-height', `${16 + window.options.listThumbSize}px`);
    $('.listitem').css('max-height', `${16 + window.options.listThumbSize}px`);
  }
  $('body').get(0).style.setProperty('--btntiny', `${Math.round(window.options.listThumbSize / 4)}px`);
}

exports.previous = previous;
exports.current = current;
exports.redraw = redrawResults;
exports.resize = resizeResults;
exports.scroll = scrollResults;
