// @ts-nocheck
/* eslint-disable no-multi-spaces */

import $ from 'jquery';
import * as log from './log.js';

// @ts-ignore
window.debug = true;

// TFJS Configuration
const config = {
  backEnd: 'webgl',        // back-end used by tensorflow for image processing: webgl, cpu, wasm, webgpu
  maxSize: 720,            // maximum image width or height that will be used for processing before resizing is required
  renderThumbnail: 230,    // resolution in which to store image thumbnail embedded in result set
  batchProcessing: 1,      // how many images to process in parallel
  squareImage: false,      // resize proportional to the original image or to a square image
  registerPWA: true,       // register PWA service worker?
  facing: true,            // webcam facing front or back
  memory: true,           // set webgl memory hard limit
  // webgl configuration
  webgl: {
    WEBGL_DELETE_TEXTURE_THRESHOLD: 0, // delete textures upon disposal is used memory is larger than this rather than making them available for reuse // Math.trunc(3.5 * 1024 * 1024 * 1024)
    WEBGL_FORCE_F16_TEXTURES: false, // Whether the WebGL backend will always use f16 textures for rendering
    WEBGL_PACK_DEPTHWISECONV: false, // Whether we will pack the depthwise conv op // TODO: https://github.com/tensorflow/tfjs/issues/1679
    // WEBGL_CHECK_NUMERICAL_PROBLEMS // Whether to check for numerical representation problems
    // WEBGL_CONV_IM2COL // Whether we will use the im2col algorithm to speed up convolutions
    // WEBGL_CPU_FORWARD: true, // Whether the WebGL backend will sometimes forward ops to the CPU
    // WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION: // The disjoint_query_timer extension version. 0: disabled, 1: EXT_disjoint_timer_query, 2: EXT_disjoint_timer_query_webgl2
    // WEBGL_FENCE_API_ENABLED // Whether the fence API is available
    // WEBGL_LAZILY_UNPACK // Whether packed WebGL kernels lazily unpack their outputs
    // WEBGL_MAX_TEXTURE_SIZE // The maximum texture dimension
    // WEBGL_MAX_TEXTURES_IN_SHADER // The maximum texture dimension
    // WEBGL_PACK_ARRAY_OPERATIONS // Whether we will pack array ops
    // WEBGL_PACK_BINARY_OPERATIONS // Whether we will pack binary ops
    // WEBGL_PACK_CLIP // Whether we will pack the clip op
    // WEBGL_PACK_IMAGE_OPERATIONS // Whether we will pack image ops
    // WEBGL_PACK_NORMALIZATION // Whether we will pack the batchnormalization op
    // WEBGL_PACK_REDUCE // Whether we will pack reduce ops
    // WEBGL_PACK_UNARY_OPERATIONS // Whether we will pack unary ops
    // WEBGL_SIZE_UPLOAD_UNIFORM: // Tensors with size <= than this will be uploaded as uniforms, not textures. default 4
  },
  ui: {
    scale: 100,
    maxFrames: 10,
    overlay: true,
    useDepth: true,
    drawBoxes: true,
    drawPoints: false,
    drawPolygons: true,
    fillPolygons: true,
    lineWidth: 8,
    text: true,
    lineColor: 'rgba(125, 255, 255, 0.6)',
    font: 'small-caps 1rem "Segoe UI"',
  },
  classify: {},
  detect: {},
};

function colorHex(str) {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = str;
  return ctx.fillStyle;
}

// @ts-ignore
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
    body: 'rgba(100, 100, 100, 1.0)',
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

// user configurable options & defalt values, stored in browsers local storage
// @ts-ignore
window.options = {
  get listItemCount() { return parseInt(localStorage.getItem('listItemCount') || '500'); },
  set listItemCount(val) { localStorage.setItem('listItemCount', val.toString()); },

  get cacheModels() { return localStorage.getItem('cacheModels') ? localStorage.getItem('cacheModels') === 'true' : true; },
  set cacheModels(val) { localStorage.setItem('cacheModels', val.toString()); },

  get cacheAssets() { return localStorage.getItem('cacheAssets') ? localStorage.getItem('cacheAssets') === 'true' : true; },
  set cacheAssets(val) { localStorage.setItem('cacheAssets', val.toString()); },

  get listFolders() { return localStorage.getItem('listFolders') ? localStorage.getItem('listFolders') === 'true' : true; },
  set listFolders(val) { localStorage.setItem('listFolders', val.toString()); },

  get listDetails() { return localStorage.getItem('listDetails') ? localStorage.getItem('listDetails') === 'true' : false; },
  set listDetails(val) { localStorage.setItem('listDetails', val.toString()); },

  get listDivider() { return localStorage.getItem('listDivider') || 'month'; },
  set listDivider(val) { localStorage.setItem('listDivider', val); },

  get listSortOrder() { return localStorage.getItem('listSortOrder') || 'numeric-down'; },
  set listSortOrder(val) { localStorage.setItem('listSortOrder', val); },

  get listThumbSquare() { return localStorage.getItem('listThumbSquare') ? localStorage.getItem('listThumbSquare') === 'true' : true; },
  set listThumbSquare(val) { localStorage.setItem('listThumbSquare', val.toString()); },

  get listTitle() { return localStorage.getItem('listTitle') ? localStorage.getItem('listTitle') === 'true' : true; },
  set listTitle(val) { localStorage.setItem('listTitle', val.toString()); },

  get listThumbSize() { return parseInt(localStorage.getItem('listThumbSize') || '180'); },
  set listThumbSize(val) { localStorage.setItem('listThumbSize', val.toString()); },

  get listLimit() { return parseInt(localStorage.getItem('listLimit') || '100000'); },
  set listLimit(val) { localStorage.setItem('listLimit', val.toString()); },

  get viewDetails() { return localStorage.getItem('viewDetails') ? localStorage.getItem('viewDetails') === 'true' : true; },
  set viewDetails(val) { localStorage.setItem('viewDetails', val.toString()); },

  get viewBoxes() { return localStorage.getItem('viewBoxes') ? localStorage.getItem('viewBoxes') === 'true' : true; },
  set viewBoxes(val) { localStorage.setItem('viewBoxes', val.toString()); },

  get viewFaces() { return localStorage.getItem('viewFaces') ? localStorage.getItem('viewFaces') === 'true' : true; },
  set viewFaces(val) { localStorage.setItem('viewFaces', val.toString()); },

  get viewRaw() { return localStorage.getItem('viewRaw') ? localStorage.getItem('viewRaw') === 'true' : false; },
  set viewRaw(val) { localStorage.setItem('viewRaw', val.toString()); },

  get liveLoad() { return localStorage.getItem('liveLoad') ? localStorage.getItem('liveLoad') === 'true' : false; },
  set liveLoad(val) { localStorage.setItem('liveLoad', val.toString()); },

  get dateShort() { return localStorage.getItem('dateShort') || 'YYYY/MM/DD'; },
  set dateShort(val) { localStorage.setItem('dateShort', val); },

  get dateLong() { return localStorage.getItem('dateLong') || 'dddd, MMMM Do, YYYY'; },
  set dateLong(val) { localStorage.setItem('dateLong', val); },

  get dateDivider() { return localStorage.getItem('dateDivider') || 'MMMM YYYY'; },
  set dateDivider(val) { localStorage.setItem('dateDivider', val); },

  get fontSize() { return localStorage.getItem('fontSize') || '16px'; },
  set fontSize(val) { localStorage.setItem('fontSize', val); },

  get slideDelay() { return parseInt(localStorage.getItem('slidedelay') || '2500'); },
  set slideDelay(val) { localStorage.setItem('slidedelay', val.toString()); },

  get topClasses() { return parseInt(localStorage.getItem('topClasses') || '25'); },
  set topClasses(val) { localStorage.setItem('topClasses', val.toString()); },

  get listDetailsWidth() { return parseInt(localStorage.getItem('listDetailsWidth') || '25'); },
  set listDetailsWidth(val) { localStorage.setItem('listDetailsWidth', val.toString()); },

  get lastUpdated() { return parseInt(localStorage.getItem('lastUpdated') || '0'); },
  set lastUpdated(val) { localStorage.setItem('lastUpdated', val.toString()); },

  get theme() { return parseInt(localStorage.getItem('theme') || '2'); },
  set theme(val) { localStorage.setItem('theme', val.toString()); },
};

export async function theme() {
  window.theme = window.themes[window.options.theme];
  log.debug(null, 'Options:', window.options);
  log.debug(null, `Theme: ${window.theme?.name} ${window.options.theme}`);
  if (!window.theme) return;
  document.documentElement.style.setProperty('--body', window.theme.body);
  document.documentElement.style.setProperty('--background', window.theme.background);
  document.documentElement.style.setProperty('--gradient', window.theme.gradient);
  document.documentElement.style.setProperty('--foreground', window.theme.foreground);
  document.documentElement.style.setProperty('--text', window.theme.text);
  document.documentElement.style.setProperty('--title', window.theme.title);
  document.documentElement.style.setProperty('--highlight', window.theme.highlight);
  document.documentElement.style.setProperty('--shadow', window.theme.shadow);
  document.documentElement.style.setProperty('--link', window.theme.link);
  document.documentElement.style.setProperty('--inactive', window.theme.inactive);
}

export async function done() {
  $('.navbarbutton').animate({ opacity: 1.0 }, 1000);
  $('#btn-user').prop('title', '');
  if (parent.location.href !== location.href) {
    $('#user').text('');
    $('#btn-user').hide();
  } else {
    $('#btn-user').prop('title', log.str(window.user));
  }
}

export { config as default };
