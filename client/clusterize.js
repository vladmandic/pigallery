/* eslint-disable func-names */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-shadow */
/* eslint-disable no-use-before-define */
/* eslint-disable no-cond-assign */
/* eslint-disable consistent-return */
/* eslint-disable no-undef */

/* Based on Clusterize.js - v0.18.1 - 2018-01-02 http://NeXTs.github.com/Clusterize.js/ */

(function (name, definition) {
  if (typeof module !== 'undefined') module.exports = definition();
  else if (typeof define === 'function' && typeof define.amd === 'object') define(definition);
  else this[name] = definition();
}('Clusterize', () => {
  const Clusterize = function (data) {
    if (!(this instanceof Clusterize)) return new Clusterize(data);
    const self = this;

    const defaults = {
      rows_in_block: 50,
      blocks_in_cluster: 4,
      tag: null,
      show_no_data_row: false,
      no_data_class: 'clusterize-no-data',
      no_data_text: 'No data',
      keep_parity: true,
      callbacks: {},
    };

    // public parameters
    self.options = {};
    const options = ['rows_in_block', 'blocks_in_cluster', 'show_no_data_row', 'no_data_class', 'no_data_text', 'keep_parity', 'tag', 'callbacks'];
    for (let i = 0, option; option = options[i]; i++) {
      self.options[option] = typeof data[option] !== 'undefined' && data[option] != null ? data[option] : defaults[option];
    }

    const elems = ['scroll', 'content'];
    for (let i = 0, elem; elem = elems[i]; i++) {
      self[`${elem}_elem`] = data[`${elem}Id`]
        ? document.getElementById(data[`${elem}Id`])
        : data[`${elem}Elem`];
      if (!self[`${elem}_elem`]) throw new Error(`Error! Could not find ${elem} element`);
    }

    // tabindex forces the browser to keep focus on the scrolling list, fixes #11
    if (!self.content_elem.hasAttribute('tabindex')) self.content_elem.setAttribute('tabindex', 0);

    // private parameters
    let rows = isArray(data.rows) ? data.rows : self.fetchMarkup();
    const cache = {};
    const scroll_top = self.scroll_elem.scrollTop;

    // append initial data
    self.insertToDOM(rows, cache);

    // restore the scroll position
    self.scroll_elem.scrollTop = scroll_top;

    // adding scroll handler
    let last_cluster = false;
    const scrollEv = () => {
      if (last_cluster !== (last_cluster = self.getClusterNum())) self.insertToDOM(rows, cache);
      if (self.options.callbacks.scrollingProgress) self.options.callbacks.scrollingProgress(self.getScrollProgress());
    };
    let resize_debounce = 0;
    const resizeEv = () => {
      clearTimeout(resize_debounce);
      resize_debounce = setTimeout(self.refresh, 100);
    };
    on('scroll', self.scroll_elem, scrollEv);
    on('resize', window, resizeEv);

    // public methods
    self.destroy = (clean) => {
      off('scroll', self.scroll_elem, scrollEv);
      off('resize', window, resizeEv);
      self.html((clean ? self.generateEmptyRow() : rows).join(''));
    };
    self.refresh = (force) => {
      if (self.getRowsHeight(rows) || force) self.update(rows);
    };
    self.update = (new_rows) => {
      rows = isArray(new_rows) ? new_rows : [];
      const scroll_top = self.scroll_elem.scrollTop;
      // fixes #39
      if (rows.length * self.options.item_height < scroll_top) {
        self.scroll_elem.scrollTop = 0;
        last_cluster = 0;
      }
      self.insertToDOM(rows, cache);
      self.scroll_elem.scrollTop = scroll_top;
    };
    self.clear = () => {
      self.update([]);
    };
    self.getRowsAmount = () => rows.length;
    self.getScrollProgress = () => this.options.scroll_top / (rows.length * this.options.item_height) * 100 || 0;

    const add = (where, _new_rows) => {
      const new_rows = isArray(_new_rows) ? _new_rows : [];
      if (!new_rows.length) return;
      rows = where === 'append'
        ? rows.concat(new_rows)
        : new_rows.concat(rows);
      self.insertToDOM(rows, cache);
    };
    self.append = (rows) => {
      add('append', rows);
    };
    self.prepend = (rows) => {
      add('prepend', rows);
    };
  };

  Clusterize.prototype = {
    constructor: Clusterize,
    // fetch existing markup
    fetchMarkup() {
      const rows = [];
      const rows_nodes = this.getChildNodes(this.content_elem);
      while (rows_nodes.length) rows.push(rows_nodes.shift().outerHTML);
      return rows;
    },
    // get tag name, content tag name, tag height, calc cluster height
    exploreEnvironment(rows, cache) {
      const opts = this.options;
      opts.content_tag = this.content_elem.tagName.toLowerCase();
      if (!rows.length) return;
      if (this.content_elem.children.length <= 1) cache.data = this.html(rows[0] + rows[0] + rows[0]);
      if (!opts.tag) opts.tag = this.content_elem.children[0].tagName.toLowerCase();
      this.getRowsHeight(rows);
    },
    getRowsHeight(rows) {
      const opts = this.options;
      const prev_item_height = opts.item_height;
      opts.cluster_height = 0;
      if (!rows.length) return false;
      const nodes = this.content_elem.children;
      if (!nodes.length) return false;
      const node = nodes[Math.floor(nodes.length / 2)];
      opts.item_height = node.offsetHeight;
      // consider table's border-spacing
      if (opts.tag === 'tr' && getStyle('borderCollapse', this.content_elem) !== 'collapse') opts.item_height += parseInt(getStyle('borderSpacing', this.content_elem), 10) || 0;
      // consider margins (and margins collapsing)
      if (opts.tag !== 'tr') {
        const marginTop = parseInt(getStyle('marginTop', node), 10) || 0;
        const marginBottom = parseInt(getStyle('marginBottom', node), 10) || 0;
        opts.item_height += Math.max(marginTop, marginBottom);
      }
      opts.block_height = opts.item_height * opts.rows_in_block;
      opts.rows_in_cluster = opts.blocks_in_cluster * opts.rows_in_block;
      opts.cluster_height = opts.blocks_in_cluster * opts.block_height;
      return prev_item_height !== opts.item_height;
    },
    // get current cluster number
    getClusterNum() {
      this.options.scroll_top = this.scroll_elem.scrollTop;
      const cluster = Math.floor(this.options.scroll_top / (this.options.cluster_height - this.options.block_height)) || 0;
      return cluster;
    },
    // generate empty row if no data provided
    generateEmptyRow() {
      const opts = this.options;
      if (!opts.tag || !opts.show_no_data_row) return [];
      const empty_row = document.createElement(opts.tag);
      const no_data_content = document.createTextNode(opts.no_data_text); let
        td;
      empty_row.className = opts.no_data_class;
      if (opts.tag === 'tr') {
        td = document.createElement('td');
        td.colSpan = 100;
        td.appendChild(no_data_content);
      }
      empty_row.appendChild(td || no_data_content);
      return [empty_row.outerHTML];
    },
    // generate cluster for current scroll position
    generate(rows, cluster_num) {
      const opts = this.options;
      const rows_len = rows.length;
      if (rows_len < opts.rows_in_block) {
        return {
          top_offset: 0,
          bottom_offset: 0,
          rows_above: 0,
          rows: rows_len ? rows : this.generateEmptyRow(),
        };
      }
      const items_start = Math.max((opts.rows_in_cluster - opts.rows_in_block) * cluster_num, 0);
      const items_end = items_start + opts.rows_in_cluster;
      const top_offset = Math.max(items_start * opts.item_height, 0);
      const bottom_offset = Math.max((rows_len - items_end) * opts.item_height, 0);
      const this_cluster_rows = [];
      let rows_above = items_start;
      if (top_offset < 1) {
        rows_above++;
      }
      for (let i = items_start; i < items_end; i++) {
        rows[i] && this_cluster_rows.push(rows[i]);
      }
      return {
        top_offset,
        bottom_offset,
        rows_above,
        rows: this_cluster_rows,
      };
    },
    renderExtraTag(class_name, height) {
      const tag = document.createElement(this.options.tag);
      const clusterize_prefix = 'clusterize-';
      tag.className = [`${clusterize_prefix}extra-row`, clusterize_prefix + class_name].join(' ');
      height && (tag.style.height = `${height}px`);
      return tag.outerHTML;
    },
    // if necessary verify data changed and insert to DOM
    insertToDOM(rows, cache) {
    // explore row's height
      if (!this.options.cluster_height) {
        this.exploreEnvironment(rows, cache);
      }
      const data = this.generate(rows, this.getClusterNum());
      const this_cluster_rows = data.rows.join('');
      const this_cluster_content_changed = this.checkChanges('data', this_cluster_rows, cache);
      const top_offset_changed = this.checkChanges('top', data.top_offset, cache);
      const only_bottom_offset_changed = this.checkChanges('bottom', data.bottom_offset, cache);
      const callbacks = this.options.callbacks;
      const layout = [];

      if (this_cluster_content_changed || top_offset_changed) {
        if (data.top_offset) {
          this.options.keep_parity && layout.push(this.renderExtraTag('keep-parity'));
          layout.push(this.renderExtraTag('top-space', data.top_offset));
        }
        layout.push(this_cluster_rows);
        data.bottom_offset && layout.push(this.renderExtraTag('bottom-space', data.bottom_offset));
        callbacks.clusterWillChange && callbacks.clusterWillChange();
        this.html(layout.join(''));
        this.options.content_tag === 'ol' && this.content_elem.setAttribute('start', data.rows_above);
        this.content_elem.style['counter-increment'] = `clusterize-counter ${data.rows_above - 1}`;
        callbacks.clusterChanged && callbacks.clusterChanged();
      } else if (only_bottom_offset_changed) {
        this.content_elem.lastChild.style.height = `${data.bottom_offset}px`;
      }
    },
    // unfortunately ie <= 9 does not allow to use innerHTML for table elements, so make a workaround
    html(data) {
      const content_elem = this.content_elem;
      content_elem.innerHTML = data;
    },
    getChildNodes(tag) {
      const child_nodes = tag.children; const
        nodes = [];
      for (let i = 0, ii = child_nodes.length; i < ii; i++) {
        nodes.push(child_nodes[i]);
      }
      return nodes;
    },
    checkChanges(type, value, cache) {
      const changed = value !== cache[type];
      cache[type] = value;
      return changed;
    },
  };

  // support functions
  function on(evt, element, fnc) {
    return element.addEventListener ? element.addEventListener(evt, fnc, false) : element.attachEvent(`on${evt}`, fnc);
  }
  function off(evt, element, fnc) {
    return element.removeEventListener ? element.removeEventListener(evt, fnc, false) : element.detachEvent(`on${evt}`, fnc);
  }
  function isArray(arr) {
    return Object.prototype.toString.call(arr) === '[object Array]';
  }
  function getStyle(prop, elem) {
    return window.getComputedStyle ? window.getComputedStyle(elem)[prop] : elem.currentStyle[prop];
  }

  return Clusterize;
}));
