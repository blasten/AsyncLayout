import Recycler from '../Recycler';
import DomPool from '../DomPool';
import {forBeforePaint} from '../Async';
import {listViewStyles} from '../list-view-styles';

export default class LayoutVertical extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = this._getTemplate(listViewStyles());
    this._$scrollingElement = root.getElementById('scrollingElement');
    this._$parentContainer = root.getElementById('parentContainer');
    this._props = {};
    this._sumHeights = 0;
    this._sumNodes = 0;
    this._scrollDidUpdate = this._scrollDidUpdate.bind(this);
    // Create recyler context.
    const recycler = new Recycler();
    // Set the DOM pool for the context.
    recycler.pool = new DomPool();
    recycler.parentContainer = this;
    recycler.initMetaForIndex = this._initMetaForIndex;
    recycler.shouldRecycle = this._shouldRecycle.bind(this);
    recycler.isClientFull = this._isClientFull.bind(this);
    recycler.hasEnoughContent = this._hasEnoughContent.bind(this);
    recycler.poolIdForIndex = this._poolIdForIndex.bind(this);
    recycler.layout = this._layout.bind(this);
    recycler.makeActive = this._makeActive.bind(this);
    this._recycler = recycler;
    this._setProps(['numberOfRows', 'domForRow', 'heightForRow', 'scrollingElement']);
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
    return this._props.scrollingElement || this;
  }

  set scrollingElement(se) {
    if (this._props.scrollingElement) {
      this._eventTarget(this._props.scrollingElement)
          .removeEventListener('scroll', this._scrollDidUpdate);
    }
    this._props.scrollingElement = se;
    this._$scrollingElement.style.cssText = se === this ? listViewStyles().yScrollable : '';
    window.addEventListener('scroll', this._scrollDidUpdate);
  }

  get _contentHeight() {
    return this._sumHeights + (this.numberOfRows - this._sumNodes) * (this._sumHeights / this._sumNodes);
  }

  _eventTarget(se) {
    const d = document;
    return se === d.body || se === d.documentElement || !(se instanceof HTMLElement) ? null : se;
  }

  async connectedCallback() {
    this._recycler.mount();
    await forBeforePaint();
    this.refresh();
  }

  disconnectedCallback() {
    this._recycler.unmount();
  }

  _scrollDidUpdate() {
    this.refresh();
  }

  async refresh() {
    this._top = this.scrollingElement.scrollTop;
    this._clientHeight = this.scrollingElement.clientHeight;
    await this._recycler.recycle();
    this._$parentContainer.style.height = `${this._contentHeight}px`;
  }

  _checkThresholds(dist, nodes, metas, from) {
    if (nodes.length == 0) {
      return false;
    }
    if (from == Recycler.START) {
      return metas.get(this._recycler.startNode).y <= this._top - dist;
    }
    return metas.get(this._recycler.endNode).y >= this._top + this._clientHeight + dist;
  }

  _isClientFull(nodes, metas, from) {
    return this._checkThresholds(0, nodes, metas, from);
  }

  _hasEnoughContent(nodes, metas, from) {
    return this._checkThresholds(this._clientHeight/2, nodes, metas, from);
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
    return meta.y + meta.h < this._top - this._clientHeight/2 ||
        meta.y > this._top + this._clientHeight*1.5;
  }

  _layout(node, meta) {
    // Set initial styles.
    if (node.style.position != 'absolute') {
      node.style.position = 'absolute';
      node.style.top = '0px';
      node.style.willChange = 'transform';
    }
    node.style.transform = `matrix(1, 0, 0, 1, 0, ${meta.y})`;
  }

  _makeActive(node, meta, idx, from, nodes, metas) {
    meta.h = this._props.heightForRow ?
        this._props.heightForRow(meta.idx, node) : node.offsetHeight;
    // Keep track of the heights to estimate the mean.
    this._sumHeights = this._sumHeights + meta.h;
    this._sumNodes = this._sumNodes + 1;

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
    return `
      <style>
        :host {
          display: block;
        }
      </style>
      <div id="scrollingElement" style="${styles.yScrollable}">
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

customElements.define('layout-vertical', LayoutVertical);
