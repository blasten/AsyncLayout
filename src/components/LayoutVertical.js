import {
    clamp, getApproxSize, eventTarget, checkThreshold, setInstanceProps,
    getRowOffset, getScrollTop, setScrollTop, getHeightForElement,
    getIntervals, findIntervalIdx
} from '../utils';
import { styleLayoutVertical, styleItemContainerTopVertical } from './styles';
import { forBeforePaint } from '../Async';
import Recycler from '../Recycler';
import DomPool from '../DomPool';
import MetaStorage from '../MetaStorage';

export default class LayoutVertical extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutVertical;
    this._props = {};
    this._cacheId = 0;
    this._sumHeights = 0;
    this._sumNodes = 0;
    this._firstRender = false;
    this._startMeta = null;
    this._intervals = null;
    this._scrollDidUpdate = this._scrollDidUpdate.bind(this);
    this._windowDidResize = this._windowDidResize.bind(this);
    // Create recyler context.
    const r = new Recycler(this, new DomPool(), new MetaStorage());
    r.initMetaForIndex = this._initMetaForIndex.bind(this);
    r.shouldRecycle = this._shouldRecycle.bind(this);
    r.isClientFull = this._isClientFull.bind(this);
    r.hasEnoughContent = this._hasEnoughContent.bind(this);
    r.poolIdForIndex = this._poolIdForIndex.bind(this);
    r.layout = this._layout.bind(this);
    r.makeActive = this._makeActive.bind(this);
    r.nodeForIndex = this._nodeForIndex.bind(this);
    r.size = _ => this._size;
    r.createNodeContainer = _ => document.createElement('div');
    this._recycler = r;
    setInstanceProps(this);
  }

  async connectedCallback() {
    await forBeforePaint();
    if (!this.scrollingElement) {
      this.scrollingElement = document.scrollingElement;
    }
    this.refresh();
    window.addEventListener('resize', this._windowDidResize);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._windowDidResize);
  }

  get numberOfSections() {
    return this._props.numberOfSections || 0;
  }

  set numberOfSections(v) {
    this._props.numberOfSections = v;
  }

  get numberOfRowsInSection() {
    return this._props.numberOfRowsInSection || (_ => 0);
  }

  set numberOfRowsInSection(v) {
    this._props.numberOfRowsInSection = v;
  }

  get poolIdForHeader() {
    return this._props.poolIdForHeader || (_ => 'header');
  }

  set poolIdForHeader(v) {
    this._props.poolIdForHeader = v;
  }

  get poolIdForRow() {
    return this._props.poolIdForRow || (_ => 'row');
  }

  set poolIdForRow(v) {
    this._props.poolIdForRow = v;
  }

  get domForHeader() {
    return this._props.domForHeader || (_ => {});
  }

  set domForHeader(v) {
    this._props.domForHeader = v;
  }

  get domForRow() {
    return this._props.domForRow || (_ => {});
  }

  set domForRow(v) {
    this._props.domForRow = v;
  }

  get heightForHeader() {
    return this._props.heightForHeader || getHeightForElement;
  }

  set heightForHeader(v) {
    this._props.heightForHeader = v;
  }

  get heightForRow() {
    return this._props.heightForRow || getHeightForElement;
  }

  set heightForRow(v) {
    this._props.heightForRow = v;
  }

  get scrollingElement() {
    return this._props.scrollingElement;
  }

  set scrollingElement(v) {
    if (this._props.scrollingElement) {
      eventTarget(this._props.scrollingElement)
          .removeEventListener('scroll', this._scrollDidUpdate);
    }
    eventTarget(v).addEventListener('scroll', this._scrollDidUpdate);
    this._props.scrollingElement = v;
  }

  get bottom() {
    return this._props.bottom;
  }

  set bottom(v) {
    this._props.bottom = v;
  }

  get _size() {
    const intervals = this._intervals;
    return intervals && intervals.length > 0 ? intervals[intervals.length-1][1] + 1 : 0;
  }

  get _contentHeight() {
    // Try to use the meta of the last node.
    const size = this._size;
    const lastMeta = this._recycler.meta.getByIndex(size-1);
    return lastMeta ? lastMeta.y + lastMeta.h :
        getApproxSize(this._sumHeights, this._sumNodes, size);
  }

  get _medianHeight() {
    return ~~(this._sumHeights/this._sumNodes);
  }

  async _refresh(top, clientHeight) {
    this._top = top;
    this._clientHeight = clientHeight;
    await this._recycler.recycle();
    this.style.height = this._size == 0 ? '' : `${this._contentHeight}px`;
    // Adjust first node offset and scroll bar if needed.
    if (!this._startMeta) {
      return;
    }
    const startIdx = this._startMeta.idx;
    const startY = this._startMeta.y;
    if ((startIdx > 0 && startY < 0) || (startIdx == 0 && startY != 0)) {
      this._startMeta.y = this._medianHeight * startIdx;
      setScrollTop(this.scrollingElement, this._startMeta.y + this._top - startY);
      this._recycler.enqueueRendered();
      await this._recycler.recycle();
    }
  }

  async refresh() {
    const top = getScrollTop(this.scrollingElement);
    const clientHeight = this.scrollingElement.clientHeight;
    // Update intervals.
    this._intervals = getIntervals(this.numberOfSections, this.numberOfRowsInSection);
    // Invalidate the cache for height.
    this._cacheId++;
    if (!this._firstRender && this._size > 0) {
      this._firstRender = true;
      this._recycler.enqueuePrerendered();
    } else {
      this._recycler.enqueueRendered();
    }
    await this._refresh(top, clientHeight);
  }

  _scrollDidUpdate() {
    this._refresh(getScrollTop(this.scrollingElement), this.scrollingElement.clientHeight);
  }

  _windowDidResize() {
    this.refresh();
  }

  _isClientFull(startMeta, endMeta, from) {
    return checkThreshold(startMeta.y, endMeta.y, this._top, this._clientHeight, from, 0);
  }

  _hasEnoughContent(startMeta, endMeta, from) {
    return true;
  }

  _shouldRecycle(node, meta) {
    return meta.y + meta.h < this._top - this._clientHeight/2 ||
        meta.y > this._top + this._clientHeight*1.5;
  }

  _initMetaForIndex(prevState) {
    let intervals = this._intervals;
    let meta = this._startMeta;

    if (prevState.idx != Recycler.UNKNOWN_IDX) {
      return { idx: prevState.idx, h: prevState.h, y: prevState.y,
          i: findIntervalIdx(prevState.idx, intervals) };
    }
    if (!meta) {
      return { idx: 0, h: 0, y: 0, i: findIntervalIdx(0, intervals) };
    }
    if (this._top > 0 && !this._shouldRecycle(null, meta))  {
      return { idx: meta.idx, h: meta.h, y: meta.y, i: findIntervalIdx(meta.idx, intervals) };
    }
    meta = this._recycler.meta.find('y', this._top);
    if (meta && !this._shouldRecycle(null, meta)) {
      return { idx: meta.idx, h: meta.h, y: meta.y, i: findIntervalIdx(meta.idx, intervals) };
    }
    let idx = clamp(~~(this._top/this._medianHeight), 0, this._size-1);
    return { idx: idx, h: 0, y: this._top, i: findIntervalIdx(idx, intervals) };
  }

  _layout(node, meta) {
    if (node.style.position != 'absolute') {
      node.style.cssText = styleItemContainerTopVertical;
    }
    node.style.top = `${meta.y}px`;
  }

  _makeActive(node, meta, nodes, metas, idx, from) {
    // Use the cached height if the cache id is valid.
    if (meta.cacheId != this._cacheId) {
      const rowIdx = idx - this._intervals[meta.i][0] - 1;
      meta.h = rowIdx == Recycler.UNKNOWN_IDX ? this.heightForHeader(node, meta.i) :
          this.heightForRow(node, meta.i, rowIdx);
    }
    meta.y = getRowOffset(meta, idx, from, nodes, metas);
    meta.cacheId = this._cacheId;
    // Keep track of the widths to estimate the mean.
    this._sumHeights = this._sumHeights + meta.h;
    this._sumNodes = this._sumNodes + 1;
    this._startMeta = metas.get(nodes[0]);
  }

  _poolIdForIndex(idx, meta) {
    const rowIdx = idx - this._intervals[meta.i][0] - 1;
    return rowIdx == Recycler.UNKNOWN_IDX ? this.poolIdForHeader(meta.i) :
        this.poolIdForRow(meta.i, rowIdx);
  }

  _nodeForIndex(node, idx, meta) {
    const rowIdx = idx - this._intervals[meta.i][0] - 1;
    return rowIdx == Recycler.UNKNOWN_IDX ? this.domForHeader(node, meta.i) :
        this.domForRow(node, meta.i, rowIdx);
  }
}

customElements.define('layout-vertical', LayoutVertical);
