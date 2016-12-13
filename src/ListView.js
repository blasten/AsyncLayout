import Recycler from './Recycler';
import DomPool from './DomPool';
import {listViewStyles} from './list-view-styles';

export default class ListView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'}).innerHTML = this._getTemplate(listViewStyles());
    this._$scrollingElement = this.shadowRoot.getElementById('scrollingElement');
    this._$parentContainer = this.shadowRoot.getElementById('parentContainer');
    this._props = {};
    const recycler = new Recycler();
    recycler.pool = new DomPool();
    recycler.parentContainer = this._$parentContainer;
    recycler.initMetaForIndex = this._initMetaForIndex;
    recycler.shouldRecycle = this._shouldRecycle;
    recycler.layout = this._layout;
    recycler.makeActive = this._makeActive;
    this._recycler = recycler;
    this._setProps(['numberOfRows', 'domForRow']);
  }

  connectedCallback() {
    this._recycler.mount();
  }

  disconnectedCallback() {
    this._recycler.unmount();
  }

  set poolIdForRow(fn) {
    this._props['poolIdForRow'] = fn;
    this._recycler.poolIdForIndex = (idx) => {
      fn(idx);
    };
  }

  get poolIdForIndex() {
    return this._props['poolIdForRow'];
  }

  set domForRow(fn) {
    this._props['domForRow'] = fn;
    this._recycler.nodeForIndex = (idx, container) => {
      fn(idx, container);
    };
  }

  get domForRow() {
    return this._props['domForRow'];
  }

  set numberOfRows(size) {
    this._recycler.size = size;
  }

  get numberOfRows() {
    return this._recycler.size;
  }

  _initMetaForIndex(idx) {
    return {
      idx: 0,
      h: 0,
      y: 0
    };
  }

  _shouldRecycle(node, meta) {
    const se = this.scrollingElement();
    const clientHeight = this.clientHeight();

    return meta.y + meta.h < se.scrollTop - clientHeight ||
      meta.y + meta.h > se.scrollTop + clientHeight * 2;
  }

  _layout(node, meta) {
    // Set initial styles.
    if (node.style.position != 'absolute') {
      node.style.position = 'absolute';
      node.style.top = '0px';
      node.style.willChange = 'transform';
    }
    transform(node, `translateY(${meta.y}px)`);
  }

  _makeActive(node, meta, idx, from, nodes, metas) {
    meta.h = node.offsetHeight;

    if (from == Recycler.START && idx + 1 < nodes.length) {
      let nextM = metas.get(nodes[idx + 1]);
      meta.y = nextM.y - meta.h;
    }
    else if (from == Recycler.END && idx > 0) {
      let prevM = metas.get(nodes[idx - 1]);
      meta.y = prevM.y + prevM.h;
    }
    else {
      meta.y = 0;
    }
  }

  _getTemplate(styles) {
    return `<div id="scrollingElement" style="${styles.yScrollable}">
      <div id="parentContainer" style="${styles.parentContainer}">
        <slot></slot>
      </div>
    </div>`;
  }

  _setProps(props) {
    props.forEach((prop) => {
      if (this.hasOwnProperty(prop)) {
        let propVal = this[prop];
        delete this[prop];
        this[prop] = propVal;
      }
    });
  }
}

customElements.define('list-view', ListView);
