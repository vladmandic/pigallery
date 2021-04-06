/* eslint-disable max-classes-per-file */

// Based on iv-viewer - 2.0.1 Author : Sudhanshu Yadav git+https://github.com/s-yadav/iv-viewer.git

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
  <div class="iv-image-view" >
    <div class="iv-image-wrap" ></div>
  </div>
`;

function noop() {}

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
  if (options.child) elem.appendChild(options.child);
  if (options.insertBefore) options.parent.insertBefore(elem, options.insertBefore);
  else options.parent.appendChild(elem);
  return elem;
}

function addClass(el, className) {
  const classNameAry = className.split(' ');
  if (classNameAry.length > 1) classNameAry.forEach((classItem) => addClass(el, classItem));
  else if (el.classList) el.classList.add(className);
  else el.className += ` ${className}`;
}

function removeClass(el, className) {
  const classNameAry = className.split(' ');
  if (classNameAry.length > 1) classNameAry.forEach((classItem) => removeClass(el, classItem));
  else if (el.classList) el.classList.remove(className);
  else el.className = el.className.replace(new RegExp(`(^|\\b)${className.split(' ').join('|')}(\\b|$)`, 'gi'), ' ');
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
  if (typeof properties === 'string') return window.getComputedStyle(elmArray[0])[properties];
  elmArray.forEach((element) => {
    Object.keys(properties).forEach((key) => {
      const value = properties[key];
      element.style[key] = value;
    });
  });
  return undefined;
}

function removeCss(element, property) {
  element.style.removeProperty(property);
}

function wrap(element, { tag = 'div', className, id = null, style }) {
  const wrapper = document.createElement(tag);
  if (className) wrapper.className = className;
  if (id) wrapper.id = id;
  if (style) Object.assign(wrapper.style, style);
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
  elmArray.forEach((element) => element.parentNode?.removeChild(element));
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function assignEvent(element, events, handler) {
  if (typeof events === 'string') events = [events];
  events.forEach((event) => element.addEventListener(event, handler));
  return () => {
    events.forEach((event) => element.removeEventListener(event, handler));
  };
}

function getTouchPointsDistance(touches) {
  const touch0 = touches[0];
  const touch1 = touches[1];
  return Math.sqrt(((touch1.pageX - touch0.pageX) ** 2) + ((touch1.pageY - touch0.pageY) ** 2));
}

class Slider {
  constructor(container, callbacks) {
    this.container = container;
    this.isSliderEnabled = callbacks.isSliderEnabled || noop;
    this.onStart = callbacks.onStart || noop;
    this.onMove = callbacks.onMove || noop;
    this.onEnd = callbacks.onEnd || noop;
    this.initial = true;
    this.init();
  }

  initHandler(eStart) {
    if (!this.isSliderEnabled()) return;
    this.removeListeners();
    eStart.preventDefault();
    const isTouchEvent = eStart.type === 'touchstart' || eStart.type === 'touchend';
    this.touchStartEvent = isTouchEvent ? 'touchstart' : 'mousedown';
    this.touchMoveEvent = isTouchEvent ? 'touchmove' : 'mousemove';
    this.touchEndEvent = isTouchEvent ? 'touchend' : 'mouseup';
    this.sx = isTouchEvent ? eStart.touches[0].clientX : eStart.clientX;
    this.sy = isTouchEvent ? eStart.touches[0].clientY : eStart.clientY;
    this.onStart(eStart, {
      x: this.sx,
      y: this.sy,
    });
    if (this.initial) {
      document.addEventListener(this.touchStartEvent, () => this.startHandler(), { passive: true });
      document.addEventListener(this.touchMoveEvent, (e) => this.moveHandler(e), { passive: true });
      document.addEventListener(this.touchEndEvent, () => this.endHandler(), { passive: true });
      document.addEventListener('contextmenu', () => this.endHandler());
    }
    this.initial = false;
  }

  startHandler() {
    this.moving = true;
  }

  moveHandler(eMove) {
    if (!this.moving || !this.isSliderEnabled()) return;
    const isTouchEvent = eMove.type === 'touchstart' || eMove.type === 'touchend';
    const mx = isTouchEvent ? eMove.touches[0].clientX : eMove.clientX;
    const my = isTouchEvent ? eMove.touches[0].clientY : eMove.clientY;
    this.onMove(eMove, {
      dx: mx - this.sx,
      dy: my - this.sy,
      mx,
      my,
    });
  }

  endHandler() {
    this.moving = false;
    if (!this.isSliderEnabled()) return;
    // this.removeListeners();
    this.onEnd();
  }

  removeListeners() {
    document.removeEventListener('touchmove', this.moveHandler);
    document.removeEventListener('mousemove', this.moveHandler);
    document.removeEventListener('touchend', this.endHandler);
    document.removeEventListener('mouseup', this.endHandler);
    document.removeEventListener('contextmenu', this.endHandler);
  }

  init() {
    ['touchstart', 'mousedown'].forEach((evt) => this.container.addEventListener(evt, (e) => this.initHandler(e)));
  }

  destroy() {
    ['touchstart', 'mousedown'].forEach((evt) => this.container.removeEventListener(evt, (e) => this.initHandler(e)));
    this.removeListeners();
  }
}

class ImageViewer {
  constructor(element, imageViewerOptions = {}) {
    const { container, domElement, imageSrc, hiResImageSrc } = this.findContainerAndImageSrc(element);
    this.elements = { container, domElement };
    this.options = { ...ImageViewer.defaults, ...imageViewerOptions };
    this.events = {};
    this.frames = {};
    this.sliders = {};
    this.state = { zoomValue: this.options.zoomValue };
    this.images = { imageSrc, hiResImageSrc };
    this.init();
    if (imageSrc) this.loadImages();
    domElement.imageViewer = this;
  }

  // eslint-disable-next-line class-methods-use-this
  findContainerAndImageSrc(element) {
    let imageSrc;
    let hiResImageSrc;
    const domElement = (typeof element === 'string') ? document.querySelector(element) : element;
    if (domElement.imageViewer) throw new Error('An image viewer is already being initiated on the element.');
    if (domElement.tagName === 'IMG') {
      imageSrc = domElement.src;
      hiResImageSrc = domElement.getAttribute('high-res-src') || domElement.getAttribute('data-high-res-src');
      element = wrap(domElement, { className: 'iv-container iv-image-mode', style: { display: 'inline-block', overflow: 'hidden' } });
      css(domElement, { opacity: 0, position: 'relative', zIndex: -1 });
    } else {
      imageSrc = domElement.getAttribute('src') || domElement.getAttribute('data-src');
      hiResImageSrc = domElement.getAttribute('high-res-src') || domElement.getAttribute('data-high-res-src');
    }
    return {
      container: element,
      domElement,
      imageSrc,
      hiResImageSrc,
    };
  }

  init() {
    this.initDom();
    this.initImageSlider();
    this.initSnapSlider();
    this.initZoomSlider();
    this.pinchAndZoom();
    this.scrollZoom();
    this.doubleTapToZoom();
    this.initEvents();
  }

  initDom() {
    createElement({
      tagName: 'div',
      className: 'iv-wrap',
      html: imageViewHtml,
      parent: this.elements.container,
    });
    addClass(this.elements.container, 'iv-container');
    if (css(this.elements.container, 'position') === 'static') {
      css(this.elements.container, { position: 'relative' });
    }
    this.elements = {
      ...this.elements,
      snapView: this.elements.container.querySelector('.iv-snap-view'),
      snapImageWrap: this.elements.container.querySelector('.iv-snap-image-wrap'),
      imageWrap: this.elements.container.querySelector('.iv-image-wrap'),
      snapHandle: this.elements.container.querySelector('.iv-snap-handle'),
      zoomHandle: this.elements.container.querySelector('.iv-zoom-handle'),
    };
  }

  initImageSlider() {
    let positions;
    let currentPos;
    const imageSlider = new Slider(this.elements.imageWrap, {
      isSliderEnabled: () => this.state.loaded && !this.state.zooming,
      onStart: (position) => {
        this.clearFrames();
        this.sliders.snapSlider.onStart();
        positions = [position, position];
        currentPos = 0;
        this.frames.slideMomentumCheck = setInterval(() => {
          if (!currentPos) return;
          positions.shift();
          positions.push({
            x: currentPos.mx,
            y: currentPos.my,
          });
        }, 50);
      },
      onMove: (e, position) => {
        const imageCurrentDim = this.getImageCurrentDim();
        currentPos = position;
        this.sliders.snapSlider.onMove(e, {
          dx: -position.dx * this.state.snapImageDim?.w / imageCurrentDim?.w,
          dy: -position.dy * this.state.snapImageDim?.h / imageCurrentDim?.h,
        });
      },
      onEnd: () => {
        const imageCurrentDim = this.getImageCurrentDim();
        this.clearFrames();
        let step; let positionX;
        let positionY;
        const xDiff = positions[1].x - positions[0].x;
        const yDiff = positions[1].y - positions[0].y;
        const momentum = () => {
          if (step <= 60) this.frames.sliderMomentumFrame = requestAnimationFrame(momentum);
          positionX += easeOutQuart(step, xDiff / 3, -xDiff / 3, 60);
          positionY += easeOutQuart(step, yDiff / 3, -yDiff / 3, 60);
          this.sliders.snapSlider.onMove(null, {
            dx: -(positionX * this.state.snapImageDim?.w / imageCurrentDim?.w),
            dy: -(positionY * this.state.snapImageDim?.h / imageCurrentDim?.h),
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
    this.sliders.imageSlider = imageSlider;
  }

  initSnapSlider() {
    let startHandleTop;
    let startHandleLeft;
    const snapSlider = new Slider(this.elements.snapHandle, {
      isSliderEnabled: () => this.state.loaded,
      onStart: () => {
        startHandleTop = parseFloat(css(this.elements.snapHandle, 'top'));
        startHandleLeft = parseFloat(css(this.elements.snapHandle, 'left'));
        clearInterval(this.frames.slideMomentumCheck);
        cancelAnimationFrame(this.frames.sliderMomentumFrame);
      },
      onMove: (e, position) => {
        const imageCurrentDim = this.getImageCurrentDim();
        const maxLeft = Math.max(this.state.snapImageDim?.w - this.state.snapHandleDim?.w, startHandleLeft);
        const maxTop = Math.max(this.state.snapImageDim?.h - this.state.snapHandleDim?.h, startHandleTop);
        const minLeft = Math.min(0, startHandleLeft);
        const minTop = Math.min(0, startHandleTop);
        const left = clamp(startHandleLeft + position.dx, minLeft, maxLeft);
        const top = clamp(startHandleTop + position.dy, minTop, maxTop);
        const imgLeft = -left * imageCurrentDim?.w / this.state.snapImageDim?.w;
        const imgTop = -top * imageCurrentDim?.h / this.state.snapImageDim?.h;
        css(this.elements.snapHandle, { left: `${left}px`, top: `${top}px` });
        css(this.elements.image, { left: `${imgLeft}px`, top: `${imgTop}px` });
      },
    });
    this.sliders.snapSlider = snapSlider;
  }

  initZoomSlider() {
    const sliderElm = this.elements.snapView.querySelector('.iv-zoom-slider');
    let leftOffset;
    let handleWidth;
    const zoomSlider = new Slider(sliderElm, {
      isSliderEnabled: () => this.state.loaded,
      onStart: (eStart) => {
        leftOffset = sliderElm.getBoundingClientRect().left + document.body.scrollLeft;
        handleWidth = parseInt(css(this.elements.zoomHandle, 'width'), 10);
        this.sliders.zoomSlider.onMove(eStart);
      },
      onMove: (e) => {
        const pageX = e.pageX; // || e.touches && (e.touches.length > 0) ? e.touches[0]?.pageX : 0;
        const newLeft = clamp(pageX - leftOffset - handleWidth / 2, 0, this.state.zoomSliderLength);
        const zoomValue = 100 + (this.options.maxZoom - 100) * newLeft / this.state.zoomSliderLength;
        this.zoom(zoomValue);
      },
    });
    this.sliders.zoomSlider = zoomSlider;
  }

  initEvents() {
    this.snapViewEvents();
  }

  snapViewEvents() {
    this.events.snapViewOnMouseMove = assignEvent(this.elements.imageWrap, ['touchmove', 'mousemove'], () => {
      this.showSnapView();
    });
    this.events.mouseEnterSnapView = assignEvent(this.elements.snapView, ['mouseenter', 'touchstart'], () => {
      this.state.snapViewVisible = false;
      this.showSnapView(true);
    });
    this.events.mouseLeaveSnapView = assignEvent(this.elements.snapView, ['mouseleave', 'touchend'], () => {
      this.state.snapViewVisible = false;
      this.showSnapView();
    });
  }

  pinchAndZoom() {
    const onPinchStart = (eStart) => {
      if (!this.state.loaded) return;
      const touch0 = eStart.touches[0];
      const touch1 = eStart.touches[1];
      if (!(touch0 && touch1)) return;
      this.state.zooming = true;
      const contOffset = this.elements.container.getBoundingClientRect();
      const startDist = getTouchPointsDistance(eStart.touches);
      const center = {
        x: (touch1.pageX + touch0.pageX) / 2 - (contOffset.left + document.body.scrollLeft),
        y: (touch1.pageY + touch0.pageY) / 2 - (contOffset.top + document.body.scrollTop),
      };
      const moveListener = (eMove) => {
        const newDist = getTouchPointsDistance(eMove.touches);
        const zoomValue = this.state.zoomValue + (newDist - startDist) / this.options.zoomSensitivity;
        if (zoomValue > this.options.minZoom && zoomValue < this.options.maxZoom) this.zoom(zoomValue, center);
      };
      const endListener = (eEnd) => {
        this.events.pinchMove();
        this.events.pinchEnd();
        this.state.zooming = false;
        if (eEnd.touches.length === 1) this.sliders.imageSlider.startHandler(eEnd);
      };
      if (this.events.pinchMove) this.events.pinchMove();
      if (this.events.pinchEnd) this.events.pinchEnd();
      this.events.pinchMove = assignEvent(document, 'touchmove', moveListener);
      this.events.pinchEnd = assignEvent(document, 'touchend', endListener);
    };
    this.events.pinchStart = assignEvent(this.elements.imageWrap, 'touchstart', onPinchStart);
  }

  scrollZoom() {
    const onMouseWheel = (e) => {
      if (!this.options.zoomWheel || !this.state.loaded) return;
      e.preventDefault();
      this.clearFrames();
      const delta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail || -e.deltaY));
      const newZoomValue = this.state.zoomValue * (100 + delta * this.options.zoomStep) / 100;
      const contOffset = this.elements.container.getBoundingClientRect();
      const x = (e.pageX || e.pageX) - (contOffset.left + document.body.scrollLeft);
      const y = (e.pageY || e.pageY) - (contOffset.top + document.body.scrollTop);
      this.zoom(newZoomValue, { x, y });
      this.showSnapView();
    };
    this.ev = assignEvent(this.elements.imageWrap, 'wheel', onMouseWheel);
  }

  doubleTapToZoom() {
    let touchTime = 0;
    let point;
    const onDoubleTap = (e) => {
      if (touchTime === 0) {
        touchTime = Date.now();
        point = { x: e.pageX, y: e.pageY };
      } else if (Date.now() - touchTime < 500 && Math.abs(e.pageX - point.x) < 50 && Math.abs(e.pageY - point.y) < 50) {
        if (this.state.zoomValue === this.options.zoomValue) this.zoom(200);
        else this.resetZoom();
        touchTime = 0;
      } else {
        touchTime = 0;
      }
    };
    assignEvent(this.elements.imageWrap, 'click', onDoubleTap);
  }

  getImageCurrentDim() {
    return {
      w: this.state.imageDim?.w * (this.state.zoomValue / 100),
      h: this.state.imageDim?.h * (this.state.zoomValue / 100),
    };
  }

  loadImages() {
    const ivLoader = this.elements.container.querySelector('.iv-loader');
    remove(this.elements.container.querySelectorAll('.iv-snap-image, .iv-image'));
    const snapImage = createElement({
      tagName: 'img',
      className: 'iv-snap-image',
      src: this.images.imageSrc,
      insertBefore: this.elements.snapImageWrap.firstChild,
      parent: this.elements.snapImageWrap,
    });
    const image = createElement({
      tagName: 'img',
      className: 'iv-image iv-small-image',
      src: this.images.imageSrc,
      parent: this.elements.imageWrap,
    });
    this.state.loaded = false;
    this.elements.image = image;
    this.elements.snapImage = snapImage;
    css(ivLoader, { display: 'block' });
    css(image, { visibility: 'hidden' });
    this.hideSnapView();
    const onImageLoad = () => {
      css(ivLoader, { display: 'none' });
      css(image, { visibility: 'visible' });
      if (this.images.hiResImageSrc) {
        this.loadHighResImage(this.images.hiResImageSrc);
      }
      this.state.loaded = true;
      this.calculateDimensions();
      this.resetZoom();
    };
    if (imageLoaded(image)) onImageLoad();
    else this.events.imageLoad = assignEvent(image, 'load', onImageLoad);
  }

  loadHighResImage(hiResImageSrc) {
    const lowResImg = this.elements.image;
    const hiResImage = createElement({
      tagName: 'img',
      className: 'iv-image iv-large-image',
      src: hiResImageSrc,
      parent: this.elements.imageWrap,
      style: lowResImg.style.cssText,
    });
    hiResImage.style.cssText = lowResImg.style.cssText;
    this.elements.image = this.elements.container.querySelectorAll('.iv-image');
    const onHighResImageLoad = () => {
      remove(lowResImg);
      this.elements.image = hiResImage;
    };
    if (imageLoaded(hiResImage)) onHighResImageLoad();
    else this.events.hiResImageLoad = assignEvent(hiResImage, 'load', onHighResImageLoad);
  }

  calculateDimensions() {
    const imageWidth = parseInt(css(this.elements.image, 'width'));
    const imageHeight = parseInt(css(this.elements.image, 'height'));
    const contWidth = parseInt(css(this.elements.container, 'width'));
    const contHeight = parseInt(css(this.elements.container, 'height'));
    const snapViewWidth = this.elements.snapView.clientWidth;
    const snapViewHeight = this.elements.snapView.clientHeight;
    this.state.containerDim = { w: contWidth, h: contHeight };
    const ratio = imageWidth / imageHeight;
    const imgWidth = imageWidth > imageHeight && contHeight >= contWidth || ratio * contHeight > contWidth ? contWidth : ratio * contHeight;
    const imgHeight = imgWidth / ratio;
    this.state.imageDim = { w: imgWidth, h: imgHeight };
    css(this.elements.image, {
      width: `${imgWidth}px`,
      height: `${imgHeight}px`,
      left: `${(contWidth - imgWidth) / 2}px`,
      top: `${(contHeight - imgHeight) / 2}px`,
    });
    const snapWidth = imgWidth > imgHeight ? snapViewWidth : imgWidth * snapViewHeight / imgHeight;
    const snapHeight = imgHeight > imgWidth ? snapViewHeight : imgHeight * snapViewWidth / imgWidth;
    this.state.snapImageDim = {
      w: snapWidth,
      h: snapHeight,
    };
    css(this.elements.snapImage, {
      width: `${snapWidth}px`,
      height: `${snapHeight}px`,
    });
    this.state.zoomSliderLength = snapViewWidth - this.elements.zoomHandle.offsetWidth;
  }

  resetZoom(animate = true) {
    if (!animate) this.state.zoomValue = this.options.zoomValue;
    this.zoom(this.options.zoomValue);
  }

  async zoom(perc, point) {
    perc = Math.round(Math.max(this.options.minZoom, perc));
    perc = Math.min(this.options.maxZoom, perc);
    point = point || { x: this.state.containerDim?.w / 2, y: this.state.containerDim?.h / 2 };
    const curLeft = parseFloat(css(this.elements.image, 'left'));
    const curTop = parseFloat(css(this.elements.image, 'top'));
    this.clearFrames();
    let step = 0;
    const baseLeft = (this.state.containerDim?.w - this.state.imageDim?.w) / 2;
    const baseTop = (this.state.containerDim?.h - this.state.imageDim?.h) / 2;
    const baseRight = this.state.containerDim?.w - baseLeft;
    const baseBottom = this.state.containerDim?.h - baseTop;
    const zoomRecursive = () => {
      step++;
      if (step < 16) this.frames.zoomFrame = requestAnimationFrame(zoomRecursive);
      const tickZoom = easeOutQuart(step, this.state.zoomValue, perc - this.state.zoomValue, 16);
      const ratio = tickZoom / this.state.zoomValue;
      const imgWidth = this.state.imageDim?.w * tickZoom / 100;
      const imgHeight = this.state.imageDim?.h * tickZoom / 100;
      let newLeft = -((point.x - curLeft) * ratio - point.x);
      let newTop = -((point.y - curTop) * ratio - point.y);
      newLeft = Math.min(newLeft, baseLeft);
      newTop = Math.min(newTop, baseTop);
      if (newLeft + imgWidth < baseRight) newLeft = baseRight - imgWidth;
      if (newTop + imgHeight < baseBottom) newTop = baseBottom - imgHeight;
      css(this.elements.image, {
        height: `${imgHeight}px`,
        width: `${imgWidth}px`,
        left: 0, // `${newLeft}px`,
        top: 0, // `${newTop}px`,
      });
      this.state.zoomValue = tickZoom;
      this.resizeSnapHandle(imgWidth, imgHeight, newLeft, newTop);
      css(this.elements.zoomHandle, { left: `${(tickZoom - 100) * this.state.zoomSliderLength / (this.elements.maxZoom - 100)}px` });
    };
    zoomRecursive();
    return new Promise((resolve) => {
      const wait = setInterval(() => {
        if (step >= 15) {
          clearInterval(wait);
          resolve(true);
        }
      }, 10);
    });
  }

  clearFrames() {
    clearInterval(this.frames.slideMomentumCheck);
    cancelAnimationFrame(this.frames.sliderMomentumFrame);
    cancelAnimationFrame(this.frames.zoomFrame);
  }

  resizeSnapHandle(imgWidth, imgHeight, imgLeft, imgTop) {
    const imageWidth = imgWidth || this.state.imageDim?.w * this.state.zoomValue / 100;
    const imageHeight = imgHeight || this.state.imageDim?.h * this.state.zoomValue / 100;
    const imageLeft = imgLeft || parseFloat(css(this.elements.image, 'left'));
    const imageTop = imgTop || parseFloat(css(this.elements.image, 'top'));
    const left = -imageLeft * this.state.snapImageDim?.w / imageWidth;
    const top = -imageTop * this.state.snapImageDim?.h / imageHeight;
    const handleWidth = this.state.containerDim?.w * this.state.snapImageDim?.w / imageWidth;
    const handleHeight = this.state.containerDim?.h * this.state.snapImageDim?.h / imageHeight;
    css(this.elements.snapHandle, {
      top: `${top}px`,
      left: `${left}px`,
      width: `${handleWidth}px`,
      height: `${handleHeight}px`,
    });
    this.state.snapHandleDim = {
      w: handleWidth,
      h: handleHeight,
    };
  }

  showSnapView(noTimeout) {
    if (!this.options.snapView) return;
    if (this.state.snapViewVisible || this.state.zoomValue <= 100 || !this.state.loaded) return;
    clearTimeout(this.frames.snapViewTimeout);
    this.state.snapViewVisible = true;
    css(this.elements.snapView, { opacity: 1, pointerEvents: 'inherit' });
    if (!noTimeout) this.frames.snapViewTimeout = setTimeout(this.hideSnapView, 1500);
  }

  hideSnapView() {
    if (!this.elements) return;
    css(this.elements.snapView, { opacity: 0, pointerEvents: 'none' });
    this.state.snapViewVisible = false;
  }

  refresh() {
    this.calculateDimensions();
    this.resetZoom();
  }

  load(imageSrc, hiResImageSrc) {
    this.images = { imageSrc, hiResImageSrc };
    this.loadImages();
  }

  destroy() {
    // eslint-disable-next-line no-unused-vars
    Object.entries(this.sliders).forEach(([key, slider]) => slider.destroy());
    // eslint-disable-next-line no-unused-vars
    Object.entries(this.events).forEach(([key, unbindEvent]) => unbindEvent());
    this.clearFrames();
    remove(this.elements.container.querySelector('.iv-wrap'));
    removeClass(this.elements.container, 'iv-container');
    removeCss(document.querySelector('html'), 'relative');
    if (this.elements.domElement !== this.elements.container) unwrap(this.elements.domElement);
    this.elements.domElement.imageViewer = null;
  }
}

ImageViewer.defaults = {
  zoomValue: 100,
  minZoom: 50,
  maxZoom: 500,
  zoomStep: 2,
  zoomSensitivity: 100,
  snapView: true,
  zoomWheel: true,
};

export { ImageViewer as default };
