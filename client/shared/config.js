/* eslint-disable no-multi-spaces */

import $ from 'jquery';
import * as log from './log.js';

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
  // webgl configuration
  webgl: {
    // WEBGL_CHECK_NUMERICAL_PROBLEMS: false // Whether to check for numerical representation problems
    WEBGL_CPU_FORWARD: true, // Whether the WebGL backend will sometimes forward ops to the CPU
    WEBGL_FORCE_F16_TEXTURES: false, // Whether the WebGL backend will always use f16 textures for rendering
    // WEBGL_PACK_NORMALIZATION // Whether we will pack the batchnormalization op
    // WEBGL_PACK_CLIP // Whether we will pack the clip op
    WEBGL_PACK_DEPTHWISECONV: false, // Whether we will pack the depthwise conv op // TODO: https://github.com/tensorflow/tfjs/issues/1679
    // WEBGL_PACK_BINARY_OPERATIONS // Whether we will pack binary ops
    // WEBGL_PACK_UNARY_OPERATIONS // Whether we will pack unary ops
    // WEBGL_PACK_ARRAY_OPERATIONS // Whether we will pack array ops
    // WEBGL_PACK_IMAGE_OPERATIONS // Whether we will pack image ops
    // WEBGL_PACK_REDUCE // Whether we will pack reduce ops
    // WEBGL_LAZILY_UNPACK // Whether packed WebGL kernels lazily unpack their outputs
    // WEBGL_CONV_IM2COL // Whether we will use the im2col algorithm to speed up convolutions
    // WEBGL_MAX_TEXTURE_SIZE // The maximum texture dimension
    // WEBGL_MAX_TEXTURES_IN_SHADER // The maximum texture dimension
    // WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION: // The disjoint_query_timer extension version. 0: disabled, 1: EXT_disjoint_timer_query, 2: EXT_disjoint_timer_query_webgl2
    // WEBGL_FENCE_API_ENABLED // Whether the fence API is available
    // WEBGL_SIZE_UPLOAD_UNIFORM: // Tensors with size <= than this will be uploaded as uniforms, not textures. default 4
    WEBGL_DELETE_TEXTURE_THRESHOLD: Math.trunc(3.5 * 1024 * 1024 * 1024), // delete textures upon disposal is used memory is larger than this rather than making them available for reuse
  },
  ui: {
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
  human: {
    enabled: true,
    backend: 'webgl', // select tfjs backend to use
    console: true, // enable debugging output to console
    scoped: false, // enable scoped runs
    videoOptimized: true, // perform additional optimizations when input is video, must be disabled for images
    filter: {
      enabled: true, // enable image pre-processing filters
      return: true, // return processed canvas imagedata in result
      brightness: 0, // range: -1 (darken) to 1 (lighten)
      contrast: 0, // range: -1 (reduce contrast) to 1 (increase contrast)
      sharpness: 0, // range: 0 (no sharpening) to 1 (maximum sharpening)
      blur: 0, // range: 0 (no blur) to N (blur radius in pixels)
      saturation: 0, // range: -1 (reduce saturation) to 1 (increase saturation)
      hue: 0, // range: 0 (no change) to 360 (hue rotation in degrees)
      negative: false, // image negative
      sepia: false, // image sepia colors
      vintage: false, // image vintage colors
      kodachrome: false, // image kodachrome colors
      technicolor: false, // image technicolor colors
      polaroid: false, // image polaroid camera effect
      pixelate: 0, // range: 0 (no pixelate) to N (number of pixels to pixelate)
    },
    face: {
      enabled: true, // controls if specified modul is enabled
      detector: {
        modelPath: '/models/human/blazeface/back/model.json', // can be 'front' or 'back'.
        maxFaces: 10, // maximum number of faces detected in the input, should be set to the minimum number for performance
        skipFrames: 10, // how many frames to go without re-running the face bounding box detector, only used for video inputs
        minConfidence: 0.5, // threshold for discarding a prediction
        iouThreshold: 0.3, // threshold for deciding whether boxes overlap too much in non-maximum suppression
        scoreThreshold: 0.7, // threshold for deciding when to remove boxes based on score in non-maximum suppression
      },
      mesh: {
        enabled: true,
        modelPath: '/models/human/facemesh/model.json',
      },
      iris: {
        enabled: true,
        modelPath: '/models/human/iris/model.json',
        enlargeFactor: 2.3, // empiric tuning
      },
      age: {
        enabled: true,
        modelPath: '/models/human/ssrnet-age/imdb/model.json', // can be 'imdb' or 'wiki'
        skipFrames: 10, // how many frames to go without re-running the detector, only used for video inputs
      },
      gender: {
        enabled: true,
        minConfidence: 0.8, // threshold for discarding a prediction
        modelPath: '/models/human/ssrnet-gender/imdb/model.json',
      },
      emotion: {
        enabled: true,
        minConfidence: 0.5, // threshold for discarding a prediction
        skipFrames: 10, // how many frames to go without re-running the detector
        modelPath: '/models/human/emotion/model.json',
      },
    },
    body: {
      enabled: true,
      modelPath: '/models/human/posenet/model.json',
      maxDetections: 10, // maximum number of people detected in the input, should be set to the minimum number for performance
      scoreThreshold: 0.7, // threshold for deciding when to remove boxes based on score in non-maximum suppression
      nmsRadius: 20, // radius for deciding points are too close in non-maximum suppression
    },
    hand: {
      enabled: true,
      skipFrames: 10, // how many frames to go without re-running the hand bounding box detector, only used for video inputs
      // if model is running st 25 FPS, we can re-use existing bounding box for updated hand skeleton analysis
      // as the hand probably hasn't moved much in short time (10 * 1/25 = 0.25 sec)
      minConfidence: 0.5, // threshold for discarding a prediction
      iouThreshold: 0.3, // threshold for deciding whether boxes overlap too much in non-maximum suppression
      scoreThreshold: 0.7, // threshold for deciding when to remove boxes based on score in non-maximum suppression
      enlargeFactor: 1.65, // empiric tuning as skeleton prediction prefers hand box with some whitespace
      maxHands: 10, // maximum number of hands detected in the input, should be set to the minimum number for performance
      detector: {
        anchors: '/models/human/handdetect/anchors.json',
        modelPath: '/models/human/handdetect/model.json',
      },
      skeleton: {
        modelPath: '/models/human/handskeleton/model.json',
      },
    },
  },
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
window.options = {
  get listItemCount() { return parseInt(localStorage.getItem('listItemCount') || 500); },
  set listItemCount(val) { return localStorage.setItem('listItemCount', val); },

  get cacheModels() { return localStorage.getItem('cacheModels') ? localStorage.getItem('cacheModels') === 'true' : true; },
  set cacheModels(val) { return localStorage.setItem('cacheModels', val); },

  get cacheAssets() { return localStorage.getItem('cacheAssets') ? localStorage.getItem('cacheAssets') === 'true' : true; },
  set cacheAssets(val) { return localStorage.setItem('cacheAssets', val); },

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

  get listLimit() { return parseInt(localStorage.getItem('listLimit') || 100000); },
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

async function initTheme() {
  window.theme = window.themes[window.options.theme];
  if (!window.theme) return;
  log.debug(null, `Theme: ${window.theme.name}`);
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

async function doneLoading() {
  $('.navbarbutton').animate({ opacity: 1.0 }, 1000);
  $('#btn-user').prop('title', '');
  if (parent.location.href !== location.href) {
    $('#user').text('');
    $('#btn-user').hide();
  } else {
    $('#btn-user').prop('title', log.str(window.user));
  }
}

exports.default = config;
exports.theme = initTheme;
exports.done = doneLoading;
