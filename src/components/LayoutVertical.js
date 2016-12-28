import { styleLayoutVertical, styleItemContainerTopVertical } from './styles';
import { getApproxSize, eventTarget, checkThreshold, setProps, getRowOffset } from '../utils';
import { forBeforePaint } from '../Async';
import Recycler from '../Recycler';
import DomPool from '../DomPool';

export default class LayoutVertical extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutVertical;
    this._props = {};
    this._sumHeights = 0;
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
    this._recycler = r;

    setProps(this, [
      'poolIdForCell',
      'domForCell',
      'numberOfCells',
      'heightForCell',
      'scrollingElement'
    ]);
  }

  async connectedCallback() {
    this._recycler.mount();
    await forBeforePaint();
    if (!this.scrollingElement) {
      this.scrollingElement = document.scrollingElement;
    }
    await this.refresh();
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

  set heightForCell(fn) {
    this._props.heightForCell = fn;
  }

  get heightForCell() {
    return this._props.heightForCell || ((idx, node) => node.getBoundingClientRect().height);
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

  get _contentHeight() {
    return getApproxSize(this._sumHeights, this._sumNodes, this.numberOfCells);
  }

  _scrollDidUpdate() {
    this.refresh();
  }

  async refresh() {
    this._top = this.scrollingElement.scrollTop;
    this._clientHeight = this.scrollingElement.clientHeight;
    await this._recycler.recycle();
    this.style.height = `${this._contentHeight}px`;
  }

  _isClientFull(startMeta, endMeta, from) {
    return checkThreshold(startMeta.y, endMeta.y, 0, this._top,
        this._clientHeight, from);
  }

  _hasEnoughContent(startMeta, endMeta, from) {
    return checkThreshold(startMeta.y, endMeta.y, this._clientHeight/2,
        this._top, this._clientHeight, from);
  }

  _poolIdForIndex(idx) {
    return this.poolIdForCell(idx);
  }

  _initMetaForIndex(idx) {
    return { idx: idx, h: 0, y: 0 };
  }

  _shouldRecycle(node, meta) {
    return meta.y + meta.h < this._top - this._clientHeight/2 ||
        meta.y > this._top + this._clientHeight*1.5;
  }

  _layout(node, meta) {
    if (node.style.position != 'absolute') {
      node.style.cssText = styleItemContainerTopVertical;
    }
    node.style.transform = `matrix(1, 0, 0, 1, 0, ${meta.y})`;
  }

  _makeActive(node, meta, nodes, metas, idx, from) {
    meta.h = this.heightForCell(meta.idx, node);
    meta.y = getRowOffset(meta, idx, from, nodes, metas);
    // Keep track of the widths to estimate the mean.
    this._sumHeights = this._sumHeights + meta.h;
    this._sumNodes = this._sumNodes + 1;
  }

  _nodeForIndex(idx, container) {
    return this.domForCell(idx, container);
  }
}

customElements.define('layout-vertical', LayoutVertical);
