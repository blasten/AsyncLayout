import { styleLayoutHorizontal, styleItemContainerHorizontal } from './styles';
import { forBeforePaint } from '../Async';
import { eventTarget, checkThreshold, setProps, getColumnOffset, getApproxSize } from '../utils'
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
    const r = new Recycler(this, new DomPool());
    r.initMetaForIndex = this._initMetaForIndex.bind(this);
    r.shouldRecycle = this._shouldRecycle.bind(this);
    r.isClientFull = this._isClientFull.bind(this);
    r.hasEnoughContent = this._hasEnoughContent.bind(this);
    r.poolIdForIndex = this._poolIdForIndex.bind(this);
    r.layout = this._layout.bind(this);
    r.makeActive = this._makeActive.bind(this);
    r.nodeForIndex = this._nodeForIndex.bind(this);
    r.size = _ => this.numberOfCells;
    r.createNodeContainer = _ => document.createElement('div');
    this._recycler = r;

    setProps(this, [
      'poolIdForCell',
      'domForCell',
      'numberOfCells',
      'widthForCell',
      'scrollingElement'
      ]
    );
  }

  async connectedCallback() {
    await forBeforePaint();
    if (!this.scrollingElement) {
      this.scrollingElement = document.scrollingElement;
    }
    this._recycler.enqueuePrerendered();
    this.refresh();
  }

  disconnectedCallback() {
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

  _isClientFull(startMeta, endMeta, from) {
    return checkThreshold(startMeta.x, endMeta.x, 0, this._left,
        this._clientWidth, from);
  }

  _hasEnoughContent(startMeta, endMeta, from) {
    return checkThreshold(startMeta.x, endMeta.x, this._clientWidth/2,
        this._left, this._clientWidth, from);
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

  _makeActive(node, meta, nodes, metas, idx, from) {
    meta.w = this.widthForCell(meta.idx, node);
    meta.x = getColumnOffset(meta, idx, from, nodes, metas);
    // Keep track of the widths to estimate the mean.
    this._sumWidths = this._sumWidths + meta.w;
    this._sumNodes = this._sumNodes + 1;
  }

  _nodeForIndex(idx, container) {
    return this.domForCell(idx, container);
  }
}

customElements.define('layout-horizontal', LayoutHorizontal);
