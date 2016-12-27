import { styleLayoutHorizontal, styleItemContainerHorizontal } from './styles';
import { forBeforePaint } from '../Async';
import Recycler from '../Recycler';
import DomPool from '../DomPool';

export default class LayoutHorizontal extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutHorizontal;
    this._props = {};
    this._sumWidths = 0;
    this._sumNodes = 0;
    this._scrollDidUpdate = this._scrollDidUpdate.bind(this);
    // Create recyler context.
    this._recycler = new Recycler(
      new DomPool(),
      new WeakMap(),
      {
        parentContainer: this,
        initMetaForIndex: this._initMetaForIndex.bind(this),
        shouldRecycle: this._shouldRecycle.bind(this),
        isClientFull: this._isClientFull.bind(this),
        hasEnoughContent: this._hasEnoughContent.bind(this),
        poolIdForIndex: this._poolIdForIndex.bind(this),
        layout: this._layout.bind(this),
        makeActive: this._makeActive.bind(this),
        nodeForIndex: this._nodeForIndex.bind(this),
        size: this._size.bind(this)
      });
    this._setProps([
      'poolIdForCell',
      'domForCell',
      'numberOfCells',
      'widthForCell',
      'scrollingElement'
    ]);
  }

  async connectedCallback() {
    this._recycler.mount();
    await forBeforePaint();
    if (!this.scrollingElement) {
      this.scrollingElement = document.scrollingElement;
    }
    this.refresh();
  }

  disconnectedCallback() {
    this._recycler.unmount();
  }

  set poolIdForCell(fn) {
    this._props.poolIdForCell = fn;
  }

  get poolIdForCell() {
    return this._props.poolIdForCell || (_ => 0);
  }

  set domForCell(fn) {
    this._props.domForCell = fn;
  }

  get domForCell() {
    return this._props.domForCell;
  }

  set numberOfCells(size) {
    this._props.numberOfCells = size;
  }

  get numberOfCells() {
    return this._props.numberOfCells || 0;
  }

  set widthForCell(fn) {
    this._props.widthForCell = fn;
  }

  get widthForCell() {
    return this._props.widthForCell || ((idx, node) => node.getBoundingClientRect().width);
  }

  set scrollingElement(se) {
    if (this._props.$scrollingElement) {
      eventTarget(this._props.$scrollingElement)
          .removeEventListener('scroll', this._scrollDidUpdate);
    }
    this._props.$scrollingElement = se;
    eventTarget(se).addEventListener('scroll', this._scrollDidUpdate);
  }

  get scrollingElement() {
    return this._props.$scrollingElement;
  }

  get _contentWidth() {
    return getApproxSize(this._sumWidths, this._sumNodes, this.numberOfCells);
  }

  _scrollDidUpdate() {
    this.refresh();
  }

  async refresh() {
    this._left = this.scrollingElement.scrollLeft;
    this._clientWidth = this.scrollingElement.clientWidth;
    await this._recycler.recycle();
    this.style.width = `${this._contentWidth}px`;
  }

  _checkThresholds(dist, nodes, metas, from) {
    if (nodes.length == 0) {
      return false;
    }
    if (from == Recycler.START) {
      return metas.get(this._recycler.startNode).x <= this._left - dist;
    }
    return metas.get(this._recycler.endNode).x >= this._left + this._clientWidth + dist;
  }

  _isClientFull(nodes, metas, from) {
    return this._checkThresholds(0, nodes, metas, from);
  }

  _hasEnoughContent(nodes, metas, from) {
    return this._checkThresholds(this._clientWidth/2, nodes, metas, from);
  }

  _poolIdForIndex(idx) {
    return this.poolIdForCell(idx);
  }

  _initMetaForIndex(idx) {
    return { idx: idx, w: 0, x: 0 };
  }

  _shouldRecycle(node, meta) {
    return meta.x + meta.w < this._left - this._clientWidth/2 ||
        meta.x > this._left + this._clientWidth*1.5;
  }

  _layout(node, meta) {
    if (node.style.position != 'absolute') {
      node.style.cssText = styleItemContainerHorizontal;
    }
    node.style.transform = `matrix(1, 0, 0, 1, ${meta.x}, 0)`;
  }

  _makeActive(node, meta, idx, from, nodes, metas) {
    meta.w = this.widthForCell(meta.idx, node);
    if (from == Recycler.START && idx + 1 < nodes.length) {
      let nextM = metas.get(nodes[idx + 1]);
      meta.x = nextM.x - meta.w;
    }
    else if (from == Recycler.END && idx > 0) {
      let prevM = metas.get(nodes[idx - 1]);
      meta.x = prevM.x + prevM.w;
    }
    else {
      meta.x = 0;
    }
    // Keep track of the widths to estimate the mean.
    this._sumWidths = this._sumWidths + meta.w;
    this._sumNodes = this._sumNodes + 1;
  }

  _nodeForIndex(idx, container) {
    return this.domForCell(idx, container);
  }

  _size() {
    return this.numberOfCells;
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

customElements.define('layout-horizontal', LayoutHorizontal);
