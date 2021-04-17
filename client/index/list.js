// @ts-nocheck

import $ from 'jquery';
import moment from 'moment';
import * as log from '../shared/log';
import * as details from './details';

// adds dividiers to list view based on sort order
let previous;
function addDividers(object, title) {
  if (!window.options.listTitle) return '';
  let divider;
  if (window.options.listDivider === 'similarity' && object.similarity) {
    const curr = `${Math.round(object.similarity)}%`;
    const prev = previous ? `${Math.round(previous.similarity)}%` : 'none';
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
  if (window.options.listDivider === 'search') {
    if (!previous) {
      if (title) divider = title;
      else divider = 'search';
    }
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
  for (const item of details.combine(object.detect)) {
    if (item.name !== 'person') detected += ` | ${item.score}% ${item.name}`;
  }
  const personCount = object.detect.filter((a) => a.class === 'person').length;
  if (personCount === 1) detected += ' | 1 person';
  else if (personCount > 1) detected += ` | ${personCount} persons`;
  const faceCount = object.person ? object.person.length : 0;
  if (faceCount === 1) detected += ' | 1 face';
  else if (faceCount > 1) detected += ` | ${faceCount} faces`;

  let person = '';
  if (object.person && object.person[0]) {
    person = 'People';
    for (const i of object.person) {
      if (i.gender || i.age) person += ` | ${i.gender || ''} ${i.age?.toFixed(0) || ''}`;
    }
  }

  let location = '';
  if (object.location && object.location.city) {
    location = `Location | ${object.location.city}, ${object.location.state} ${object.location.country} (near ${object.location.near})`;
  }

  const camera = (object.exif && object.exif.make) ? `Camera | ${object.exif.make || ''} ${object.exif.model || ''} ${object.exif.lens || ''}` : '';
  const settings = (object.exif && object.exif.iso) ? `Settings | ${object.exif.fov ? `${object.exif.fov}mm` : ''} ISO${object.exif.iso || 0} f/${object.exif.apperture || 0} 1/${(1 / (object.exif.exposure || 1)).toFixed(0)}sec` : '';
  const timestamp = object.exif.created ? moment(object.exif.created).format(window.options.dateShort) : 'Date unknown';
  const root = window.user && window.user.root ? window.user.root : 'media/';

  const thumb = document.createElement('div');
  thumb.className = 'col thumbnail';
  thumb.id = object.id;
  const title = `${object.image}\nDate: ${timestamp} | Size ${object.naturalSize.width} x ${object.naturalSize.height}\n${classified}\n${detected}\n${person}\n${location}\n${camera}`;
  const imgStyle = `width: ${window.options.fixWidth ? '-webkit-fill-available' : 'fit-content'}; width: ${window.options.fixWidth ? '-moz-fill-available' : 'fit-content'}`;
  thumb.innerHTML = `
    <img loading="lazy" id="thumb-${object.id}" img="${object.image}" src="${object.thumbnail}" onclick="details.show('${escape(object.image)}');" align="middle" style="${imgStyle}" title="${title}">
    <div class="thumb-top">
      <p class="btn-tiny fa fa-file-archive" onclick="deleteImage('${escape(object.image)}');" title="Delete image"></p>
      <p class="btn-tiny fa fa-file-image" onclick="details.show('${escape(object.image)}');" title="View image details"></p>
      <a class="btn-tiny fa fa-file" href="${object.image}" download title="Download image"></a>
    </div>
    <div class="thumb-bottom">
      <p class="btn-tiny fa fa-images" onclick="similarClasses('${escape(object.image)}');" title="Find images with similar description"></p>
      <p class="btn-tiny fa fa-photo-video" onclick="similarImage('${escape(object.image)}');" title="Find images with similar features"></p>
      <p class="btn-tiny fa fa-id-card" onclick="similarPerson('${escape(object.image)}');" title="Find images with similar faces"></p>
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
  const width = window.options.fixWidth ? `width: ${16 + window.options.listThumbSize}px;` : '';
  div.style = `height: ${16 + window.options.listThumbSize}px; ${width}`;
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
export async function scroll(images, title) {
  const visibleHeight = Math.trunc(document.getElementById('results').offsetHeight + document.getElementById('results').scrollTop);
  const totalHeight = Math.trunc(document.getElementById('results').scrollHeight);
  if (visibleHeight >= totalHeight && current < images.length) {
    const t0 = performance.now();
    const res = document.getElementById('results');
    const count = Math.min(window.options.listItemCount, images.length - current);
    let i = current;
    while (i < (current + count)) {
      const divider = addDividers(images[i], title);
      const item = printResult(images[i]);
      if (divider) res.appendChild(divider);
      res.appendChild(item);
      i++;
    }
    current = i;
    log.debug(t0, `Results scroll: added: ${count} current: ${current} total: ${images.length}`);
  }
  $('.listitem').on('mouseover', (evt) => thumbButtons(evt, true));
  $('.listitem').on('mouseout', (evt) => thumbButtons(evt, false));
  // $('.listitem').mouseenter((evt) => thumbButtons(evt, true));
  // $('.listitem').mouseleave((evt) => thumbButtons(evt, false));
  $('.listitem').on('contextmenu', (evt) => $(evt.target).parent().find('.btn-tiny').show());
  $('.description').on('click', (evt) => $(evt.target).parent().find('.btn-tiny').show());
  $('.description').toggle(window.options.listDetails);
  $('#results').off('scroll');
  $('#results').on('scroll', () => scroll(images, title));
}

// redraws gallery view and rebuilds sidebar menu
export async function redraw(images, divider, clear = true) {
  const dt = new Date();
  const base = new Date(dt.getFullYear(), dt.getMonth(), 0).getTime();
  const hash = Math.trunc((dt.getTime() - base) / 1000);
  location.href = `#${hash}`;
  const t0 = performance.now();
  if (clear) {
    document.getElementById('results').innerHTML = '';
    current = 0;
  }

  await scroll(images, divider);
  document.getElementById('results').scrollTop = 0;
  log.debug(t0, 'Redraw results complete:', images.length, clear);
}

// resize gallery view depending on user configuration
export async function resize() {
  const thumbSize = parseInt($('#thumbsize')[0].value);
  if (thumbSize !== window.options.listThumbSize) {
    window.options.listThumbSize = thumbSize;
    document.documentElement.style.setProperty('--thumbSize', window.options.listThumbSize);
    $('#thumblabel').text(`Size: ${window.options.listThumbSize}px`);
    $('#thumbsize')[0].value = window.options.listThumbSize;
    // $('.thumbnail').width(window.options.listThumbSize);
    // $('.thumbnail').height(window.options.listThumbSize);
    $('.listitem').css('height', `${16 + window.options.listThumbSize}px`);
    $('.listitem').css('width', `${16 + window.options.listThumbSize}px`);
  }
  $('body').get(0).style.setProperty('--btntiny', `${Math.round(window.options.listThumbSize / 5)}px`);
}

export function clearPrevious() { previous = null; }
