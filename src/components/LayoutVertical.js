import { clamp, getApproxSize, eventTarget, checkThreshold, setProps,
    getRowOffset, getScrollTop, setScrollTop } from '../utils';
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
    this._sumHeights = 0;
    this._sumNodes = 0;
    this._firstRender = false;
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
    r.size = _ => this.numberOfCells;
    r.createNodeContainer = _ => document.createElement('div');
    this._recycler = r;

    setProps(this, [
      'bottom',
      'poolIdForCell',
      'domForCell',
      'numberOfCells',
      'heightForCell',
      'scrollingElement'
    ]);
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

  set bottom(v) {
    this._props.bottom = v;
  }

  get bottom() {
    return this._props.bottom;
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
    // Try to use the meta of the last node.
    const lastMeta = this._recycler.meta.getByIndex(this.numberOfCells-1);
    return lastMeta ? lastMeta.y + lastMeta.h :
        getApproxSize(this._sumHeights, this._sumNodes, this.numberOfCells);
  }

  get _medianHeight() {
    return this._sumHeights/this._sumNodes || 0;
  }

  async _refresh(top, clientHeight) {
    this._top = top;
    this._clientHeight = clientHeight;
    await this._recycler.recycle();
    this.style.height = `${this._contentHeight}px`;
  }

  async refresh() {
    const top = getScrollTop(this.scrollingElement);
    const clientHeight = this.scrollingElement.clientHeight;

    if (!this._firstRender && this.numberOfCells > 0) {
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
    return checkThreshold(startMeta.y, endMeta.y, this._top, this._clientHeight, from,
        this._clientHeight/2);
  }

  _shouldRecycle(node, meta) {
    return meta.y + meta.h < this._top - this._clientHeight/2 ||
        meta.y > this._top + this._clientHeight*1.5;
  }

  _initMetaForIndex(prevState) {
    // Reuse the same state.
    if (prevState.idx != Recycler.UNKNOWN_INDEX) {
      return prevState;
    }
    let startMeta = this._startMeta;
    if (!startMeta) {
      return { idx: 0, h: 0, y: 0 };
    }
    if (this._top > 0 && !this._shouldRecycle(null, startMeta))  {
      return startMeta;
    }
    return {
      idx: clamp(~~(this._top/this._medianHeight), 0, this.numberOfCells-1),
      h: 0,
      y: this._top
    };
  }

  _layout(node, meta) {
    if (node.style.position != 'absolute') {
      node.style.cssText = styleItemContainerTopVertical;
    }
    node.style.top = `${meta.y}px`;
  }

  _makeActive(node, meta, nodes, metas, idx, from) {
    meta.h = this.heightForCell(meta.idx, node);
    meta.y = getRowOffset(meta, idx, from, nodes, metas);
    // Keep track of the widths to estimate the mean.
    this._sumHeights = this._sumHeights + meta.h;
    this._sumNodes = this._sumNodes + 1;
    this._startMeta = metas.get(nodes[0]);
  }

  _poolIdForIndex(idx) {
    return this.poolIdForCell(this.bottom ? this.numberOfCells - idx - 1 : idx);
  }

  _nodeForIndex(idx, container) {
    return this.domForCell(this.bottom ? this.numberOfCells - idx - 1 : idx, container);
  }
}

customElements.define('layout-vertical', LayoutVertical);
