import * as details from './details';

class Thumb extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    const attrImg = this.getAttribute('img') || '';
    const attrSrc = this.getAttribute('src') || '';
    const attrTitle = this.getAttribute('title') || '';

    const div = document.createElement('div');
    div.className = 'col thumbnail';

    const img = document.createElement('img');
    img['loading'] = 'lazy';
    img['className'] = 'thumbnail-img';
    img['src'] = attrSrc;
    img['img'] = attrImg;
    img['title'] = attrTitle;
    img.onclick = () => details.show(`${escape(attrImg)}`);

    div.appendChild(img);

    shadow.appendChild(div);
  }
}

export function init() {
  customElements.define('thumb-info', Thumb);
}

/*
  not used
  defines custom component that can be used in list.printResult instead of generating HMTL
*/
