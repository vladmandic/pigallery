const __commonJS = (callback, module) => () => {
  if (!module) {
    module = { exports: {} };
    callback(module.exports, module);
  }
  return module.exports;
};

// node_modules/wheel/index.js
const require_wheel = __commonJS((exports, module) => {
  module.exports = addWheelListener;
  module.exports.addWheelListener = addWheelListener;
  module.exports.removeWheelListener = removeWheelListener;
  function addWheelListener(element, listener, useCapture) {
    element.addEventListener('wheel', listener, useCapture);
  }
  function removeWheelListener(element, listener, useCapture) {
    element.removeEventListener('wheel', listener, useCapture);
  }
});

// node_modules/bezier-easing/src/index.js
const require_src = __commonJS((exports, module) => {
  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 1e-3;
  const SUBDIVISION_PRECISION = 1e-7;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const kSplineTableSize = 11;
  const kSampleStepSize = 1 / (kSplineTableSize - 1);
  const float32ArraySupported = typeof Float32Array === 'function';
  function A(aA1, aA2) {
    return 1 - 3 * aA2 + 3 * aA1;
  }
  function B(aA1, aA2) {
    return 3 * aA2 - 6 * aA1;
  }
  function C(aA1) {
    return 3 * aA1;
  }
  function calcBezier(aT, aA1, aA2) {
    return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
  }
  function getSlope(aT, aA1, aA2) {
    return 3 * A(aA1, aA2) * aT * aT + 2 * B(aA1, aA2) * aT + C(aA1);
  }
  function binarySubdivide(aX, aA, aB, mX1, mX2) {
    let currentX; let currentT; let
      i = 0;
    do {
      currentT = aA + (aB - aA) / 2;
      currentX = calcBezier(currentT, mX1, mX2) - aX;
      if (currentX > 0) {
        aB = currentT;
      } else {
        aA = currentT;
      }
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  }
  function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
    for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
      const currentSlope = getSlope(aGuessT, mX1, mX2);
      if (currentSlope === 0) {
        return aGuessT;
      }
      const currentX = calcBezier(aGuessT, mX1, mX2) - aX;
      aGuessT -= currentX / currentSlope;
    }
    return aGuessT;
  }
  function LinearEasing(x) {
    return x;
  }
  module.exports = function bezier(mX1, mY1, mX2, mY2) {
    if (!(mX1 >= 0 && mX1 <= 1 && mX2 >= 0 && mX2 <= 1)) {
      throw new Error('bezier x values must be in [0, 1] range');
    }
    if (mX1 === mY1 && mX2 === mY2) {
      return LinearEasing;
    }
    const sampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
    for (let i = 0; i < kSplineTableSize; ++i) {
      sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
    }
    function getTForX(aX) {
      let intervalStart = 0;
      let currentSample = 1;
      const lastSample = kSplineTableSize - 1;
      for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
        intervalStart += kSampleStepSize;
      }
      --currentSample;
      const dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      const guessForT = intervalStart + dist * kSampleStepSize;
      const initialSlope = getSlope(guessForT, mX1, mX2);
      if (initialSlope >= NEWTON_MIN_SLOPE) {
        return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
      } if (initialSlope === 0) {
        return guessForT;
      }
      return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
    }
    return function BezierEasing(x) {
      if (x === 0) {
        return 0;
      }
      if (x === 1) {
        return 1;
      }
      return calcBezier(getTForX(x), mY1, mY2);
    };
  };
});

// node_modules/amator/index.js
const require_amator = __commonJS((exports, module) => {
  const BezierEasing = require_src();
  const animations = {
    ease: BezierEasing(0.25, 0.1, 0.25, 1),
    easeIn: BezierEasing(0.42, 0, 1, 1),
    easeOut: BezierEasing(0, 0, 0.58, 1),
    easeInOut: BezierEasing(0.42, 0, 0.58, 1),
    linear: BezierEasing(0, 0, 1, 1),
  };
  module.exports = animate;
  module.exports.makeAggregateRaf = makeAggregateRaf;
  module.exports.sharedScheduler = makeAggregateRaf();
  function animate(source, target, panZoomOptions) {
    const start = Object.create(null);
    const diff = Object.create(null);
    panZoomOptions = panZoomOptions || {};
    let easing = typeof panZoomOptions.easing === 'function' ? panZoomOptions.easing : animations[panZoomOptions.easing];
    if (!easing) {
      if (panZoomOptions.easing) {
        console.warn(`Unknown easing function in amator: ${panZoomOptions.easing}`);
      }
      easing = animations.ease;
    }
    const step = typeof panZoomOptions.step === 'function' ? panZoomOptions.step : noop;
    const done = typeof panZoomOptions.done === 'function' ? panZoomOptions.done : noop;
    const scheduler = getScheduler(panZoomOptions.scheduler);
    const keys = Object.keys(target);
    keys.forEach((key) => {
      start[key] = source[key];
      diff[key] = target[key] - source[key];
    });
    const durationInMs = typeof panZoomOptions.duration === 'number' ? panZoomOptions.duration : 400;
    const durationInFrames = Math.max(1, durationInMs * 0.06);
    let previousAnimationId;
    let frame = 0;
    previousAnimationId = scheduler.next(loop);
    return {
      cancel,
    };
    function cancel() {
      scheduler.cancel(previousAnimationId);
      previousAnimationId = 0;
    }
    function loop() {
      const t = easing(frame / durationInFrames);
      frame += 1;
      setValues(t);
      if (frame <= durationInFrames) {
        previousAnimationId = scheduler.next(loop);
        step(source);
      } else {
        previousAnimationId = 0;
        setTimeout(() => {
          done(source);
        }, 0);
      }
    }
    function setValues(t) {
      keys.forEach((key) => {
        source[key] = diff[key] * t + start[key];
      });
    }
  }
  function noop() {
  }
  function getScheduler(scheduler) {
    if (!scheduler) {
      const canRaf = typeof window !== 'undefined' && window.requestAnimationFrame;
      return canRaf ? rafScheduler() : timeoutScheduler();
    }
    if (typeof scheduler.next !== 'function') throw new Error('Scheduler is supposed to have next(cb) function');
    if (typeof scheduler.cancel !== 'function') throw new Error('Scheduler is supposed to have cancel(handle) function');
    return scheduler;
  }
  function rafScheduler() {
    return {
      next: window.requestAnimationFrame.bind(window),
      cancel: window.cancelAnimationFrame.bind(window),
    };
  }
  function timeoutScheduler() {
    return {
      next(cb) {
        return setTimeout(cb, 1e3 / 60);
      },
      cancel(id) {
        return clearTimeout(id);
      },
    };
  }
  function makeAggregateRaf() {
    let frontBuffer = new Set();
    let backBuffer = new Set();
    let frameToken = 0;
    return {
      next,
      cancel: next,
      clearAll,
    };
    function clearAll() {
      frontBuffer.clear();
      backBuffer.clear();
      cancelAnimationFrame(frameToken);
      frameToken = 0;
    }
    function next(callback) {
      backBuffer.add(callback);
      renderNextFrame();
    }
    function renderNextFrame() {
      if (!frameToken) frameToken = requestAnimationFrame(renderFrame);
    }
    function renderFrame() {
      frameToken = 0;
      const t = backBuffer;
      backBuffer = frontBuffer;
      frontBuffer = t;
      frontBuffer.forEach((callback) => {
        callback();
      });
      frontBuffer.clear();
    }
    function cancel(callback) {
      backBuffer.delete(callback);
    }
  }
});

// node_modules/ngraph.events/index.js
const require_ngraph = __commonJS((exports, module) => {
  module.exports = function eventify(subject) {
    validateSubject(subject);
    const eventsStorage = createEventsStorage(subject);
    subject.on = eventsStorage.on;
    subject.off = eventsStorage.off;
    subject.fire = eventsStorage.fire;
    return subject;
  };
  function createEventsStorage(subject) {
    let registeredEvents = Object.create(null);
    return {
      on(eventName, callback, ctx) {
        if (typeof callback !== 'function') {
          throw new Error('callback is expected to be a function');
        }
        let handlers = registeredEvents[eventName];
        if (!handlers) {
          handlers = registeredEvents[eventName] = [];
        }
        handlers.push({ callback, ctx });
        return subject;
      },
      off(eventName, callback) {
        const wantToRemoveAll = typeof eventName === 'undefined';
        if (wantToRemoveAll) {
          registeredEvents = Object.create(null);
          return subject;
        }
        if (registeredEvents[eventName]) {
          const deleteAllCallbacksForEvent = typeof callback !== 'function';
          if (deleteAllCallbacksForEvent) {
            delete registeredEvents[eventName];
          } else {
            const callbacks = registeredEvents[eventName];
            for (let i = 0; i < callbacks.length; ++i) {
              if (callbacks[i].callback === callback) {
                callbacks.splice(i, 1);
              }
            }
          }
        }
        return subject;
      },
      fire(eventName) {
        const callbacks = registeredEvents[eventName];
        if (!callbacks) {
          return subject;
        }
        let fireArguments;
        if (arguments.length > 1) {
          fireArguments = Array.prototype.splice.call(arguments, 1);
        }
        for (let i = 0; i < callbacks.length; ++i) {
          const callbackInfo = callbacks[i];
          callbackInfo.callback.apply(callbackInfo.ctx, fireArguments);
        }
        return subject;
      },
    };
  }
  function validateSubject(subject) {
    if (!subject) {
      throw new Error('Eventify cannot use falsy object as events subject');
    }
    const reservedWords = ['on', 'fire', 'off'];
    for (let i = 0; i < reservedWords.length; ++i) {
      if (subject.hasOwnProperty(reservedWords[i])) {
        throw new Error(`Subject cannot be eventified, since it already has property '${reservedWords[i]}'`);
      }
    }
  }
});

// lib/kinetic.js
const require_kinetic = __commonJS((exports, module) => {
  module.exports = kinetic;
  function kinetic(getPoint, scroll, settings) {
    if (typeof settings !== 'object') {
      settings = {};
    }
    const minVelocity = typeof settings.minVelocity === 'number' ? settings.minVelocity : 5;
    const amplitude = typeof settings.amplitude === 'number' ? settings.amplitude : 0.25;
    const cancelAnimationFrame2 = typeof settings.cancelAnimationFrame === 'function' ? settings.cancelAnimationFrame : getCancelAnimationFrame();
    const requestAnimationFrame2 = typeof settings.requestAnimationFrame === 'function' ? settings.requestAnimationFrame : getRequestAnimationFrame();
    let lastPoint;
    let timestamp;
    const timeConstant = 342;
    let ticker;
    let vx; let targetX; let
      ax;
    let vy; let targetY; let
      ay;
    let raf;
    return {
      start,
      stop,
      cancel: dispose,
    };
    function dispose() {
      cancelAnimationFrame2(ticker);
      cancelAnimationFrame2(raf);
    }
    function start() {
      lastPoint = getPoint();
      ax = ay = vx = vy = 0;
      timestamp = new Date();
      cancelAnimationFrame2(ticker);
      cancelAnimationFrame2(raf);
      ticker = requestAnimationFrame2(track);
    }
    function track() {
      const now = Date.now();
      const elapsed = now - timestamp;
      timestamp = now;
      const currentPoint = getPoint();
      const dx = currentPoint.x - lastPoint.x;
      const dy = currentPoint.y - lastPoint.y;
      lastPoint = currentPoint;
      const dt = 1e3 / (1 + elapsed);
      vx = 0.8 * dx * dt + 0.2 * vx;
      vy = 0.8 * dy * dt + 0.2 * vy;
      ticker = requestAnimationFrame2(track);
    }
    function stop() {
      cancelAnimationFrame2(ticker);
      cancelAnimationFrame2(raf);
      const currentPoint = getPoint();
      targetX = currentPoint.x;
      targetY = currentPoint.y;
      timestamp = Date.now();
      if (vx < -minVelocity || vx > minVelocity) {
        ax = amplitude * vx;
        targetX += ax;
      }
      if (vy < -minVelocity || vy > minVelocity) {
        ay = amplitude * vy;
        targetY += ay;
      }
      raf = requestAnimationFrame2(autoScroll);
    }
    function autoScroll() {
      const elapsed = Date.now() - timestamp;
      let moving = false;
      let dx = 0;
      let dy = 0;
      if (ax) {
        dx = -ax * Math.exp(-elapsed / timeConstant);
        if (dx > 0.5 || dx < -0.5) moving = true;
        else dx = ax = 0;
      }
      if (ay) {
        dy = -ay * Math.exp(-elapsed / timeConstant);
        if (dy > 0.5 || dy < -0.5) moving = true;
        else dy = ay = 0;
      }
      if (moving) {
        scroll(targetX + dx, targetY + dy);
        raf = requestAnimationFrame2(autoScroll);
      }
    }
  }
  function getCancelAnimationFrame() {
    if (typeof cancelAnimationFrame === 'function') return cancelAnimationFrame;
    return clearTimeout;
  }
  function getRequestAnimationFrame() {
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame;
    return function (handler) {
      return setTimeout(handler, 16);
    };
  }
});

// lib/createTextSelectionInterceptor.js
const require_createTextSelectionInterceptor = __commonJS((exports, module) => {
  module.exports = createTextSelectionInterceptor;
  function createTextSelectionInterceptor(useFake) {
    if (useFake) {
      return {
        capture: noop,
        release: noop,
      };
    }
    let dragObject;
    let prevSelectStart;
    let prevDragStart;
    let wasCaptured = false;
    return {
      capture,
      release,
    };
    function capture(domObject) {
      wasCaptured = true;
      prevSelectStart = window.document.onselectstart;
      prevDragStart = window.document.ondragstart;
      window.document.onselectstart = disabled;
      dragObject = domObject;
      dragObject.ondragstart = disabled;
    }
    function release() {
      if (!wasCaptured) return;
      wasCaptured = false;
      window.document.onselectstart = prevSelectStart;
      if (dragObject) dragObject.ondragstart = prevDragStart;
    }
  }
  function disabled(e) {
    e.stopPropagation();
    return false;
  }
  function noop() {
  }
});

// lib/transform.js
const require_transform = __commonJS((exports, module) => {
  module.exports = Transform;
  function Transform() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
  }
});

// lib/svgController.js
const require_svgController = __commonJS((exports, module) => {
  module.exports = makeSvgController;
  module.exports.canAttach = isSVGElement;
  function makeSvgController(svgElement, options) {
    if (!isSVGElement(svgElement)) {
      throw new Error('svg element is required for svg.panzoom to work');
    }
    const owner = svgElement.ownerSVGElement;
    if (!owner) {
      throw new Error('Do not apply panzoom to the root <svg> element. Use its child instead (e.g. <g></g>). As of March 2016 only FireFox supported transform on the root element');
    }
    if (!options.disableKeyboardInteraction) {
      owner.setAttribute('tabindex', 0);
    }
    const api = {
      getBBox,
      getScreenCTM,
      getOwner,
      applyTransform,
      initTransform,
    };
    return api;
    function getOwner() {
      return owner;
    }
    function getBBox() {
      const bbox = svgElement.getBBox();
      return {
        left: bbox.x,
        top: bbox.y,
        width: bbox.width,
        height: bbox.height,
      };
    }
    function getScreenCTM() {
      const ctm = owner.getCTM();
      if (!ctm) {
        return owner.getScreenCTM();
      }
      return ctm;
    }
    function initTransform(transform) {
      let screenCTM = svgElement.getCTM();
      if (screenCTM === null) {
        screenCTM = document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGMatrix();
      }
      transform.x = screenCTM.e;
      transform.y = screenCTM.f;
      transform.scale = screenCTM.a;
      owner.removeAttributeNS(null, 'viewBox');
    }
    function applyTransform(transform) {
      svgElement.setAttribute('transform', `matrix(${transform.scale} 0 0 ${transform.scale} ${transform.x} ${transform.y})`);
    }
  }
  function isSVGElement(element) {
    return element && element.ownerSVGElement && element.getCTM;
  }
});

// lib/domController.js
const require_domController = __commonJS((exports, module) => {
  module.exports = makeDomController;
  module.exports.canAttach = isDomElement;
  function makeDomController(domElement, options) {
    const elementValid = isDomElement(domElement);
    if (!elementValid) {
      throw new Error('panzoom requires DOM element to be attached to the DOM tree');
    }
    const owner = domElement.parentElement;
    domElement.scrollTop = 0;
    if (!options.disableKeyboardInteraction) {
      owner.setAttribute('tabindex', 0);
    }
    const api = {
      getBBox,
      getOwner,
      applyTransform,
    };
    return api;
    function getOwner() {
      return owner;
    }
    function getBBox() {
      return {
        left: 0,
        top: 0,
        width: domElement.clientWidth,
        height: domElement.clientHeight,
      };
    }
    function applyTransform(transform) {
      domElement.style.transformOrigin = '0 0 0';
      domElement.style.transform = `matrix(${transform.scale}, 0, 0, ${transform.scale}, ${transform.x}, ${transform.y})`;
    }
  }
  function isDomElement(element) {
    return element && element.parentElement && element.style;
  }
});

// index.js
const require_panzoom = __commonJS((exports, module) => {
  const wheel = require_wheel();
  const animate = require_amator();
  const eventify = require_ngraph();
  const kinetic = require_kinetic();
  const createTextSelectionInterceptor = require_createTextSelectionInterceptor();
  const domTextSelectionInterceptor = createTextSelectionInterceptor();
  const fakeTextSelectorInterceptor = createTextSelectionInterceptor(true);
  const Transform = require_transform();
  const makeSvgController = require_svgController();
  const makeDomController = require_domController();
  const defaultZoomSpeed = 1;
  const defaultDoubleTapZoomSpeed = 1.75;
  const doubleTapSpeedInMS = 300;
  module.exports = createPanZoom;
  function createPanZoom(domElement, options) {
    options = options || {};
    let panController = options.controller;
    if (!panController) {
      if (makeSvgController.canAttach(domElement)) {
        panController = makeSvgController(domElement, options);
      } else if (makeDomController.canAttach(domElement)) {
        panController = makeDomController(domElement, options);
      }
    }
    if (!panController) {
      throw new Error('Cannot create panzoom for the current type of dom element');
    }
    const owner = panController.getOwner();
    const storedCTMResult = { x: 0, y: 0 };
    let isDirty = false;
    const transform = new Transform();
    if (panController.initTransform) {
      panController.initTransform(transform);
    }
    const filterKey = typeof options.filterKey === 'function' ? options.filterKey : noop;
    const pinchSpeed = typeof options.pinchSpeed === 'number' ? options.pinchSpeed : 1;
    const { bounds } = options;
    let maxZoom = typeof options.maxZoom === 'number' ? options.maxZoom : Number.POSITIVE_INFINITY;
    let minZoom = typeof options.minZoom === 'number' ? options.minZoom : 0;
    const boundsPadding = typeof options.boundsPadding === 'number' ? options.boundsPadding : 0.05;
    const zoomDoubleClickSpeed = typeof options.zoomDoubleClickSpeed === 'number' ? options.zoomDoubleClickSpeed : defaultDoubleTapZoomSpeed;
    const beforeWheel = options.beforeWheel || noop;
    const beforeMouseDown = options.beforeMouseDown || noop;
    let speed = typeof options.zoomSpeed === 'number' ? options.zoomSpeed : defaultZoomSpeed;
    let transformOrigin = parseTransformOrigin(options.transformOrigin);
    const textSelection = options.enableTextSelection ? fakeTextSelectorInterceptor : domTextSelectionInterceptor;
    validateBounds(bounds);
    if (options.autocenter) {
      autocenter();
    }
    let frameAnimation;
    let lastTouchEndTime = 0;
    let lastSingleFingerOffset;
    let touchInProgress = false;
    let panstartFired = false;
    let mouseX;
    let mouseY;
    let pinchZoomLength;
    let smoothScroll;
    if ('smoothScroll' in options && !options.smoothScroll) {
      smoothScroll = rigidScroll();
    } else {
      smoothScroll = kinetic(getPoint, scroll, options.smoothScroll);
    }
    let moveByAnimation;
    let zoomToAnimation;
    let multiTouch;
    let paused = false;
    listenForEvents();
    const api = {
      dispose,
      moveBy: internalMoveBy,
      moveTo,
      smoothMoveTo,
      centerOn,
      zoomTo: publicZoomTo,
      zoomAbs,
      smoothZoom,
      smoothZoomAbs,
      showRectangle,
      pause,
      resume,
      isPaused,
      getTransform: getTransformModel,
      getMinZoom,
      setMinZoom,
      getMaxZoom,
      setMaxZoom,
      getTransformOrigin,
      setTransformOrigin,
      getZoomSpeed,
      setZoomSpeed,
    };
    eventify(api);
    const initialX = typeof options.initialX === 'number' ? options.initialX : transform.x;
    const initialY = typeof options.initialY === 'number' ? options.initialY : transform.y;
    const initialZoom = typeof options.initialZoom === 'number' ? options.initialZoom : transform.scale;
    if (initialX != transform.x || initialY != transform.y || initialZoom != transform.Scale) {
      zoomAbs(initialX, initialY, initialZoom);
    }
    return api;
    function pause() {
      releaseEvents();
      paused = true;
    }
    function resume() {
      if (paused) {
        listenForEvents();
        paused = false;
      }
    }
    function isPaused() {
      return paused;
    }
    function showRectangle(rect) {
      const clientRect = owner.getBoundingClientRect();
      const size = transformToScreen(clientRect.width, clientRect.height);
      const rectWidth = rect.right - rect.left;
      const rectHeight = rect.bottom - rect.top;
      if (!Number.isFinite(rectWidth) || !Number.isFinite(rectHeight)) {
        throw new Error('Invalid rectangle');
      }
      const dw = size.x / rectWidth;
      const dh = size.y / rectHeight;
      const scale = Math.min(dw, dh);
      transform.x = -(rect.left + rectWidth / 2) * scale + size.x / 2;
      transform.y = -(rect.top + rectHeight / 2) * scale + size.y / 2;
      transform.scale = scale;
    }
    function transformToScreen(x, y) {
      if (panController.getScreenCTM) {
        const parentCTM = panController.getScreenCTM();
        const parentScaleX = parentCTM.a;
        const parentScaleY = parentCTM.d;
        const parentOffsetX = parentCTM.e;
        const parentOffsetY = parentCTM.f;
        storedCTMResult.x = x * parentScaleX - parentOffsetX;
        storedCTMResult.y = y * parentScaleY - parentOffsetY;
      } else {
        storedCTMResult.x = x;
        storedCTMResult.y = y;
      }
      return storedCTMResult;
    }
    function autocenter() {
      let w;
      let h;
      let left = 0;
      let top = 0;
      const sceneBoundingBox = getBoundingBox();
      if (sceneBoundingBox) {
        left = sceneBoundingBox.left;
        top = sceneBoundingBox.top;
        w = sceneBoundingBox.right - sceneBoundingBox.left;
        h = sceneBoundingBox.bottom - sceneBoundingBox.top;
      } else {
        const ownerRect = owner.getBoundingClientRect();
        w = ownerRect.width;
        h = ownerRect.height;
      }
      const bbox = panController.getBBox();
      if (bbox.width === 0 || bbox.height === 0) {
        return;
      }
      const dh = h / bbox.height;
      const dw = w / bbox.width;
      const scale = Math.min(dw, dh);
      transform.x = -(bbox.left + bbox.width / 2) * scale + w / 2 + left;
      transform.y = -(bbox.top + bbox.height / 2) * scale + h / 2 + top;
      transform.scale = scale;
    }
    function getTransformModel() {
      return transform;
    }
    function getMinZoom() {
      return minZoom;
    }
    function setMinZoom(newMinZoom) {
      minZoom = newMinZoom;
    }
    function getMaxZoom() {
      return maxZoom;
    }
    function setMaxZoom(newMaxZoom) {
      maxZoom = newMaxZoom;
    }
    function getTransformOrigin() {
      return transformOrigin;
    }
    function setTransformOrigin(newTransformOrigin) {
      transformOrigin = parseTransformOrigin(newTransformOrigin);
    }
    function getZoomSpeed() {
      return speed;
    }
    function setZoomSpeed(newSpeed) {
      if (!Number.isFinite(newSpeed)) {
        throw new Error('Zoom speed should be a number');
      }
      speed = newSpeed;
    }
    function getPoint() {
      return {
        x: transform.x,
        y: transform.y,
      };
    }
    function moveTo(x, y) {
      transform.x = x;
      transform.y = y;
      keepTransformInsideBounds();
      triggerEvent('pan');
      makeDirty();
    }
    function moveBy(dx, dy) {
      moveTo(transform.x + dx, transform.y + dy);
    }
    function keepTransformInsideBounds() {
      const boundingBox = getBoundingBox();
      if (!boundingBox) return;
      let adjusted = false;
      const clientRect = getClientRect();
      let diff = boundingBox.left - clientRect.right;
      if (diff > 0) {
        transform.x += diff;
        adjusted = true;
      }
      diff = boundingBox.right - clientRect.left;
      if (diff < 0) {
        transform.x += diff;
        adjusted = true;
      }
      diff = boundingBox.top - clientRect.bottom;
      if (diff > 0) {
        transform.y += diff;
        adjusted = true;
      }
      diff = boundingBox.bottom - clientRect.top;
      if (diff < 0) {
        transform.y += diff;
        adjusted = true;
      }
      return adjusted;
    }
    function getBoundingBox() {
      if (!bounds) return;
      if (typeof bounds === 'boolean') {
        const ownerRect = owner.getBoundingClientRect();
        const sceneWidth = ownerRect.width;
        const sceneHeight = ownerRect.height;
        return {
          left: sceneWidth * boundsPadding,
          top: sceneHeight * boundsPadding,
          right: sceneWidth * (1 - boundsPadding),
          bottom: sceneHeight * (1 - boundsPadding),
        };
      }
      return bounds;
    }
    function getClientRect() {
      const bbox = panController.getBBox();
      const leftTop = client(bbox.left, bbox.top);
      return {
        left: leftTop.x,
        top: leftTop.y,
        right: bbox.width * transform.scale + leftTop.x,
        bottom: bbox.height * transform.scale + leftTop.y,
      };
    }
    function client(x, y) {
      return {
        x: x * transform.scale + transform.x,
        y: y * transform.scale + transform.y,
      };
    }
    function makeDirty() {
      isDirty = true;
      frameAnimation = window.requestAnimationFrame(frame);
    }
    function zoomByRatio(clientX, clientY, ratio) {
      if (isNaN(clientX) || isNaN(clientY) || isNaN(ratio)) {
        throw new Error('zoom requires valid numbers');
      }
      const newScale = transform.scale * ratio;
      if (newScale < minZoom) {
        if (transform.scale === minZoom) return;
        ratio = minZoom / transform.scale;
      }
      if (newScale > maxZoom) {
        if (transform.scale === maxZoom) return;
        ratio = maxZoom / transform.scale;
      }
      const size = transformToScreen(clientX, clientY);
      transform.x = size.x - ratio * (size.x - transform.x);
      transform.y = size.y - ratio * (size.y - transform.y);
      if (bounds && boundsPadding === 1 && minZoom === 1) {
        transform.scale *= ratio;
        keepTransformInsideBounds();
      } else {
        const transformAdjusted = keepTransformInsideBounds();
        if (!transformAdjusted) transform.scale *= ratio;
      }
      triggerEvent('zoom');
      makeDirty();
    }
    function zoomAbs(clientX, clientY, zoomLevel) {
      const ratio = zoomLevel / transform.scale;
      zoomByRatio(clientX, clientY, ratio);
    }
    function centerOn(ui) {
      const parent = ui.ownerSVGElement;
      if (!parent) throw new Error('ui element is required to be within the scene');
      const clientRect = ui.getBoundingClientRect();
      const cx = clientRect.left + clientRect.width / 2;
      const cy = clientRect.top + clientRect.height / 2;
      const container = parent.getBoundingClientRect();
      const dx = container.width / 2 - cx;
      const dy = container.height / 2 - cy;
      internalMoveBy(dx, dy, true);
    }
    function smoothMoveTo(x, y) {
      internalMoveBy(x - transform.x, y - transform.y, true);
    }
    function internalMoveBy(dx, dy, smooth) {
      if (!smooth) {
        return moveBy(dx, dy);
      }
      if (moveByAnimation) moveByAnimation.cancel();
      const from = { x: 0, y: 0 };
      const to = { x: dx, y: dy };
      let lastX = 0;
      let lastY = 0;
      moveByAnimation = animate(from, to, {
        step(v) {
          moveBy(v.x - lastX, v.y - lastY);
          lastX = v.x;
          lastY = v.y;
        },
      });
    }
    function scroll(x, y) {
      cancelZoomAnimation();
      moveTo(x, y);
    }
    function dispose() {
      releaseEvents();
    }
    function listenForEvents() {
      owner.addEventListener('mousedown', onMouseDown, { passive: false });
      owner.addEventListener('dblclick', onDoubleClick, { passive: false });
      owner.addEventListener('touchstart', onTouch, { passive: false });
      owner.addEventListener('keydown', onKeyDown, { passive: false });
      wheel.addWheelListener(owner, onMouseWheel, { passive: false });
      makeDirty();
    }
    function releaseEvents() {
      wheel.removeWheelListener(owner, onMouseWheel);
      owner.removeEventListener('mousedown', onMouseDown);
      owner.removeEventListener('keydown', onKeyDown);
      owner.removeEventListener('dblclick', onDoubleClick);
      owner.removeEventListener('touchstart', onTouch);
      if (frameAnimation) {
        window.cancelAnimationFrame(frameAnimation);
        frameAnimation = 0;
      }
      smoothScroll.cancel();
      releaseDocumentMouse();
      releaseTouches();
      textSelection.release();
      triggerPanEnd();
    }
    function frame() {
      if (isDirty) applyTransform();
    }
    function applyTransform() {
      isDirty = false;
      panController.applyTransform(transform);
      triggerEvent('transform');
      frameAnimation = 0;
    }
    function onKeyDown(e) {
      let x = 0; let y = 0; let
        z = 0;
      if (e.keyCode === 38) {
        y = 1;
      } else if (e.keyCode === 40) {
        y = -1;
      } else if (e.keyCode === 37) {
        x = 1;
      } else if (e.keyCode === 39) {
        x = -1;
      } else if (e.keyCode === 189 || e.keyCode === 109) {
        z = 1;
      } else if (e.keyCode === 187 || e.keyCode === 107) {
        z = -1;
      }
      if (filterKey(e, x, y, z)) {
        return;
      }
      if (x || y) {
        e.preventDefault();
        e.stopPropagation();
        const clientRect = owner.getBoundingClientRect();
        let offset = Math.min(clientRect.width, clientRect.height);
        const moveSpeedRatio = 0.05;
        const dx = offset * moveSpeedRatio * x;
        const dy = offset * moveSpeedRatio * y;
        internalMoveBy(dx, dy);
      }
      if (z) {
        const scaleMultiplier = getScaleMultiplier(z * 100);
        let offset = transformOrigin ? getTransformOriginOffset() : midPoint();
        publicZoomTo(offset.x, offset.y, scaleMultiplier);
      }
    }
    function midPoint() {
      const ownerRect = owner.getBoundingClientRect();
      return {
        x: ownerRect.width / 2,
        y: ownerRect.height / 2,
      };
    }
    function onTouch(e) {
      beforeTouch(e);
      if (e.touches.length === 1) {
        return handleSingleFingerTouch(e);
      } if (e.touches.length === 2) {
        pinchZoomLength = getPinchZoomLength(e.touches[0], e.touches[1]);
        multiTouch = true;
        startTouchListenerIfNeeded();
      }
    }
    function beforeTouch(e) {
      if (options.onTouch && !options.onTouch(e)) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    }
    function beforeDoubleClick(e) {
      if (options.onDoubleClick && !options.onDoubleClick(e)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }
    function handleSingleFingerTouch(e) {
      const touch = e.touches[0];
      const offset = getOffsetXY(touch);
      lastSingleFingerOffset = offset;
      const point = transformToScreen(offset.x, offset.y);
      mouseX = point.x;
      mouseY = point.y;
      smoothScroll.cancel();
      startTouchListenerIfNeeded();
    }
    function startTouchListenerIfNeeded() {
      if (touchInProgress) {
        return;
      }
      touchInProgress = true;
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);
    }
    function handleTouchMove(e) {
      if (e.touches.length === 1) {
        e.stopPropagation();
        const touch = e.touches[0];
        let offset = getOffsetXY(touch);
        const point = transformToScreen(offset.x, offset.y);
        const dx = point.x - mouseX;
        const dy = point.y - mouseY;
        if (dx !== 0 && dy !== 0) {
          triggerPanStart();
        }
        mouseX = point.x;
        mouseY = point.y;
        internalMoveBy(dx, dy);
      } else if (e.touches.length === 2) {
        multiTouch = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentPinchLength = getPinchZoomLength(t1, t2);
        const scaleMultiplier = 1 + (currentPinchLength / pinchZoomLength - 1) * pinchSpeed;
        const firstTouchPoint = getOffsetXY(t1);
        const secondTouchPoint = getOffsetXY(t2);
        mouseX = (firstTouchPoint.x + secondTouchPoint.x) / 2;
        mouseY = (firstTouchPoint.y + secondTouchPoint.y) / 2;
        if (transformOrigin) {
          let offset = getTransformOriginOffset();
          mouseX = offset.x;
          mouseY = offset.y;
        }
        publicZoomTo(mouseX, mouseY, scaleMultiplier);
        pinchZoomLength = currentPinchLength;
        e.stopPropagation();
        e.preventDefault();
      }
    }
    function handleTouchEnd(e) {
      if (e.touches.length > 0) {
        let offset = getOffsetXY(e.touches[0]);
        const point = transformToScreen(offset.x, offset.y);
        mouseX = point.x;
        mouseY = point.y;
      } else {
        const now = new Date();
        if (Number(now) - lastTouchEndTime < doubleTapSpeedInMS) {
          if (transformOrigin) {
            let offset = getTransformOriginOffset();
            smoothZoom(offset.x, offset.y, zoomDoubleClickSpeed);
          } else {
            smoothZoom(lastSingleFingerOffset.x, lastSingleFingerOffset.y, zoomDoubleClickSpeed);
          }
        }
        lastTouchEndTime = Number(now);
        triggerPanEnd();
        releaseTouches();
      }
    }
    function getPinchZoomLength(finger1, finger2) {
      const dx = finger1.clientX - finger2.clientX;
      const dy = finger1.clientY - finger2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function onDoubleClick(e) {
      beforeDoubleClick(e);
      let offset = getOffsetXY(e);
      if (transformOrigin) {
        offset = getTransformOriginOffset();
      }
      smoothZoom(offset.x, offset.y, zoomDoubleClickSpeed);
    }
    function onMouseDown(e) {
      if (beforeMouseDown(e)) return;
      if (touchInProgress) {
        e.stopPropagation();
        return false;
      }
      const isLeftButton = e.button === 1 && window.event !== null || e.button === 0;
      if (!isLeftButton) return;
      smoothScroll.cancel();
      const offset = getOffsetXY(e);
      const point = transformToScreen(offset.x, offset.y);
      mouseX = point.x;
      mouseY = point.y;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      textSelection.capture(e.target || e.srcElement);
      return false;
    }
    function onMouseMove(e) {
      if (touchInProgress) return;
      triggerPanStart();
      const offset = getOffsetXY(e);
      const point = transformToScreen(offset.x, offset.y);
      const dx = point.x - mouseX;
      const dy = point.y - mouseY;
      mouseX = point.x;
      mouseY = point.y;
      internalMoveBy(dx, dy);
    }
    function onMouseUp() {
      textSelection.release();
      triggerPanEnd();
      releaseDocumentMouse();
    }
    function releaseDocumentMouse() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      panstartFired = false;
    }
    function releaseTouches() {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      panstartFired = false;
      multiTouch = false;
      touchInProgress = false;
    }
    function onMouseWheel(e) {
      if (beforeWheel(e)) return;
      smoothScroll.cancel();
      let delta = e.deltaY;
      if (e.deltaMode > 0) delta *= 100;
      const scaleMultiplier = getScaleMultiplier(delta);
      if (scaleMultiplier !== 1) {
        const offset = transformOrigin ? getTransformOriginOffset() : getOffsetXY(e);
        publicZoomTo(offset.x, offset.y, scaleMultiplier);
        e.preventDefault();
      }
    }
    function getOffsetXY(e) {
      let offsetX; let
        offsetY;
      const ownerRect = owner.getBoundingClientRect();
      offsetX = e.clientX - ownerRect.left;
      offsetY = e.clientY - ownerRect.top;
      return { x: offsetX, y: offsetY };
    }
    function smoothZoom(clientX, clientY, scaleMultiplier) {
      const fromValue = transform.scale;
      const from = { scale: fromValue };
      const to = { scale: scaleMultiplier * fromValue };
      smoothScroll.cancel();
      cancelZoomAnimation();
      zoomToAnimation = animate(from, to, {
        step(v) {
          zoomAbs(clientX, clientY, v.scale);
        },
        done: triggerZoomEnd,
      });
    }
    function smoothZoomAbs(clientX, clientY, toScaleValue) {
      const fromValue = transform.scale;
      const from = { scale: fromValue };
      const to = { scale: toScaleValue };
      smoothScroll.cancel();
      cancelZoomAnimation();
      zoomToAnimation = animate(from, to, {
        step(v) {
          zoomAbs(clientX, clientY, v.scale);
        },
      });
    }
    function getTransformOriginOffset() {
      const ownerRect = owner.getBoundingClientRect();
      return {
        x: ownerRect.width * transformOrigin.x,
        y: ownerRect.height * transformOrigin.y,
      };
    }
    function publicZoomTo(clientX, clientY, scaleMultiplier) {
      smoothScroll.cancel();
      cancelZoomAnimation();
      return zoomByRatio(clientX, clientY, scaleMultiplier);
    }
    function cancelZoomAnimation() {
      if (zoomToAnimation) {
        zoomToAnimation.cancel();
        zoomToAnimation = null;
      }
    }
    function getScaleMultiplier(delta) {
      const sign = Math.sign(delta);
      const deltaAdjustedSpeed = Math.min(0.25, Math.abs(speed * delta / 128));
      return 1 - sign * deltaAdjustedSpeed;
    }
    function triggerPanStart() {
      if (!panstartFired) {
        triggerEvent('panstart');
        panstartFired = true;
        smoothScroll.start();
      }
    }
    function triggerPanEnd() {
      if (panstartFired) {
        if (!multiTouch) smoothScroll.stop();
        triggerEvent('panend');
      }
    }
    function triggerZoomEnd() {
      triggerEvent('zoomend');
    }
    function triggerEvent(name) {
      api.fire(name, api);
    }
  }
  function parseTransformOrigin(options) {
    if (!options) return;
    if (typeof options === 'object') {
      if (!isNumber(options.x) || !isNumber(options.y)) failTransformOrigin(options);
      return options;
    }
    failTransformOrigin();
  }
  function failTransformOrigin(options) {
    console.error(options);
    throw new Error([
      'Cannot parse transform origin.',
      'Some good examples:',
      '  "center center" can be achieved with {x: 0.5, y: 0.5}',
      '  "top center" can be achieved with {x: 0.5, y: 0}',
      '  "bottom right" can be achieved with {x: 1, y: 1}',
    ].join('\n'));
  }
  function noop() {
  }
  function validateBounds(bounds) {
    const boundsType = typeof bounds;
    if (boundsType === 'undefined' || boundsType === 'boolean') return;
    const validBounds = isNumber(bounds.left) && isNumber(bounds.top) && isNumber(bounds.bottom) && isNumber(bounds.right);
    if (!validBounds) throw new Error('Bounds object is not valid. It can be: undefined, boolean (true|false) or an object {left, top, right, bottom}');
  }
  function isNumber(x) {
    return Number.isFinite(x);
  }
  function isNaN(value) {
    if (Number.isNaN) {
      return Number.isNaN(value);
    }
    return value !== value;
  }
  function rigidScroll() {
    return {
      start: noop,
      stop: noop,
      cancel: noop,
    };
  }
  function autoRun() {
    if (typeof document === 'undefined') return;
    const scripts = document.getElementsByTagName('script');
    if (!scripts) return;
    let panzoomScript;
    for (let i = 0; i < scripts.length; ++i) {
      const x = scripts[i];
      if (x.src && x.src.match(/\bpanzoom(\.min)?\.js/)) {
        panzoomScript = x;
        break;
      }
    }
    if (!panzoomScript) return;
    const query = panzoomScript.getAttribute('query');
    if (!query) return;
    const globalName = panzoomScript.getAttribute('name') || 'pz';
    const started = Date.now();
    tryAttach();
    function tryAttach() {
      const el = document.querySelector(query);
      if (!el) {
        const now = Date.now();
        const elapsed = now - started;
        if (elapsed < 2e3) {
          setTimeout(tryAttach, 100);
          return;
        }
        console.error('Cannot find the panzoom element', globalName);
        return;
      }
      const panZoomOptions = collectOptions(panzoomScript);
      console.log(panZoomOptions);
      window[globalName] = createPanZoom(el, panZoomOptions);
    }
    function collectOptions(script) {
      const attrs = script.attributes;
      const panZoomOptions = {};
      for (let j = 0; j < attrs.length; ++j) {
        const attr = attrs[j];
        const nameValue = getPanzoomAttributeNameValue(attr);
        if (nameValue) {
          panZoomOptions[nameValue.name] = nameValue.value;
        }
      }
      return panZoomOptions;
    }
    function getPanzoomAttributeNameValue(attr) {
      if (!attr.name) return;
      const isPanZoomAttribute = attr.name[0] === 'p' && attr.name[1] === 'z' && attr.name[2] === '-';
      if (!isPanZoomAttribute) return;
      const name = attr.name.substr(3);
      const value = JSON.parse(attr.value);
      return { name, value };
    }
  }
  autoRun();
});
export default require_panzoom();
