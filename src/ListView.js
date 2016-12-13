import Recycler from './Recycler';
import DomPool from './DomPool';
import {listViewStyles} from './list-view-styles';

export default class ListView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'}).innerHTML = this._getTemplate(listViewStyles());
    this._$scrollingElement = this.shadowRoot.getElementById('scrollingElement');
    this._props = {};
    const recycler = new Recycler();
    recycler.pool = new DomPool();
    recycler.parentContainer = this;
    recycler.initMetaForIndex = this._initMetaForIndex;
    recycler.shouldRecycle = this._shouldRecycle;
    recycler.isClientFull = this._isClientFull;
    recycler.hasEnoughContent = this._hasEnoughContent;
    recycler.poolIdForIndex = this._poolIdForIndex;
    recycler.layout = this._layout;
    recycler.makeActive = this._makeActive.bind(this);
    this._recycler = recycler;
    this._setProps(['numberOfRows', 'domForRow', 'heightForRow', 'scrollingElement']);
  }

  connectedCallback() {
    this._recycler.mount();
  }

  disconnectedCallback() {
    this._recycler.unmount();
  }

  set poolIdForRow(fn) {
    this._recycler.poolIdForIndex = fn;
  }

  get poolIdForIndex() {
    return this._recycler.poolIdForIndex;
  }

  set domForRow(fn) {
    this._props.domForRow = fn;
    this._recycler.nodeForIndex = (idx, container) => {
      fn(idx, container);
    };
  }

  get domForRow() {
    return this._props.domForRow;
  }

  set numberOfRows(size) {
    this._recycler.size = size;
  }

  get numberOfRows() {
    return this._recycler.size;
  }

  get heightForRow() {
    return this._props.heightForRow;
  }

  set heightForRow(fn) {
    this._props.heightForRow = fn;
  }

  get scrollingElement() {
    return this._props.scrollingElement;
  }

  set scrollingElement(se) {
    this._props.scrollingElement = se;
    this._$scrollingElement.style.cssText = se === this ? listViewStyles().yScrollable : '';
  }

  _isClientFull(nodes, metas, from) {
    return from === Recycler.END ? nodes.length > 100 : true;
  }

  _hasEnoughContent(nodes, metas, from) {
    return true;
  }

  _poolIdForIndex(idx) {
    return 0;
  }

  _initMetaForIndex(idx) {
    return {
      idx: idx,
      h: 0,
      y: 0
    };
  }

  _shouldRecycle(node, meta) {
    return false;
    // const se = this.scrollingElement();
    // const clientHeight = this.clientHeight();

    // return meta.y + meta.h < se.scrollTop - clientHeight ||
    //   meta.y + meta.h > se.scrollTop + clientHeight * 2;
  }

  _layout(node, meta) {
    // Set initial styles.
    if (node.style.position != 'absolute') {
      node.style.position = 'absolute';
      node.style.top = '0px';
      node.style.willChange = 'transform';
    }
    node.style.transform = `translateY(${meta.y}px)`;
  }

  _makeActive(node, meta, idx, from, nodes, metas) {
    meta.h = this._props.heightForRow ?
        this._props.heightForRow(meta.idx, node) : node.offsetHeight;

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
