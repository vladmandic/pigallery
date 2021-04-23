import $ from 'jquery';
import * as log from '../shared/log';
import * as list from './list';
import * as config from '../shared/config';

function JSONtoStr(json) {
  let text = '';
  if (json) {
    text += `<font color="${config.theme.link}">`;
    text += JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ').replace('name:', '');
    text += '</font>';
  }
  return text;
}

async function globalOptions() {
  const req = await fetch('/api/models/get');
  if (!req || !req.ok) return '';
  const models = await req.json();

  const out:{ classify: string, detect: string, video: string, various: string, face: string } = { classify: '', detect: '', video: '', various: '', face: '' };
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
  const html = `
    <div style="line-height: 1.4rem">
      <div class="col">
        <h1>Global configuration</h1>
        Browser register PWA handler: ${config.default.registerPWA}<br>
        Image Processing:<br>
        &nbsp Image thumbnail size: ${config.default.renderThumbnail}px<br>
        Server added metadata:<br>
        &nbsp Image EXIF processing: true<br>
        &nbsp Image location processing: true, DB: assets/cities.json<br>
        &nbsp Image tag processing: true, DB: assets/wordnet-synset.json<br>
      </div>
      <div class="col">
        <h1>TensorFlow Configuration:</h1>
        &nbsp Float Precision: ${config.default.floatPrecision ? '32bit' : '16bit'}<br>
        &nbsp Image resize: ${config.default.maxSize}px &nbsp Image square: ${config.default.squareImage}<br>
      </div>
      <div class="col" style="white-space: normal;">
        <h1>TensorFlow Active Models:</h1>
        ${out.classify || ''}<br>
        ${out.detect || ''}<br>
        ${out.video || ''}<br>
        ${out.face || ''}<br>
        ${out.various || ''}<br>
      </div>
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
  config.options.dateShort = $('#dateShort').val() as string;
  config.options.dateLong = $('#dateLong').val() as string;
  config.options.fontSize = $('#fontSize').val() as string;
  config.options.listLimit = $('#listLimit').val() as number;
  config.options.listItemCount = $('#listItemCount').val() as number;
  config.options.listDetails = ($('#listDetails')[0] as HTMLInputElement).checked as boolean;
  config.options.listTitle = ($('#listTitle')[0] as HTMLInputElement).checked as boolean;
  config.options.listThumbSize = $('#listThumbSize').val() as number;
  config.options.fixWidth = ($('#fixWidth')[0] as HTMLInputElement).checked as boolean;
  config.options.viewBoxes = ($('#viewBoxes')[0] as HTMLInputElement).checked as boolean;
  config.options.viewFaces = ($('#viewFaces')[0] as HTMLInputElement).checked as boolean;
  config.options.theme = parseInt($('#colorTheme').val() as string);
  /*
  config.options.mapColor = $('#mapColor').val();
  config.options.colorText = $('#colorText').val();
  config.options.colorHigh = $('#colorHigh').val();
  config.options.colorHover = $('#colorHover').val();
  config.options.colorBack = $('#colorBack').val();
  config.options.colorBody = $('#colorBody').val();
  config.options.listShadow = $('#listShadow')[0].checked;
  */
  $('#docs').hide();
  config.setTheme();
  list.redraw(window.filtered);
}

function userOptions() {
  let html = '<h1>user configuration</h1>';
  let themes = '';
  for (const i in config.themes) {
    themes += `<option value="${i}" ${config.theme.name === config.themes[i].name ? 'selected' : ''}>${config.themes[i].name}</option>`;
  }
  html += `
    <input type="button" id="btnSaveConfig" class="options" style="left: 30px" value="save configuration">
    <input type="button" id="btnResetConfig" class="options" style="left: 30px" value="reset to default">

    <div class="col">
    <h1>application:</h1>
      <label class="label">short date format <input class="options" type="text" id="dateShort" value="${config.options.dateShort}" /></label>
      <label class="label">long date format <input class="options" type="text" id="dateLong" value="${config.options.dateLong}" /></label>
      <label class="label">base font size <input class="options" type="text" id="fontSize" value="${config.options.fontSize}" /></label>
      <label class="label">color theme: 
        <select class="options" id="colorTheme" value="${config.theme.name}">${themes}</select>
      </label>
    </div>

    <div class="col">
    <h1>gallery view:</h1>
      <label class="label">maximum images to load <input class="options" type="number" id="listLimit" value="${config.options.listLimit}" /></label>
      <label class="label">initial image display count <input class="options" type="number" id="listItemCount" value="${config.options.listItemCount}" /></label>
      <label class="label">show details <input class="options" type="checkbox" id="listDetails" ${config.options.listDetails ? 'checked' : ''} /></label>
      <label class="label">show group headers <input class="options" type="checkbox" id="listTitle" ${config.options.listTitle ? 'checked' : ''} /></label>
      <label class="label">thumbnail size <input class="options" type="number" id="listThumbSize" value="${config.options.listThumbSize}" /></label>
      <label class="label">fix width thumbnails <input class="options" type="checkbox" id="fixWidth" ${config.options.fixWidth ? 'checked' : ''} /></label>
    </div>
  
    <div class="col">
    <h1>details view:</h1>
      <label class="label">draw bounding box around detected objects <input class="options" type="checkbox" id="viewBoxes" ${config.options.viewBoxes ? 'checked' : ''} /></label>
      <label class="label">draw bounding box around detected faces <input class="options" type="checkbox" id="viewFaces" ${config.options.viewFaces ? 'checked' : ''} /></label>
    </div>
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
