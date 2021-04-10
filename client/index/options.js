// @ts-nocheck

import $ from 'jquery';
import * as log from '../shared/log';
import * as list from './list';
import * as config from '../shared/config';

function JSONtoStr(json) {
  let text = '';
  if (json) {
    text += `<font color="${window.theme.link}">`;
    text += JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ').replace('name:', '');
    text += '</font>';
  }
  return text;
}

async function globalOptions() {
  const req = await fetch('/api/models/get');
  if (!req || !req.ok) return '';
  const models = await req.json();

  const out = {};
  if (models.classify) {
    out.classify = '<b>&nbsp Image Classification:</b><br>';
    for (const obj of models.classify) out.classify += `&nbsp &nbsp ${JSONtoStr(obj)}<br>`;
  }
  if (models.detect) {
    out.detect = '<b>&nbsp Object Detection:</b><br>';
    for (const obj of models.detect) out.detect += `&nbsp &nbsp ${JSONtoStr(obj)}<br>`;
  }
  if (models.video) {
    out.video = '<b>&nbsp Video Analysis:</b><br>';
    for (const [key, val] of Object.entries(models.video)) out.video += `&nbsp &nbsp ${key}: ${JSONtoStr(val)}<br>`;
  }
  if (models.various) {
    out.various = '<b>&nbsp Various:</b><br>';
    for (const [key, val] of Object.entries(models.various)) out.various += `&nbsp &nbsp ${key}: ${JSONtoStr(val)}<br>`;
  }
  if (models.person) {
    out.face = '<b>&nbsp Face Analysis:</b><br>';
    out.face += `&nbsp &nbsp ${JSONtoStr(models.person)}<br>`;
  }
  const html = `<div style="line-height: 1.4rem">
    <h1>Global configuration</h1>
    Browser register PWA handler: ${config.default.registerPWA}<br>
    Image Processing:<br>
    &nbsp Image thumbnail size: ${config.default.renderThumbnail}px<br>
    Server added metadata:<br>
    &nbsp Image EXIF processing: true<br>
    &nbsp Image location processing: true, DB: assets/cities.json<br>
    &nbsp Image tag processing: true, DB: assets/wordnet-synset.json<br>
    <h1>TensorFlow Configuration:</h1>
    &nbsp Float Precision: ${config.default.floatPrecision ? '32bit' : '16bit'}<br>
    &nbsp Image resize: ${config.default.maxSize}px &nbsp Image square: ${config.default.squareImage}<br>
    <h1>TensorFlow Active Models:</h1>
    ${out.classify || ''}<br>
    ${out.detect || ''}<br>
    ${out.video || ''}<br>
    ${out.face || ''}<br>
    ${out.various || ''}<br>
    </div>
  `;
  return html;
}

function resetOptions() {
  log.debug('Options reset');
  localStorage.clear();
  sessionStorage.clear();
  // eslint-disable-next-line no-use-before-define
  showOptions();
  $('#docs').hide();
  config.setTheme();
  list.redraw(window.filtered);
}

function saveOptions() {
  log.debug('Options save');
  window.options.dateShort = $('#dateShort').val();
  window.options.dateLong = $('#dateLong').val();
  window.options.fontSize = $('#fontSize').val();
  window.options.listLimit = $('#listLimit').val();
  window.options.listItemCount = $('#listItemCount').val();
  window.options.listDetails = $('#listDetails')[0].checked;
  window.options.listTitle = $('#listTitle')[0].checked;
  window.options.listThumbSize = $('#listThumbSize').val();
  window.options.fixWidth = $('#fixWidth')[0].checked;
  window.options.fixHeight = $('#fixHeight')[0].checked;
  window.options.viewBoxes = $('#viewBoxes')[0].checked;
  window.options.viewFaces = $('#viewFaces')[0].checked;
  window.options.cacheModels = $('#cacheModels')[0].checked;
  window.options.cacheAssets = $('#cacheAssets')[0].checked;
  window.options.theme = parseInt($('#colorTheme').val());
  /*
  window.options.mapColor = $('#mapColor').val();
  window.options.colorText = $('#colorText').val();
  window.options.colorHigh = $('#colorHigh').val();
  window.options.colorHover = $('#colorHover').val();
  window.options.colorBack = $('#colorBack').val();
  window.options.colorBody = $('#colorBody').val();
  window.options.listShadow = $('#listShadow')[0].checked;
  */
  $('#docs').hide();
  config.setTheme();
  list.redraw(window.filtered);
}

function userOptions() {
  let html = '<h1>User Configuration</h1>';
  let themes = '';
  for (const i in window.themes) {
    themes += `<option value="${i}" ${window.theme.name === window.themes[i].name ? 'selected' : ''}>${window.themes[i].name}</option>`;
  }
  html += `
    <form>

    <input type="button" id="btnSaveConfig" class="options" style="left: 30px" value="Save configuration">
    <input type="button" id="btnResetConfig" class="options" style="left: 30px" value="Reset to default">

    <h1>Application:</h1>
    <label class="label">Models cache <input class="options" type="checkbox" id="cacheModels" ${window.options.cacheModels ? 'checked' : ''} /></label>
    <label class="label">Assets cache <input class="options" type="checkbox" id="cacheAssets" ${window.options.cacheAssets ? 'checked' : ''} /></label>
    <label class="label">Short date format <input class="options" type="text" id="dateShort" value="${window.options.dateShort}" /></label>
    <label class="label">Long date format <input class="options" type="text" id="dateLong" value="${window.options.dateLong}" /></label>
    <label class="label">Base font size <input class="options" type="text" id="fontSize" value="${window.options.fontSize}" /></label>

    <label class="label">Color Theme: 
      <select class="options" id="colorTheme" value="${window.theme.name}">${themes}</select>
    </label>

    <!--
    <label class="label">Color: Text <input class="options" type="color" id="colorText" value="${window.options.colorText}" /></label>
    <label class="label">Color: Highlight <input class="options" type="color" id="colorHigh" value="${window.options.colorHigh}" /></label>
    <label class="label">Color: Hover <input class="options" type="color" id="colorHover" value="${window.options.colorHover}" /></label>
    <label class="label">Color: Background <input class="options" type="color" id="colorBack" value="${window.options.colorBack}" /></label>
    <label class="label">Color: Body <input class="options" type="color" id="colorBody" value="${window.options.colorBody}" /></label>
    <label class="label">List items have shadows <input class="options" type="checkbox" id="listShadow" ${window.options.listShadow ? 'checked' : ''} /></label>
    <h1>Map view:</h1>
    <label class="label">Theme <input class="options" type="text" id="mapColor" value="${window.options.mapColor}" /></label>
    -->

    <h1>Gallery view:</h1>
    <label class="label">Maximum images to load <input class="options" type="number" id="listLimit" value="${window.options.listLimit}" /></label>
    <label class="label">Initial image display count <input class="options" type="number" id="listItemCount" value="${window.options.listItemCount}" /></label>
    <label class="label">Show details <input class="options" type="checkbox" id="listDetails" ${window.options.listDetails ? 'checked' : ''} /></label>
    <label class="label">Show group headers <input class="options" type="checkbox" id="listTitle" ${window.options.listTitle ? 'checked' : ''} /></label>
    <label class="label">Thumbnail size <input class="options" type="number" id="listThumbSize" value="${window.options.listThumbSize}" /></label>
    <label class="label">Fix width thumbnails <input class="options" type="checkbox" id="fixWidth" ${window.options.fixWidth ? 'checked' : ''} /></label>
    <label class="label">Fix height thumbnails <input class="options" type="checkbox" id="fixHeight" ${window.options.fixHeight ? 'checked' : ''} /></label>

    <h1>Details view:</h1>
    <label class="label">Draw bounding box around detected objects <input class="options" type="checkbox" id="viewBoxes" ${window.options.viewBoxes ? 'checked' : ''} /></label>
    <label class="label">Draw bounding box around detected faces <input class="options" type="checkbox" id="viewFaces" ${window.options.viewFaces ? 'checked' : ''} /></label>

    </form>
  `;
  return html;
}

async function showOptions() {
  const html = userOptions();
  $('#docs').html(html);
  $('#btnSaveConfig').on('click', saveOptions);
  $('#btnResetConfig').on('click', resetOptions);
}

async function showParams() {
  const html = await globalOptions();
  $('#docs').html(html);
}

export {
  showOptions as show,
  showParams as params,
};
