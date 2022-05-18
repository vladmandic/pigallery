/* eslint-disable no-multi-spaces */

import $ from 'jquery';
import * as log from './log';
import { user } from './user';

// TFJS Configuration
const config = {
  backEnd: 'webgl',        // back-end used by tensorflow for image processing: webgl, cpu, wasm, webgpu
  maxSize: 720,            // maximum image width or height that will be used for processing before resizing is required
  renderThumbnail: 230,    // resolution in which to store image thumbnail embedded in result set
  batchProcessing: 1,      // how many images to process in parallel
  squareImage: false,      // resize proportional to the original image or to a square image
  registerPWA: true,       // register PWA service worker?
  facing: true,            // webcam facing front or back
  memory: false,           // set webgl memory hard limit
  autoreload: true,        // auto reload processing window on error
  floatPrecision: true,    // use 32-bit float precision
  downloadChunkSize: 200,  // number of records downloaded in each chunk
  namesThumbSize: 96,      // size of person thumbnail
  cacheAssets: true,       // pwa setting
  cacheMedia: false,       // pwa setting
  cacheModels: false,      // pwa setting
  mediaRoot: '/media/',    // pwa setting
  modelsRoot: '/models/',  // pwa setting
  // webgl configuration
  webgl: {
    // WEBGL_DELETE_TEXTURE_THRESHOLD: 0, // delete textures upon disposal is used memory is larger than this rather than making them available for reuse // Math.trunc(3.5 * 1024 * 1024 * 1024)
    WEBGL_FORCE_F16_TEXTURES: false, // Whether the WebGL backend will always use f16 textures for rendering, can cause overflows on some models
    WEBGL_PACK_DEPTHWISECONV: false, // Whether we will pack the depthwise conv op // TODO: https://github.com/tensorflow/tfjs/issues/1679
    WEBGL_CPU_FORWARD: true, // Whether to perform small ops on CPU instead of uploading to GPU
    WEBGL_USE_SHAPES_UNIFORMS: true, // Experimental, use uniforms for WebGL shaders where possible

    // WEBGL_CHECK_NUMERICAL_PROBLEMS // Whether to check for numerical representation problems
    // WEBGL_CONV_IM2COL // Whether we will use the im2col algorithm to speed up convolutions
    // WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION: // The disjoint_query_timer extension version. 0: disabled, 1: EXT_disjoint_timer_query, 2: EXT_disjoint_timer_query_webgl2
    // WEBGL_FENCE_API_ENABLED // Whether the fence API is available
    // WEBGL_LAZILY_UNPACK // Whether packed WebGL kernels lazily unpack their outputs
    // WEBGL_MAX_TEXTURE_SIZE // The maximum texture dimension
    // WEBGL_MAX_TEXTURES_IN_SHADER // The maximum texture dimension
    // WEBGL_SIZE_UPLOAD_UNIFORM: // Tensors with size <= than this will be uploaded as uniforms, not textures. default 4
    // WEBGL_PACK_ARRAY_OPERATIONS // Whether we will pack array ops
    // WEBGL_PACK_BINARY_OPERATIONS // Whether we will pack binary ops
    // WEBGL_PACK_CLIP // Whether we will pack the clip op
    // WEBGL_PACK_IMAGE_OPERATIONS // Whether we will pack image ops
    // WEBGL_PACK_NORMALIZATION // Whether we will pack the batchnormalization op
    // WEBGL_PACK_REDUCE // Whether we will pack reduce ops
    // WEBGL_PACK_UNARY_OPERATIONS // Whether we will pack unary ops
  },
  ui: {
    scale: 100,
    maxFrames: 10,
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
  classify: <any>{},
  detect: <any>{},
  human: <any>{ },
  models: { classify: <any>[], detect: <any>[], various: <any>[], person: {}, initial: true },
};

function colorHex(str) {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = str;
  return ctx.fillStyle;
}

// eslint-disable-next-line import/no-mutable-exports
let theme;

const themes = [
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
    body: 'rgba(60, 60, 60, 1.0)',
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
const options = {
  get listItemCount() { return parseInt(localStorage.getItem('listItemCount') || '100'); },
  set listItemCount(val) { localStorage.setItem('listItemCount', val.toString()); },

  get listFolders() { return localStorage.getItem('listFolders') ? localStorage.getItem('listFolders') === 'true' : true; },
  set listFolders(val) { localStorage.setItem('listFolders', val.toString()); },

  get listDetails() { return localStorage.getItem('listDetails') ? localStorage.getItem('listDetails') === 'true' : false; },
  set listDetails(val) { localStorage.setItem('listDetails', val.toString()); },

  get listDivider() { return localStorage.getItem('listDivider') || 'month'; },
  set listDivider(val) { localStorage.setItem('listDivider', val); },

  get listSortOrder() { return localStorage.getItem('listSortOrder') || 'numeric-down'; },
  set listSortOrder(val) { localStorage.setItem('listSortOrder', val); },

  get fixWidth() { return localStorage.getItem('fixWidth') ? localStorage.getItem('fixWidth') === 'true' : false; },
  set fixWidth(val) { localStorage.setItem('fixWidth', val.toString()); },

  get fixHeight() { return localStorage.getItem('fixHeight') ? localStorage.getItem('fixHeight') === 'true' : true; },
  set fixHeight(val) { localStorage.setItem('fixHeight', val.toString()); },

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

async function setTheme(name = null) {
  theme = name ? themes[name || 0] : themes[options.theme];
  log.debug('Options:', options);
  log.debug(`Theme: ${theme?.name} ${options.theme}`);
  if (!theme) return;
  document.documentElement.style.setProperty('--body', theme.body);
  document.documentElement.style.setProperty('--background', theme.background);
  document.documentElement.style.setProperty('--gradient', theme.gradient);
  document.documentElement.style.setProperty('--foreground', theme.foreground);
  document.documentElement.style.setProperty('--text', theme.text);
  document.documentElement.style.setProperty('--title', theme.title);
  document.documentElement.style.setProperty('--highlight', theme.highlight);
  document.documentElement.style.setProperty('--shadow', theme.shadow);
  document.documentElement.style.setProperty('--link', theme.link);
  document.documentElement.style.setProperty('--inactive', theme.inactive);
  document.documentElement.style.setProperty('--thumbSize', `${options.listThumbSize}`);
  document.documentElement.style.setProperty('--fontSize', options.fontSize);
}

async function done() {
  $('.navbarbutton').animate({ opacity: 1.0 }, 1000);
  $('#btn-user').prop('title', '');
  if (parent.location.href !== location.href) {
    $('#user').text('');
    $('#btn-user').hide();
  } else {
    $('#btn-user').prop('title', log.str(user));
  }
}

export {
  // eslint-disable-next-line no-restricted-exports
  config as default,
  setTheme,
  themes,
  theme,
  options,
  done,
};
