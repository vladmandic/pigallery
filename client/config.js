/* eslint-disable import/newline-after-import */
/* eslint-disable node/no-unpublished-require */
/* eslint-disable no-unused-vars */
/* eslint-disable no-multi-spaces */

const log = require('./log.js');

// load tfjs and face-api via npm module or esm script
// window.tf = require('@tensorflow/tfjs');
// window.faceapi = require('@vladmandic/face-api');
/* global tf, faceapi */
if (typeof tf !== 'undefined') window.tf = tf;
if (typeof faceapi !== 'undefined') window.faceapi = faceapi;
// make them use same instance of tfjs one way or the other
// if (window.tf) window.faceapi.tf = window.tf;
// if (window.faceapi.tf) window.tf = window.faceapi.tf;

window.debug = true;

// TFJS Configuration
const config = {
  backEnd: 'webgl',        // back-end used by tensorflow for image processing, can be webgl, cpu, wasm
  floatPrecision: true,    // use 32bit or 16bit float precision
  maxSize: 780,            // maximum image width or height that will be used for processing before resizing is required
  renderThumbnail: 230,    // resolution in which to store image thumbnail embedded in result set
  batchProcessing: 1,      // how many images to process in parallel
  squareImage: false,      // resize proportional to the original image or to a square image
  registerPWA: true,       // register PWA service worker?
};

function colorHex(str) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = str;
  return ctx.fillStyle;
}

window.themes = [
  {
    name: 'Light',
    map: 'light',
    body: colorHex('white'),
    background: colorHex('white'),
    foreground: colorHex('darkgrey'),
    text: colorHex('black'),
    highlight: colorHex('black'),
    shadow: '',
    title: colorHex('#111111'),
    link: colorHex('#222222'),
    inactive: colorHex('lightgrey'),
    gradient: 'white',
    font: 'Lato',
  },
  {
    name: 'Light Blue',
    map: 'light',
    body: colorHex('#c2ecff'),
    background: colorHex('white'),
    foreground: colorHex('#417eb0'),
    text: colorHex('#004463'),
    highlight: colorHex('black'),
    shadow: '',
    title: colorHex('white'),
    link: colorHex('#222222'),
    inactive: colorHex('grey'),
    gradient: '#c2ecff',
    font: 'Lato',
  },
  {
    name: 'Dark',
    map: 'dark',
    // body: colorHex('#555555'),
    body: 'rgba(100, 100, 100, 0.9)',
    background: colorHex('black'),
    foreground: colorHex('ivory'),
    text: colorHex('#ebebeb'),
    highlight: colorHex('white'),
    shadow: '4px 4px #333333',
    title: colorHex('#333333'),
    link: colorHex('#eeeeee'),
    inactive: colorHex('lightgrey'),
    gradient: '#555555',
    font: 'Lato',
  },
  {
    name: 'Dark Blue',
    map: 'dark',
    body: colorHex('#00334a'),
    background: colorHex('black'),
    foreground: colorHex('#e0f5ff'),
    text: colorHex('#e0f5ff'),
    highlight: colorHex('white'),
    shadow: '',
    title: colorHex('#006391'),
    link: colorHex('#abe4ff'),
    inactive: colorHex('lightgrey'),
    gradient: '#00334a',
    font: 'Lato',
  },
];

async function initTheme() {
  window.theme = window.themes[window.options.theme];
  document.documentElement.style.setProperty('--body', window.theme.body);
  document.documentElement.style.setProperty('--background', window.theme.background);
  document.documentElement.style.setProperty('--foreground', window.theme.foreground);
  document.documentElement.style.setProperty('--text', window.theme.text);
  document.documentElement.style.setProperty('--title', window.theme.title);
  document.documentElement.style.setProperty('--highlight', window.theme.highlight);
  document.documentElement.style.setProperty('--shadow', window.theme.shadow);
  document.documentElement.style.setProperty('--link', window.theme.link);
  document.documentElement.style.setProperty('--inactive', window.theme.inactive);
  log.debug(null, `Theme: ${window.theme.name}`);
}

// user configurable options & defalt values, stored in browsers local storage
window.options = {
  get listItemCount() { return parseInt(localStorage.getItem('listItemCount') || 500); },
  set listItemCount(val) { return localStorage.setItem('listItemCount', val); },

  get listFolders() { return localStorage.getItem('listFolders') ? localStorage.getItem('listFolders') === 'true' : true; },
  set listFolders(val) { return localStorage.setItem('listFolders', val); },

  get listDetails() { return localStorage.getItem('listDetails') ? localStorage.getItem('listDetails') === 'true' : false; },
  set listDetails(val) { return localStorage.setItem('listDetails', val); },

  get listDivider() { return localStorage.getItem('listDivider') || 'month'; },
  set listDivider(val) { return localStorage.setItem('listDivider', val); },

  get listSortOrder() { return localStorage.getItem('listSortOrder') || 'numeric-down'; },
  set listSortOrder(val) { return localStorage.setItem('listSortOrder', val); },

  get listThumbSquare() { return localStorage.getItem('listThumbSquare') ? localStorage.getItem('listThumbSquare') === 'true' : true; },
  set listThumbSquare(val) { return localStorage.setItem('listThumbSquare', val); },

  get listTitle() { return localStorage.getItem('listTitle') ? localStorage.getItem('listTitle') === 'true' : true; },
  set listTitle(val) { return localStorage.setItem('listTitle', val); },

  get listThumbSize() { return parseInt(localStorage.getItem('listThumbSize') || 180); },
  set listThumbSize(val) { return localStorage.setItem('listThumbSize', val); },

  get listLimit() { return parseInt(localStorage.getItem('listLimit') || 10000); },
  set listLimit(val) { return localStorage.setItem('listLimit', val); },

  get viewDetails() { return localStorage.getItem('viewDetails') ? localStorage.getItem('viewDetails') === 'true' : true; },
  set viewDetails(val) { return localStorage.setItem('viewDetails', val); },

  get viewBoxes() { return localStorage.getItem('viewBoxes') ? localStorage.getItem('viewBoxes') === 'true' : true; },
  set viewBoxes(val) { return localStorage.setItem('viewBoxes', val); },

  get viewFaces() { return localStorage.getItem('viewFaces') ? localStorage.getItem('viewFaces') === 'true' : true; },
  set viewFaces(val) { return localStorage.setItem('viewFaces', val); },

  get viewRaw() { return localStorage.getItem('viewRaw') ? localStorage.getItem('viewRaw') === 'true' : false; },
  set viewRaw(val) { return localStorage.setItem('viewRaw', val); },

  get liveLoad() { return localStorage.getItem('liveLoad') ? localStorage.getItem('liveLoad') === 'true' : false; },
  set liveLoad(val) { return localStorage.setItem('liveLoad', val); },

  get dateShort() { return localStorage.getItem('dateShort') || 'YYYY/MM/DD'; },
  set dateShort(val) { return localStorage.setItem('dateShort', val); },

  get dateLong() { return localStorage.getItem('dateLong') || 'dddd, MMMM Do, YYYY'; },
  set dateLong(val) { return localStorage.setItem('dateLong', val); },

  get dateDivider() { return localStorage.getItem('dateDivider') || 'MMMM YYYY'; },
  set dateDivider(val) { return localStorage.setItem('dateDivider', val); },

  get fontSize() { return localStorage.getItem('fontSize') || '16px'; },
  set fontSize(val) { return localStorage.setItem('fontSize', val); },

  get slideDelay() { return parseInt(localStorage.getItem('slidedelay') || 2500); },
  set slideDelay(val) { return localStorage.setItem('slidedelay', val); },

  get topClasses() { return parseInt(localStorage.getItem('topClasses') || 25); },
  set topClasses(val) { return localStorage.setItem('topClasses', val); },

  get listDetailsWidth() { return parseInt(localStorage.getItem('listDetailsWidth') || 25); },
  set listDetailsWidth(val) { return localStorage.setItem('listDetailsWidth', val); },

  get lastUpdated() { return parseInt(localStorage.getItem('lastUpdated') || 0); },
  set lastUpdated(val) { return localStorage.setItem('lastUpdated', val); },

  get theme() { return parseInt(localStorage.getItem('theme') || 2); },
  set theme(val) { return localStorage.setItem('theme', val); },
};

exports.default = config;
exports.theme = initTheme;
