/* eslint-disable func-names */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-func-assign */
/* eslint-disable no-proto */
/* eslint-disable no-cond-assign */
/* eslint-disable no-shadow */
/* eslint-disable no-use-before-define */
/* eslint-disable prefer-rest-params */

// Based on iv-viewer - 2.0.1 Author : Sudhanshu Yadav git+https://github.com/s-yadav/iv-viewer.git

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() : typeof define === 'function' && define.amd ? define(factory) : (global = global || self, global.ImageViewer = factory());
}(this, () => {
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError('Cannot call a class as a function');
    }
  }

  function _defineProperties(target, props) {
    for (let i = 0; i < props.length; i++) {
      const descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ('value' in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }

  function _objectSpread(target) {
    for (let i = 1; i < arguments.length; i++) {
      const source = arguments[i] != null ? arguments[i] : {};
      let ownKeys = Object.keys(source);
      if (typeof Object.getOwnPropertySymbols === 'function') {
        ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter((sym) => Object.getOwnPropertyDescriptor(source, sym).enumerable));
      }
      ownKeys.forEach((key) => {
        _defineProperty(target, key, source[key]);
      });
    }
    return target;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== 'function' && superClass !== null) {
      throw new TypeError('Super expression must either be null or a function');
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true,
      },
    });
    if (superClass) _setPrototypeOf(subClass, superClass);
  }

  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
      return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _getPrototypeOf(o);
  }

  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };
    return _setPrototypeOf(o, p);
  }

  function _assertThisInitialized(self) {
    if (self === undefined) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
  }

  function _possibleConstructorReturn(self, call) {
    if (call && (typeof call === 'object' || typeof call === 'function')) {
      return call;
    }
    return _assertThisInitialized(self);
  }

  function _superPropBase(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
      object = _getPrototypeOf(object);
      if (object === null) break;
    }
    return object;
  }

  function _get(target, property, receiver) {
    if (typeof Reflect !== 'undefined' && Reflect.get) {
      _get = Reflect.get;
    } else {
      _get = function _get(target, property, receiver) {
        const base = _superPropBase(target, property);
        if (!base) return null;
        const desc = Object.getOwnPropertyDescriptor(base, property);
        if (desc.get) return desc.get.call(receiver);
        return desc.value;
      };
    }
    return _get(target, property, receiver || target);
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
    return null;
  }

  function _iterableToArrayLimit(arr, i) {
    const _arr = [];
    let _n = true;
    try {
      for (let _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);
        if (i && _arr.length === i) break;
      }
    } catch (err) { /**/
    } finally {
      try {
        if (!_n && _i.return != null) _i.return();
      } finally { /**/ }
    }
    return _arr;
  }

  function _nonIterableRest() {
    throw new TypeError('Invalid attempt to destructure non-iterable instance');
  }

  // constants
  const ZOOM_CONSTANT = 3; // increase or decrease value for zoom on mouse wheel
  const MOUSE_WHEEL_COUNT = 15; // A mouse delta after which it should stop preventing default behaviour of mouse wheel

  function noop() {} // ease out method

  /*
      t : current time,
      b : intial value,
      c : changed value,
      d : duration
  */
  function easeOutQuart(t, b, c, d) {
    t /= d;
    t -= 1;
    return -c * (t * t * t * t - 1) + b;
  }

  function createElement(options) {
    const elem = document.createElement(options.tagName);
    if (options.id) elem.id = options.id;
    if (options.html) elem.innerHTML = options.html;
    if (options.className) elem.className = options.className;
    if (options.src) elem.src = options.src;
    if (options.style) elem.style.cssText = options.style;
    if (options.child) elem.appendChild(options.child); // Insert before
    if (options.insertBefore) {
      options.parent.insertBefore(elem, options.insertBefore); // Standard append
    } else {
      options.parent.appendChild(elem);
    }
    return elem;
  }

  function addClass(el, className) {
    const classNameAry = className.split(' ');
    if (classNameAry.length > 1) {
      classNameAry.forEach((classItem) => addClass(el, classItem));
    } else if (el.classList) {
      el.classList.add(className);
    } else {
      el.className += ' '.concat(className); // eslint-disable-line no-param-reassign
    }
  }

  function removeClass(el, className) {
    const classNameAry = className.split(' ');
    if (classNameAry.length > 1) {
      classNameAry.forEach((classItem) => removeClass(el, classItem));
    } else if (el.classList) {
      el.classList.remove(className);
    } else {
      el.className = el.className.replace(new RegExp('(^|\\b)'.concat(className.split(' ').join('|'), '(\\b|$)'), 'gi'), ' '); // eslint-disable-line no-param-reassign
    }
  }

  function imageLoaded(img) {
    return img.complete && (typeof img.naturalWidth === 'undefined' || img.naturalWidth !== 0);
  }
  function toArray(list) {
    if (!(list instanceof NodeList || list instanceof HTMLCollection)) return [list];
    return Array.prototype.slice.call(list);
  }
  function css(elements, properties) {
    const elmArray = toArray(elements);
    if (typeof properties === 'string') {
      return window.getComputedStyle(elmArray[0])[properties];
    }
    elmArray.forEach((element) => {
      Object.keys(properties).forEach((key) => {
        const value = properties[key];
        element.style[key] = value; // eslint-disable-line no-param-reassign
      });
    });
    return undefined;
  }

  function removeCss(element, property) {
    element.style.removeProperty(property);
  }

  function wrap(element, _ref) {
    const _ref$tag = _ref.tag;
    const tag = _ref$tag === undefined ? 'div' : _ref$tag;
    const className = _ref.className;
    const id = _ref.id;
    const style = _ref.style;
    const wrapper = document.createElement(tag);
    if (className) wrapper.className = className;
    if (id) wrapper.id = id;
    if (style) wrapper.style = style;
    element.parentNode.insertBefore(wrapper, element);
    element.parentNode.removeChild(element);
    wrapper.appendChild(element);
    return wrapper;
  }

  function unwrap(element) {
    const parent = element.parentNode;
    if (parent !== document.body) {
      parent.parentNode.insertBefore(element, parent);
      parent.parentNode.removeChild(parent);
    }
  }

  function remove(elements) {
    const elmArray = toArray(elements);
    elmArray.forEach((element) => {
      if (element.parentNode) element.parentNode.removeChild(element);
    });
  }

  function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  }

  function assignEvent(element, events, handler) {
    if (typeof events === 'string') events = [events];
    events.forEach((event) => {
      element.addEventListener(event, handler);
    });
    return () => {
      events.forEach((event) => {
        element.removeEventListener(event, handler);
      });
    };
  }

  function getTouchPointsDistance(touches) {
    const touch0 = touches[0];
    const touch1 = touches[1];
    return Math.sqrt(((touch1.pageX - touch0.pageX) ** 2) + ((touch1.pageY - touch0.pageY) ** 2));
  }

  const Slider = (function () {
    function Slider(container, _ref) {
      const _this = this;
      const _onStart = _ref.onStart;
      const _onMove = _ref.onMove;
      const onEnd = _ref.onEnd;
      const isSliderEnabled = _ref.isSliderEnabled;
      _classCallCheck(this, Slider);
      _defineProperty(this, 'startHandler', (eStart) => {
        if (!_this.isSliderEnabled()) return;
        _this.removeListeners();
        eStart.preventDefault();
        const moveHandler = _this.moveHandler;
        const endHandler = _this.endHandler;
        const onStart = _this.onStart;
        const isTouchEvent = eStart.type === 'touchstart';
        _this.touchMoveEvent = isTouchEvent ? 'touchmove' : 'mousemove';
        _this.touchEndEvent = isTouchEvent ? 'touchend' : 'mouseup';
        _this.sx = isTouchEvent ? eStart.touches[0].clientX : eStart.clientX;
        _this.sy = isTouchEvent ? eStart.touches[0].clientY : eStart.clientY;
        onStart(eStart, {
          x: _this.sx,
          y: _this.sy,
        }); // add listeners
        document.addEventListener(_this.touchMoveEvent, moveHandler);
        document.addEventListener(_this.touchEndEvent, endHandler);
        document.addEventListener('contextmenu', endHandler);
      });

      _defineProperty(this, 'moveHandler', (eMove) => {
        if (!_this.isSliderEnabled()) return;
        eMove.preventDefault();
        const sx = _this.sx;
        const sy = _this.sy;
        const onMove = _this.onMove;
        const isTouchEvent = _this.touchMoveEvent === 'touchmove'; // get the coordinates
        const mx = isTouchEvent ? eMove.touches[0].clientX : eMove.clientX;
        const my = isTouchEvent ? eMove.touches[0].clientY : eMove.clientY;
        onMove(eMove, {
          dx: mx - sx,
          dy: my - sy,
          mx,
          my,
        });
      });

      _defineProperty(this, 'endHandler', () => {
        if (!_this.isSliderEnabled()) return;
        _this.removeListeners();
        _this.onEnd();
      });

      this.container = container;
      this.isSliderEnabled = isSliderEnabled;
      this.onStart = _onStart || noop;
      this.onMove = _onMove || noop;
      this.onEnd = onEnd || noop;
    }

    _createClass(Slider, [{
      key: 'removeListeners',
      // remove previous events if its not removed
      // - Case when while sliding mouse moved out of document and released there
      value: function removeListeners() {
        if (!this.touchMoveEvent) return;
        document.removeEventListener(this.touchMoveEvent, this.moveHandler);
        document.removeEventListener(this.touchEndEvent, this.endHandler);
        document.removeEventListener('contextmenu', this.endHandler);
      },
    }, {
      key: 'init',
      value: function init() {
        const _this2 = this;
        ['touchstart', 'mousedown'].forEach((evt) => _this2.container.addEventListener(evt, _this2.startHandler));
      },
    }, {
      key: 'destroy',
      value: function destroy() {
        const _this3 = this;
        ['touchstart', 'mousedown'].forEach((evt) => _this3.container.removeEventListener(evt, _this3.startHandler));
        this.removeListeners();
      },
    }]);

    return Slider;
  }());

  const imageViewHtml = `
    <div class="iv-loader"></div>
    <div class="iv-snap-view">
      <div class="iv-snap-image-wrap">
        <div class="iv-snap-handle"></div>
      </div>
      <div class="iv-zoom-slider">
        <div class="iv-zoom-handle"></div>
      </div>
    </div>
    <div class="iv-image-view">
      <div class="iv-image-wrap"></div>
    </div>
    `;

  const ImageViewer = (function () {
    function ImageViewer(element) {
      const _this = this;
      const options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      _classCallCheck(this, ImageViewer);
      _defineProperty(this, 'zoom', async (perc, point) => {
        const _options = _this._options;
        const _elements = _this._elements;
        const _state = _this._state;
        const curPerc = _state.zoomValue;
        const imageDim = _state.imageDim;
        const containerDim = _state.containerDim;
        const zoomSliderLength = _state.zoomSliderLength;
        const image = _elements.image;
        const zoomHandle = _elements.zoomHandle;
        const maxZoom = _options.maxZoom;
        perc = Math.round(Math.max(100, perc));
        perc = Math.min(maxZoom, perc);
        point = point || { x: containerDim.w / 2, y: containerDim.h / 2 };
        const curLeft = parseFloat(css(image, 'left'));
        const curTop = parseFloat(css(image, 'top')); // clear any panning frames
        _this._clearFrames();
        let step = 0;
        const baseLeft = 0; // (containerDim.w - imageDim.w) / 2;
        const baseTop = 0; // (containerDim.h - imageDim.h) / 2;
        const baseRight = 0; // containerDim.w - baseLeft;
        const baseBottom = 0; // containerDim.h - baseTop;

        const zoom = function zoom() {
          step++;
          if (step < 16) _this._frames.zoomFrame = requestAnimationFrame(zoom);
          const tickZoom = easeOutQuart(step, curPerc, perc - curPerc, 16);
          const ratio = tickZoom / curPerc;
          const imgWidth = imageDim.w * tickZoom / 500;
          const imgHeight = imageDim.h * tickZoom / 500;
          let newLeft = -((point.x - curLeft) * ratio - point.x);
          let newTop = -((point.y - curTop) * ratio - point.y); // fix for left and top
          newLeft = Math.min(newLeft, baseLeft);
          newTop = Math.min(newTop, baseTop); // fix for right and bottom
          if (newLeft + imgWidth < baseRight) newLeft = baseRight - imgWidth; // newLeft - (newLeft + imgWidth - baseRight)
          if (newTop + imgHeight < baseBottom) newTop = baseBottom - imgHeight; // newTop + (newTop + imgHeight - baseBottom)
          css(image, {
            height: ''.concat(imgHeight, 'px'),
            width: ''.concat(imgWidth, 'px'),
            left: 0, // ''.concat(newLeft, 'px'),
            top: 0, // ''.concat(newTop, 'px'),
          });
          _this._state.zoomValue = tickZoom;
          _this._resizeSnapHandle(imgWidth, imgHeight, newLeft, newTop); // update zoom handle position
          css(zoomHandle, { left: ''.concat((tickZoom - 100) * zoomSliderLength / (maxZoom - 100), 'px') });
        };
        const initialFrame = _this._frames.zoomFrame;
        zoom();
        return new Promise((resolve) => {
          const wait = setInterval(() => {
            if (_this._frames.zoomFrame - initialFrame >= 15) {
              clearInterval(wait);
              resolve(true);
            }
          }, 10);
        });
      });

      _defineProperty(this, '_clearFrames', () => {
        const _this$_frames = _this._frames;
        const slideMomentumCheck = _this$_frames.slideMomentumCheck;
        const sliderMomentumFrame = _this$_frames.sliderMomentumFrame;
        const zoomFrame = _this$_frames.zoomFrame;
        clearInterval(slideMomentumCheck);
        cancelAnimationFrame(sliderMomentumFrame);
        cancelAnimationFrame(zoomFrame);
      });

      _defineProperty(this, '_resizeSnapHandle', (imgWidth, imgHeight, imgLeft, imgTop) => {
        const _elements = _this._elements;
        const _state = _this._state;
        const snapHandle = _elements.snapHandle;
        const image = _elements.image;
        const imageDim = _state.imageDim;
        const containerDim = _state.containerDim;
        const zoomValue = _state.zoomValue;
        const snapImageDim = _state.snapImageDim;
        const imageWidth = imgWidth || imageDim.w * zoomValue / 100;
        const imageHeight = imgHeight || imageDim.h * zoomValue / 100;
        const imageLeft = imgLeft || parseFloat(css(image, 'left'));
        const imageTop = imgTop || parseFloat(css(image, 'top'));
        const left = -imageLeft * snapImageDim.w / imageWidth;
        const top = -imageTop * snapImageDim.h / imageHeight;
        const handleWidth = containerDim.w * snapImageDim.w / imageWidth;
        const handleHeight = containerDim.h * snapImageDim.h / imageHeight;
        css(snapHandle, {
          top: ''.concat(top, 'px'),
          left: ''.concat(left, 'px'),
          width: ''.concat(handleWidth, 'px'),
          height: ''.concat(handleHeight, 'px'),
        });
        _this._state.snapHandleDim = {
          w: handleWidth,
          h: handleHeight,
        };
      });

      _defineProperty(this, 'showSnapView', (noTimeout) => {
        const _this$_state = _this._state;
        const snapViewVisible = _this$_state.snapViewVisible;
        const zoomValue = _this$_state.zoomValue;
        const loaded = _this$_state.loaded;
        const snapView = _this._elements.snapView;
        if (!_this._options.snapView) return;
        if (snapViewVisible || zoomValue <= 100 || !loaded) return;
        clearTimeout(_this._frames.snapViewTimeout);
        _this._state.snapViewVisible = true;
        css(snapView, {
          opacity: 1,
          pointerEvents: 'inherit',
        });

        if (!noTimeout) {
          _this._frames.snapViewTimeout = setTimeout(_this.hideSnapView, 1500);
        }
      });

      _defineProperty(this, 'hideSnapView', () => {
        const snapView = _this._elements.snapView;
        css(snapView, {
          opacity: 0,
          pointerEvents: 'none',
        });
        _this._state.snapViewVisible = false;
      });

      _defineProperty(this, 'refresh', () => {
        _this._calculateDimensions();
        _this.resetZoom();
      });

      const _this$_findContainerA = this._findContainerAndImageSrc(element, options);
      const container = _this$_findContainerA.container;
      const domElement = _this$_findContainerA.domElement;
      const imageSrc = _this$_findContainerA.imageSrc;
      const hiResImageSrc = _this$_findContainerA.hiResImageSrc; // containers for elements

      this._elements = {
        container,
        domElement,
      };
      this._options = _objectSpread({}, ImageViewer.defaults, options); // container for all events
      this._events = {}; // container for all timeout and frames
      this._frames = {}; // container for all sliders
      this._sliders = {}; // maintain current state
      this._state = {
        zoomValue: this._options.zoomValue,
      };
      this._images = {
        imageSrc,
        hiResImageSrc,
      };
      this._init();
      if (imageSrc) {
        this._loadImages();
      } // store reference of imageViewer in domElement
      domElement._imageViewer = this;
    }

    _createClass(ImageViewer, [{
      key: '_findContainerAndImageSrc',
      value: function _findContainerAndImageSrc(element) {
        let domElement = element;
        let imageSrc;
        let hiResImageSrc;
        if (typeof element === 'string') {
          domElement = document.querySelector(element);
        } // throw error if imageViewer is already assigned
        if (domElement._imageViewer) {
          throw new Error('An image viewer is already being initiated on the element.');
        }
        let container = element;
        if (domElement.tagName === 'IMG') {
          imageSrc = domElement.src;
          hiResImageSrc = domElement.getAttribute('high-res-src') || domElement.getAttribute('data-high-res-src'); // wrap the image with iv-container div
          container = wrap(domElement, {
            className: 'iv-container iv-image-mode',
            style: {
              display: 'inline-block',
              overflow: 'hidden',
            },
          }); // hide the image and add iv-original-img class
          css(domElement, {
            opacity: 0,
            position: 'relative',
            zIndex: -1,
          });
        } else {
          imageSrc = domElement.getAttribute('src') || domElement.getAttribute('data-src');
          hiResImageSrc = domElement.getAttribute('high-res-src') || domElement.getAttribute('data-high-res-src');
        }
        return {
          container,
          domElement,
          imageSrc,
          hiResImageSrc,
        };
      },
    }, {
      key: '_init',
      value: function _init() {
        // initialize the dom elements
        this._initDom(); // initialize slider
        this._initImageSlider();
        this._initSnapSlider();
        this._initZoomSlider(); // enable pinch and zoom feature for touch screens
        this._pinchAndZoom(); // enable scroll zoom interaction
        this._scrollZoom(); // enable double tap to zoom interaction
        this._doubleTapToZoom(); // initialize events
        this._initEvents();
      },
    }, {
      key: '_initDom',
      value: function _initDom() {
        const container = this._elements.container; // add image-viewer layout elements
        createElement({
          tagName: 'div',
          className: 'iv-wrap',
          html: imageViewHtml,
          parent: container,
        }); // add container class on the container
        addClass(container, 'iv-container'); // if the element is static position, position it relatively
        if (css(container, 'position') === 'static') {
          css(container, {
            position: 'relative',
          });
        } // save references for later use
        this._elements = _objectSpread({}, this._elements, {
          snapView: container.querySelector('.iv-snap-view'),
          snapImageWrap: container.querySelector('.iv-snap-image-wrap'),
          imageWrap: container.querySelector('.iv-image-wrap'),
          snapHandle: container.querySelector('.iv-snap-handle'),
          zoomHandle: container.querySelector('.iv-zoom-handle'),
        });
      },
    }, {
      key: '_initImageSlider',
      value: function _initImageSlider() {
        const _this2 = this;

        const _elements = this._elements;
        const imageWrap = _elements.imageWrap;
        let positions; let
          currentPos;
        /* Add slide interaction to image */

        const imageSlider = new Slider(imageWrap, {
          isSliderEnabled: function isSliderEnabled() {
            const _this2$_state = _this2._state;
            const loaded = _this2$_state.loaded;
            const zooming = _this2$_state.zooming;
            const zoomValue = _this2$_state.zoomValue;
            return loaded && !zooming && zoomValue > 100;
          },
          onStart: function onStart(e, position) {
            const snapSlider = _this2._sliders.snapSlider; // clear all animation frame and interval
            _this2._clearFrames();
            snapSlider.onStart(); // reset positions
            positions = [position, position];
            currentPos = undefined;
            _this2._frames.slideMomentumCheck = setInterval(() => {
              if (!currentPos) return;
              positions.shift();
              positions.push({
                x: currentPos.mx,
                y: currentPos.my,
              });
            }, 50);
          },
          onMove: function onMove(e, position) {
            const snapImageDim = _this2._state.snapImageDim;
            const snapSlider = _this2._sliders.snapSlider;
            const imageCurrentDim = _this2._getImageCurrentDim();
            currentPos = position;
            snapSlider.onMove(e, {
              dx: -position.dx * snapImageDim.w / imageCurrentDim.w,
              dy: -position.dy * snapImageDim.h / imageCurrentDim.h,
            });
          },
          onEnd: function onEnd() {
            const snapImageDim = _this2._state.snapImageDim;
            const snapSlider = _this2._sliders.snapSlider;
            const imageCurrentDim = _this2._getImageCurrentDim(); // clear all animation frame and interval
            _this2._clearFrames();
            let step;
            let positionX;
            let positionY;
            const xDiff = positions[1].x - positions[0].x;
            const yDiff = positions[1].y - positions[0].y;

            const momentum = function momentum() {
              if (step <= 60) {
                _this2._frames.sliderMomentumFrame = requestAnimationFrame(momentum);
              }
              positionX += easeOutQuart(step, xDiff / 3, -xDiff / 3, 60);
              positionY += easeOutQuart(step, yDiff / 3, -yDiff / 3, 60);
              snapSlider.onMove(null, {
                dx: -(positionX * snapImageDim.w / imageCurrentDim.w),
                dy: -(positionY * snapImageDim.h / imageCurrentDim.h),
              });
              step++;
            };
            if (Math.abs(xDiff) > 30 || Math.abs(yDiff) > 30) {
              step = 1;
              positionX = currentPos.dx;
              positionY = currentPos.dy;
              momentum();
            }
          },
        });
        imageSlider.init();
        this._sliders.imageSlider = imageSlider;
      },
    }, {
      key: '_initSnapSlider',
      value: function _initSnapSlider() {
        const _this3 = this;
        const snapHandle = this._elements.snapHandle;
        let startHandleTop; let
          startHandleLeft;
        const snapSlider = new Slider(snapHandle, {
          isSliderEnabled: function isSliderEnabled() {
            return _this3._state.loaded;
          },
          onStart: function onStart() {
            const _this3$_frames = _this3._frames;
            const slideMomentumCheck = _this3$_frames.slideMomentumCheck;
            const sliderMomentumFrame = _this3$_frames.sliderMomentumFrame;
            startHandleTop = parseFloat(css(snapHandle, 'top'));
            startHandleLeft = parseFloat(css(snapHandle, 'left')); // stop momentum on image

            clearInterval(slideMomentumCheck);
            cancelAnimationFrame(sliderMomentumFrame);
          },
          onMove: function onMove(e, position) {
            const _this3$_state = _this3._state;
            const snapHandleDim = _this3$_state.snapHandleDim;
            const snapImageDim = _this3$_state.snapImageDim;
            const image = _this3._elements.image;
            const imageCurrentDim = _this3._getImageCurrentDim(); // find handle left and top and make sure they lay between the snap image
            const maxLeft = Math.max(snapImageDim.w - snapHandleDim.w, startHandleLeft);
            const maxTop = Math.max(snapImageDim.h - snapHandleDim.h, startHandleTop);
            const minLeft = Math.min(0, startHandleLeft);
            const minTop = Math.min(0, startHandleTop);
            const left = clamp(startHandleLeft + position.dx, minLeft, maxLeft);
            const top = clamp(startHandleTop + position.dy, minTop, maxTop);
            const imgLeft = -left * imageCurrentDim.w / snapImageDim.w;
            const imgTop = -top * imageCurrentDim.h / snapImageDim.h;
            css(snapHandle, {
              left: ''.concat(left, 'px'),
              top: ''.concat(top, 'px'),
            });
            css(image, {
              left: ''.concat(imgLeft, 'px'),
              top: ''.concat(imgTop, 'px'),
            });
          },
        });
        snapSlider.init();
        this._sliders.snapSlider = snapSlider;
      },
    }, {
      key: '_initZoomSlider',
      value: function _initZoomSlider() {
        const _this4 = this;
        const _this$_elements = this._elements;
        const snapView = _this$_elements.snapView;
        const zoomHandle = _this$_elements.zoomHandle; // zoom in zoom out using zoom handle
        const sliderElm = snapView.querySelector('.iv-zoom-slider');
        let leftOffset; let
          handleWidth; // on zoom slider we have to follow the mouse and set the handle to its position.

        const zoomSlider = new Slider(sliderElm, {
          isSliderEnabled: function isSliderEnabled() {
            return _this4._state.loaded;
          },
          onStart: function onStart(eStart) {
            const slider = _this4._sliders.zoomSlider;
            leftOffset = sliderElm.getBoundingClientRect().left + document.body.scrollLeft;
            handleWidth = parseInt(css(zoomHandle, 'width'), 10); // move the handle to current mouse position
            slider.onMove(eStart);
          },
          onMove: function onMove(e) {
            const maxZoom = _this4._options.maxZoom;
            const zoomSliderLength = _this4._state.zoomSliderLength;
            const pageX = e.pageX !== undefined ? e.pageX : e.touches[0].pageX;
            const newLeft = clamp(pageX - leftOffset - handleWidth / 2, 0, zoomSliderLength);
            const zoomValue = 100 + (maxZoom - 100) * newLeft / zoomSliderLength;
            _this4.zoom(zoomValue);
          },
        });
        zoomSlider.init();
        this._sliders.zoomSlider = zoomSlider;
      },
    }, {
      key: '_initEvents',
      value: function _initEvents() {
        this._snapViewEvents(); // handle window resize
        if (this._options.refreshOnResize) {
          this._events.onWindowResize = assignEvent(window, 'resize', this.refresh);
        }
      },
    }, {
      key: '_snapViewEvents',
      value: function _snapViewEvents() {
        const _this5 = this;
        const _this$_elements2 = this._elements;
        const imageWrap = _this$_elements2.imageWrap;
        const snapView = _this$_elements2.snapView; // show snapView on mouse move
        this._events.snapViewOnMouseMove = assignEvent(imageWrap, ['touchmove', 'mousemove'], () => {
          _this5.showSnapView();
        }); // keep showing snapView if on hover over it without any timeout
        this._events.mouseEnterSnapView = assignEvent(snapView, ['mouseenter', 'touchstart'], () => {
          _this5._state.snapViewVisible = false;
          _this5.showSnapView(true);
        }); // on mouse leave set timeout to hide snapView
        this._events.mouseLeaveSnapView = assignEvent(snapView, ['mouseleave', 'touchend'], () => {
          _this5._state.snapViewVisible = false;
          _this5.showSnapView();
        });
      },
    }, {
      key: '_pinchAndZoom',
      value: function _pinchAndZoom() {
        const _this6 = this;
        const _this$_elements3 = this._elements;
        const imageWrap = _this$_elements3.imageWrap;
        const container = _this$_elements3.container; // apply pinch and zoom feature
        const onPinchStart = function onPinchStart(eStart) {
          const _this6$_state = _this6._state;
          const loaded = _this6$_state.loaded;
          const startZoomValue = _this6$_state.zoomValue;
          const events = _this6._events;
          if (!loaded) return;
          const touch0 = eStart.touches[0];
          const touch1 = eStart.touches[1];
          if (!(touch0 && touch1)) {
            return;
          }
          _this6._state.zooming = true;
          const contOffset = container.getBoundingClientRect(); // find distance between two touch points
          const startDist = getTouchPointsDistance(eStart.touches); // find the center for the zoom
          const center = {
            x: (touch1.pageX + touch0.pageX) / 2 - (contOffset.left + document.body.scrollLeft),
            y: (touch1.pageY + touch0.pageY) / 2 - (contOffset.top + document.body.scrollTop),
          };
          const moveListener = function moveListener(eMove) {
            // eMove.preventDefault();
            const newDist = getTouchPointsDistance(eMove.touches);
            const zoomValue = startZoomValue + (newDist - startDist) / 2;
            _this6.zoom(zoomValue, center);
          };
          const endListener = function endListener() {
            // unbind events
            events.pinchMove();
            events.pinchEnd();
            _this6._state.zooming = false;
          }; // remove events if already assigned
          if (events.pinchMove) events.pinchMove();
          if (events.pinchEnd) events.pinchEnd(); // assign events
          events.pinchMove = assignEvent(document, 'touchmove', moveListener);
          events.pinchEnd = assignEvent(document, 'touchend', endListener);
        };
        this._events.pinchStart = assignEvent(imageWrap, 'touchstart', onPinchStart);
      },
    }, {
      key: '_scrollZoom',
      value: function _scrollZoom() {
        const _this7 = this;
        /* Add zoom interaction in mouse wheel */
        const _options = this._options;
        const _this$_elements4 = this._elements;
        const container = _this$_elements4.container;
        const imageWrap = _this$_elements4.imageWrap;
        let changedDelta = 0;

        const onMouseWheel = function onMouseWheel(e) {
          const _this7$_state = _this7._state;
          const loaded = _this7$_state.loaded;
          const zoomValue = _this7$_state.zoomValue;
          if (!_options.zoomOnMouseWheel || !loaded) return; // clear all animation frame and interval
          _this7._clearFrames(); // cross-browser wheel delta
          // const delta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail || -e.deltaY));
          const delta = (e.wheelDelta || -e.detail || -e.deltaY) > 0 ? 1 : -1;
          const newZoomValue = zoomValue * (100 + delta * ZOOM_CONSTANT) / 100;
          if (!(newZoomValue >= 100 && newZoomValue <= _options.maxZoom)) {
            changedDelta += Math.abs(delta);
          } else {
            changedDelta = 0;
          }
          e.preventDefault();
          if (changedDelta > MOUSE_WHEEL_COUNT) return;
          const contOffset = container.getBoundingClientRect();
          const x = (e.pageX || e.pageX) - (contOffset.left + document.body.scrollLeft);
          const y = (e.pageY || e.pageY) - (contOffset.top + document.body.scrollTop);
          _this7.zoom(newZoomValue, { x, y });
          _this7.showSnapView();
        };
        this._ev = assignEvent(imageWrap, 'wheel', onMouseWheel);
      },
    }, {
      key: '_doubleTapToZoom',
      value: function _doubleTapToZoom() {
        const _this8 = this;

        const imageWrap = this._elements.imageWrap; // handle double tap for zoom in and zoom out

        let touchTime = 0;
        let point;

        const onDoubleTap = function onDoubleTap(e) {
          if (touchTime === 0) {
            touchTime = Date.now();
            point = {
              x: e.pageX,
              y: e.pageY,
            };
          } else if (Date.now() - touchTime < 500 && Math.abs(e.pageX - point.x) < 50 && Math.abs(e.pageY - point.y) < 50) {
            if (_this8._state.zoomValue === _this8._options.zoomValue) {
              _this8.zoom(200);
            } else {
              _this8.resetZoom();
            }

            touchTime = 0;
          } else {
            touchTime = 0;
          }
        };

        assignEvent(imageWrap, 'click', onDoubleTap);
      },
    }, {
      key: '_getImageCurrentDim',
      value: function _getImageCurrentDim() {
        const _this$_state2 = this._state;
        const zoomValue = _this$_state2.zoomValue;
        const imageDim = _this$_state2.imageDim;
        return {
          w: imageDim.w * (zoomValue / 100),
          h: imageDim.h * (zoomValue / 100),
        };
      },
    }, {
      key: '_loadImages',
      value: function _loadImages() {
        const _this9 = this;
        const _images = this._images;
        const _elements = this._elements;
        const imageSrc = _images.imageSrc;
        const hiResImageSrc = _images.hiResImageSrc;
        const container = _elements.container;
        const snapImageWrap = _elements.snapImageWrap;
        const imageWrap = _elements.imageWrap;
        const ivLoader = container.querySelector('.iv-loader'); // remove old images
        remove(container.querySelectorAll('.iv-snap-image, .iv-image')); // add snapView image
        const snapImage = createElement({
          tagName: 'img',
          className: 'iv-snap-image',
          src: imageSrc,
          insertBefore: snapImageWrap.firstChild,
          parent: snapImageWrap,
        }); // add image
        const image = createElement({
          tagName: 'img',
          className: 'iv-image iv-small-image',
          src: imageSrc,
          parent: imageWrap,
        });
        this._state.loaded = false; // store image reference in _elements
        this._elements.image = image;
        this._elements.snapImage = snapImage;
        css(ivLoader, { display: 'block' }); // keep visibility hidden until image is loaded
        css(image, { visibility: 'hidden' }); // hide snap view if open
        this.hideSnapView();
        const onImageLoad = function onImageLoad() {
          // hide the iv loader
          css(ivLoader, { display: 'none' }); // show the image
          css(image, { visibility: 'visible' }); // load high resolution image if provided
          if (hiResImageSrc) _this9._loadHighResImage(hiResImageSrc); // set loaded flag to true
          _this9._state.loaded = true; // calculate the dimension
          _this9._calculateDimensions(); // reset the zoom
          _this9.resetZoom();
        };
        if (imageLoaded(image)) onImageLoad();
        else this._events.imageLoad = assignEvent(image, 'load', onImageLoad);
      },
    }, {
      key: '_loadHighResImage',
      value: function _loadHighResImage(hiResImageSrc) {
        const _this10 = this;
        const _this$_elements5 = this._elements;
        const imageWrap = _this$_elements5.imageWrap;
        const container = _this$_elements5.container;
        const lowResImg = this._elements.image;
        const hiResImage = createElement({
          tagName: 'img',
          className: 'iv-image iv-large-image',
          src: hiResImageSrc,
          parent: imageWrap,
          style: lowResImg.style.cssText,
        }); // add all the style attributes from lowResImg to highResImg
        hiResImage.style.cssText = lowResImg.style.cssText;
        this._elements.image = container.querySelectorAll('.iv-image');
        const onHighResImageLoad = function onHighResImageLoad() {
          // remove the low size image and set this image as default image
          remove(lowResImg);
          _this10._elements.image = hiResImage; // this._calculateDimensions();
        };

        if (imageLoaded(hiResImage)) {
          onHighResImageLoad();
        } else {
          this._events.hiResImageLoad = assignEvent(hiResImage, 'load', onHighResImageLoad);
        }
      },
    }, {
      key: '_calculateDimensions',
      value: function _calculateDimensions() {
        const _this$_elements6 = this._elements;
        const image = _this$_elements6.image;
        const container = _this$_elements6.container;
        const snapView = _this$_elements6.snapView;
        const snapImage = _this$_elements6.snapImage;
        const zoomHandle = _this$_elements6.zoomHandle; // calculate content width of image and snap image

        const imageWidth = parseInt(css(image, 'width'), 10);
        const imageHeight = parseInt(css(image, 'height'), 10);
        const contWidth = parseInt(css(container, 'width'), 10);
        const contHeight = parseInt(css(container, 'height'), 10);
        const snapViewWidth = snapView.clientWidth;
        const snapViewHeight = snapView.clientHeight; // set the container dimension

        this._state.containerDim = {
          w: contWidth,
          h: contHeight,
        }; // set the image dimension

        const ratio = imageWidth / imageHeight;
        const imgWidth = imageWidth > imageHeight && contHeight >= contWidth || ratio * contHeight > contWidth ? contWidth : ratio * contHeight;
        const imgHeight = imgWidth / ratio;
        this._state.imageDim = {
          w: imgWidth,
          h: imgHeight,
        }; // reset image position and zoom

        css(image, {
          width: ''.concat(imgWidth, 'px'),
          height: ''.concat(imgHeight, 'px'),
          left: ''.concat((contWidth - imgWidth) / 2, 'px'),
          top: ''.concat((contHeight - imgHeight) / 2, 'px'),
          maxWidth: 'none',
          maxHeight: 'none',
        }); // set the snap Image dimension

        const snapWidth = imgWidth > imgHeight ? snapViewWidth : imgWidth * snapViewHeight / imgHeight;
        const snapHeight = imgHeight > imgWidth ? snapViewHeight : imgHeight * snapViewWidth / imgWidth;
        this._state.snapImageDim = {
          w: snapWidth,
          h: snapHeight,
        };
        css(snapImage, {
          width: ''.concat(snapWidth, 'px'),
          height: ''.concat(snapHeight, 'px'),
        }); // calculate zoom slider area

        this._state.zoomSliderLength = snapViewWidth - zoomHandle.offsetWidth;
      },
    }, {
      key: 'resetZoom',
      value: function resetZoom() {
        const animate = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
        const zoomValue = this._options.zoomValue;

        if (!animate) {
          this._state.zoomValue = zoomValue;
        }

        this.zoom(zoomValue);
      },
    }, {
      key: 'load',
      value: function load(imageSrc, hiResImageSrc) {
        this._images = {
          imageSrc,
          hiResImageSrc,
        };

        this._loadImages();
      },
    }, {
      key: 'destroy',
      value: function destroy() {
        const _this$_elements7 = this._elements;
        const container = _this$_elements7.container;
        const domElement = _this$_elements7.domElement; // destroy all the sliders

        Object.entries(this._sliders).forEach((_ref) => {
          const _ref2 = _slicedToArray(_ref, 2);
          const slider = _ref2[1];

          slider.destroy();
        }); // unbind all events

        Object.entries(this._events).forEach((_ref3) => {
          const _ref4 = _slicedToArray(_ref3, 2);
          const unbindEvent = _ref4[1];

          unbindEvent();
        }); // clear all the frames

        this._clearFrames(); // remove html from the container

        remove(container.querySelector('.iv-wrap')); // remove iv-container class from container
        removeClass(container, 'iv-container'); // remove added style from container
        removeCss(document.querySelector('html'), 'relative'); // if container has original image, unwrap the image and remove the class
        // which will happen when domElement is not the container

        if (domElement !== container) {
          unwrap(domElement);
        } // remove imageViewer reference from dom element

        domElement._imageViewer = null;
      },
    }]);

    return ImageViewer;
  }());

  ImageViewer.defaults = {
    zoomValue: 100,
    snapView: true,
    maxZoom: 1000,
    refreshOnResize: true,
    zoomOnMouseWheel: true,
  };

  const fullScreenHtml = '\n  <div class="iv-fullscreen-container"></div>\n  <div class="iv-fullscreen-close"></div>\n';

  const FullScreenViewer = (function (_ImageViewer) {
    _inherits(FullScreenViewer, _ImageViewer);

    function FullScreenViewer() {
      const options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _classCallCheck(this, FullScreenViewer);
      const fullScreenElem = createElement({
        tagName: 'div',
        className: 'iv-fullscreen',
        html: fullScreenHtml,
        parent: document.body,
      });
      const container = fullScreenElem.querySelector('.iv-fullscreen-container'); // call the ImageViewer constructor
      const _this = _possibleConstructorReturn(this, _getPrototypeOf(FullScreenViewer).call(this, container, _objectSpread({}, options, {
        refreshOnResize: false,
      }))); // add fullScreenElem on element list
      _defineProperty(_assertThisInitialized(_this), 'hide', () => {
        // hide the fullscreen
        css(_this._elements.fullScreen, {
          display: 'none',
        }); // enable scroll
        removeCss(document.querySelector('html'), 'overflow'); // remove window event
        _this._events.onWindowResize();
      });
      _this._elements.fullScreen = fullScreenElem;
      _this._initFullScreenEvents();
      return _this;
    }

    _createClass(FullScreenViewer, [{
      key: '_initFullScreenEvents',
      value: function _initFullScreenEvents() {
        const fullScreen = this._elements.fullScreen;
        const closeBtn = fullScreen.querySelector('.iv-fullscreen-close'); // add close button event
        this._events.onCloseBtnClick = assignEvent(closeBtn, 'click', this.hide);
      },
    }, {
      key: 'show',
      value: function show(imageSrc, hiResImageSrc) {
        // show the element
        css(this._elements.fullScreen, {
          display: 'block',
        }); // if image source is provide load image source
        if (imageSrc) {
          this.load(imageSrc, hiResImageSrc);
        } // handle window resize
        this._events.onWindowResize = assignEvent(window, 'resize', this.refresh); // disable scroll on html
        css(document.querySelector('html'), {
          overflow: 'hidden',
        });
      },
    }, {
      key: 'destroy',
      value: function destroy() {
        const fullScreen = this._elements.fullScreen; // destroy image viewer
        _get(_getPrototypeOf(FullScreenViewer.prototype), 'destroy', this).call(this); // remove the element
        remove(fullScreen);
      },
    }]);

    return FullScreenViewer;
  }(ImageViewer));

  ImageViewer.FullScreenViewer = FullScreenViewer;

  return ImageViewer;
}));
