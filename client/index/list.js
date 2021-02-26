// @ts-nocheck

import $ from 'jquery';
import moment from 'moment';
import * as log from '../shared/log.js';
import * as details from './details.js';

// adds dividiers to list view based on sort order
let previous;
function addDividers(object) {
  if (!window.options.listTitle) return '';
  let divider;
  if (window.options.listDivider === 'simmilarity' && object.simmilarity) {
    const curr = `${object.simmilarity}%`;
    const prev = previous ? `${previous.simmilarity}%` : 'none';
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
  const fixWidth = window.options.fixWidth ? `width=${window.options.listThumbSize}px` : '';
  const fixHeight = window.options.fixHeight ? `height=${window.options.listThumbSize}px` : '';
  const title = `${object.image}\n${timestamp}\n${classified}\n${detected}\n${location}\n${camera}`;
  thumb.innerHTML = `
    <img loading="lazy" id="thumb-${object.id}" img="${object.image}" src="${object.thumbnail}" onclick="details.show('${escape(object.image)}');" align="middle" ${fixWidth} ${fixHeight} title="${title}">
    <div class="thumb-top">
      <p class="btn-tiny fa fa-file-archive" onclick="deleteImage('${escape(object.image)}');" title="Delete image"></p>
      <p class="btn-tiny fa fa-file-image" onclick="details.show('${escape(object.image)}');" title="View image details"></p>
      <a class="btn-tiny fa fa-file" href="${object.image}" download title="Download image"></a>
    </div>
    <div class="thumb-bottom">
      <p class="btn-tiny fa fa-images" onclick="simmilarClasses('${escape(object.image)}');" title="Find images with simmilar description"></p>
      <p class="btn-tiny fa fa-photo-video" onclick="simmilarImage('${escape(object.image)}');" title="Find images with simmilar features"></p>
      <p class="btn-tiny fa fa-id-card" onclick="simmilarPerson('${escape(object.image)}');" title="Find images with simmilar faces"></p>
    </div>
  `;

  const desc = document.createElement('div');
  desc.className = 'col description';
  desc.id = object.id;
  desc.style = `display: ${window.options.listDetails ? 'block' : 'hidden'}`;
  desc.innerHTML = `
    <p class="listtitle">${decodeURIComponent(object.image).replace(root, '')}</p>
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
  div.style = `min-height: ${16 + window.options.listThumbSize}px; max-height: ${16 + window.options.listThumbSize}px; contain-intrinsic-size: ${16 + window.options.listThumbSize}px`;
  div.appendChild(thumb);
  div.appendChild(desc);
  return div;
}

async function thumbButtons(evt, show) {
  let items = [];
  if (items.length === 0) items = $(evt.target).find('.btn-tiny');
  if (items.length === 0) items = $(evt.target).parent().find('.btn-tiny');
  if (items.length === 0) items = $(evt.relatedTarget).find('.btn-tiny');
  if (items.length === 0) items = $(evt.relatedTarget).parent().find('.btn-tiny');
  // $(items).toggle(show);
  if (show) $(items).show();
  else $(items).hide();
}

// adds items to gallery view on scroll event - infinite scroll
let current;
export async function scroll() {
  const scrollHeight = $('#results').prop('scrollHeight');
  const bottom = $('#results').scrollTop() + $('#all').height();
  if (((bottom + 16) >= scrollHeight) && (current < window.filtered.length)) {
    const t0 = performance.now();
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
  $('.listitem').mouseover((evt) => thumbButtons(evt, true));
  $('.listitem').mouseout((evt) => thumbButtons(evt, false));
  // $('.listitem').mouseenter((evt) => thumbButtons(evt, true));
  // $('.listitem').mouseleave((evt) => thumbButtons(evt, false));
  $('.listitem').contextmenu((evt) => $(evt.target).parent().find('.btn-tiny').show());
  $('.description').click((evt) => $(evt.target).parent().find('.btn-tiny').show());
  $('.description').toggle(window.options.listDetails);
}

// redraws gallery view and rebuilds sidebar menu
export async function redraw() {
  const dt = new Date();
  const base = new Date(dt.getFullYear(), dt.getMonth(), 0).getTime();
  const hash = Math.trunc((dt.getTime() - base) / 1000);
  location.href = `#${hash}`;
  const t0 = performance.now();
  document.getElementById('results').innerHTML = '';
  current = 0;

  $('#results').off('scroll');
  $('#results').scroll(() => scroll());
  scroll();
  log.debug(t0, 'Redraw results complete');
}

// resize gallery view depending on user configuration
export async function resize() {
  const thumbSize = parseInt($('#thumbsize')[0].value);
  if (thumbSize !== window.options.listThumbSize) {
    window.options.listThumbSize = thumbSize;
    $('#thumblabel').text(`Size: ${window.options.listThumbSize}px`);
    $('#thumbsize')[0].value = window.options.listThumbSize;
    $('.thumbnail').width(window.options.listThumbSize);
    $('.thumbnail').height(window.options.listThumbSize);
    $('.listitem').css('min-height', `${16 + window.options.listThumbSize}px`);
    $('.listitem').css('max-height', `${16 + window.options.listThumbSize}px`);
  }
  $('body').get(0).style.setProperty('--btntiny', `${Math.round(window.options.listThumbSize / 5)}px`);
}

export function clearPrevious() { previous = null; }
