const tf = require('@tensorflow/tfjs');
const log = require('./log.js');
const list = require('./list.js');
const config = require('./config.js').default;

function JSONtoStr(json) {
  let text = '';
  if (json) {
    text += '<font color="lightgrey">';
    text += JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ').replace('name:', '');
    text += '</font>';
  }
  return text;
}

function globalOptions() {
  let classify = '<b>&nbsp Image Classification:</b><br>';
  for (const obj of config.classify) classify += `&nbsp &nbsp ${JSONtoStr(obj)}<br>`;
  let detect = '<b>&nbsp Object Detection:</b><br>';
  for (const obj of config.detect) detect += `&nbsp &nbsp ${JSONtoStr(obj)}<br>`;
  let face = '<b>&nbsp Face Analysis:</b><br>';
  face += `&nbsp &nbsp ${JSONtoStr(config.person)}<br>`;
  const html = `<h1>Global configuration</h1>
    Browser register PWA handler: ${config.registerPWA}<br>
    Image Processing:<br>
    &nbsp Image thumbnail size: ${config.renderThumbnail}px<br>
    Server added metadata:<br>
    &nbsp Image EXIF processing: true<br>
    &nbsp Image location processing: true, DB: assets/Cities.json<br>
    &nbsp Image tag processing: true, DB: assets/WordNet-Synset.json<br>
    <h1>TensorFlow Configuration:</h1>
    &nbsp Version: ${tf.version_core} &nbsp Platform: ${tf.ENV.platformName} &nbsp Engine: ${config.backEnd} &nbsp Precision: ${config.floatPrecision ? '32bit' : '16bit'}<br>
    &nbsp Image resize: ${config.maxSize}px &nbsp Image square: ${config.squareImage}<br>
    <h1>TensorFlow Active Models:</h1>
    ${classify}
    ${detect}
    ${face}
  `;
  return html;
}

function resetOptions() {
  log.debug(null, 'Options reset');
  localStorage.clear();
  sessionStorage.clear();
  // eslint-disable-next-line no-use-before-define
  showOptions();
  list.redraw();
}

function saveOptions() {
  log.debug(null, 'Options save');
  window.options.dateShort = $('#dateShort').val();
  window.options.dateLong = $('#dateLong').val();
  window.options.fontSize = $('#fontSize').val();
  window.options.listLimit = $('#listLimit').val();
  window.options.listItemCount = $('#listItemCount').val();
  window.options.listDetails = $('#listDetails')[0].checked;
  window.options.listTitle = $('#listTitle')[0].checked;
  window.options.listThumbSize = $('#listThumbSize').val();
  window.options.listThumbSquare = $('#listThumbSquare')[0].checked;
  window.options.viewBoxes = $('#viewBoxes')[0].checked;
  window.options.viewFaces = $('#viewFaces')[0].checked;
  window.options.mapColor = $('#mapColor').val();
  window.options.colorText = $('#colorText').val();
  window.options.colorHigh = $('#colorHigh').val();
  window.options.colorHover = $('#colorHover').val();
  window.options.colorBack = $('#colorBack').val();
  window.options.colorBody = $('#colorBody').val();
  window.options.listShadow = $('#listShadow')[0].checked;
  list.redraw();
}

function userOptions() {
  let html = '<h1>User Configuration</h1>';
  html += `
    <form>

    <input type="button" id="btnSaveConfig" class="options" style="left: 30px" value="Save configuration">
    <input type="button" id="btnResetConfig" class="options" style="left: 30px" value="Reset to default">

    <h1>Application:</h1>
    <label class="label">Short date format <input class="options" type="text" id="dateShort" value="${window.options.dateShort}" /></label>
    <label class="label">Long date format <input class="options" type="text" id="dateLong" value="${window.options.dateLong}" /></label>
    <label class="label">Base font size <input class="options" type="text" id="fontSize" value="${window.options.fontSize}" /></label>
    <label class="label">Color: Text <input class="options" type="color" id="colorText" value="${window.options.colorText}" /></label>
    <label class="label">Color: Highlight <input class="options" type="color" id="colorHigh" value="${window.options.colorHigh}" /></label>
    <label class="label">Color: Hover <input class="options" type="color" id="colorHover" value="${window.options.colorHover}" /></label>
    <label class="label">Color: Background <input class="options" type="color" id="colorBack" value="${window.options.colorBack}" /></label>
    <label class="label">Color: Body <input class="options" type="color" id="colorBody" value="${window.options.colorBody}" /></label>

    <h1>Gallery view:</h1>
    <label class="label">Maximum images to load <input class="options" type="number" id="listLimit" value="${window.options.listLimit}" /></label>
    <label class="label">Initial image display count <input class="options" type="number" id="listItemCount" value="${window.options.listItemCount}" /></label>
    <label class="label">Show details <input class="options" type="checkbox" id="listDetails" ${window.options.listDetails ? 'checked' : ''} /></label>
    <label class="label">Show group headers <input class="options" type="checkbox" id="listTitle" ${window.options.listTitle ? 'checked' : ''} /></label>
    <label class="label">Thumbnail size <input class="options" type="number" id="listThumbSize" value="${window.options.listThumbSize}" /></label>
    <label class="label">Use square thumbnails <input class="options" type="checkbox" id="listThumbSquare" ${window.options.listThumbSquare ? 'checked' : ''} /></label>
    <label class="label">List items have shadows <input class="options" type="checkbox" id="listShadow" ${window.options.listShadow ? 'checked' : ''} /></label>

    <h1>Details view:</h1>
    <label class="label">Draw bounding box around detected objects <input class="options" type="checkbox" id="viewBoxes" ${window.options.viewBoxes ? 'checked' : ''} /></label>
    <label class="label">Draw bounding box around detected faces <input class="options" type="checkbox" id="viewFaces" ${window.options.viewFaces ? 'checked' : ''} /></label>

    <h1>Map view:</h1>
    <label class="label">Theme <input class="options" type="text" id="mapColor" value="${window.options.mapColor}" /></label>

    </form>
  `;
  return html;
}

function showOptions() {
  let html = '';
  html += globalOptions();
  html += userOptions();
  $('#docs').html(html);
  $('#btnSaveConfig').click(saveOptions);
  $('#btnResetConfig').click(resetOptions);
}

exports.show = showOptions;
