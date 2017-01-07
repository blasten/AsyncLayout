import {
    clamp, getApproxSize, eventTarget, checkThreshold, setInstanceProps,
    getRowOffset, getScrollTop, setScrollTop, getHeightForElement,
    getIntervals, findIntervalIdx, NOOP
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
    setInstanceProps({
      numberOfSections: 0,
      numberOfRowsInSection: (_ => 0),
      poolIdForHeader: (_ => 'header'),
      poolIdForRow: (_ => 'row'),
      domForHeader: NOOP,
      domForRow: NOOP,
      heightForHeader: getHeightForElement,
      heightForRow: getHeightForElement,
      scrollingElement: document.scrollingElement,
      bottom: false,
      idForRow: (_ => 0),
      idForHeader: (_ => 0)
    }, this);
  }

  async connectedCallback() {
    await forBeforePaint();
    this.refresh();
    window.addEventListener('resize', this._windowDidResize);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._windowDidResize);
  }

  get props() {
    return this._props;
  }

  set props(v) {
    let oldProps = this._props;
    let newProps = Object.assign({}, oldProps, v);

    if (!oldProps || oldProps.scrollingElement !== newProps.scrollingElement) {
      if (oldProps) {
        eventTarget(oldProps.scrollingElement)
          .removeEventListener('scroll', this._scrollDidUpdate);
      }
      eventTarget(newProps.scrollingElement)
          .addEventListener('scroll', this._scrollDidUpdate);
    }
    this._props = newProps;
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
    let startIdx = this._startMeta.idx;
    let startY = this._startMeta.y;
    if ((startIdx > 0 && startY < 0) || (startIdx == 0 && startY != 0)) {
      this._startMeta.y = this._medianHeight * startIdx;
      setScrollTop(this.props.scrollingElement, this._startMeta.y + this._top - startY);
      this._recycler.enqueueRendered();
      await this._recycler.recycle();
    }
  }

  async refresh() {
    let props = this.props;
    let top = getScrollTop(props.scrollingElement);
    let clientHeight = props.scrollingElement.clientHeight;
    // Update intervals.
    this._intervals = getIntervals(props.numberOfSections, props.numberOfRowsInSection);
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
    let se = this.props.scrollingElement;
    this._refresh(getScrollTop(se), se.clientHeight);
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

  _copyMeta(meta) {
    let intervals = this._intervals;
    let secIdx = findIntervalIdx(meta.idx, intervals);
    let rowIdx = meta.idx - intervals[secIdx][0] - 1;
    let isHeader = rowIdx == Recycler.UNKNOWN_IDX;
    let id = isHeader ? this.props.idForHeader(secIdx) : this.props.idForRow(secIdx, rowIdx);
    return {
      idx: meta.idx,
      h: meta.h,
      y: meta.y,
      id: id,
      isHeader: isHeader,
      secIdx: secIdx,
      rowIdx: rowIdx,
      cacheId: -1
    };
  }

  _initMetaForIndex(prevState) {
    let intervals = this._intervals;
    let meta = this._startMeta;

    if (prevState.idx != Recycler.UNKNOWN_IDX) {
      return this._copyMeta(prevState);
    }
    if (!meta) {
      return this._copyMeta({ idx: 0, h: 0, y: 0 });
    }
    if (this._top > 0 && !this._shouldRecycle(null, meta)) {
      return this._copyMeta(meta);
    }
    meta = this._recycler.meta.find('y', this._top);
    if (meta && !this._shouldRecycle(null, meta)) {
      return this._copyMeta(meta);
    }
    let idx = clamp(~~(this._top/this._medianHeight), 0, this._size-1);
    return this._copyMeta({ idx: idx, h: 0, y: this._top });
  }

  _layout(node, meta) {
    let recycler = this._recycler;
    let intervals = this._intervals;

    if (meta.cacheId != this._cacheId) {
      meta.y = Infinity;
      recycler.preserve(node, false);
      return;
    }

    node.style.position = 'absolute';
    node.style.top = `${meta.y}px`;
    node.style.left = '0px';
    node.style.right = '0px';

    if (!meta.isHeader) {
      return;
    }
    let nextInterval = intervals[meta.secIdx + 1];
    let nextHeaderMeta = nextInterval ? recycler.meta.getByIndex(nextInterval[0]) : null;

    recycler.preserve(node, true);

    if (nextHeaderMeta) {
      if (nextHeaderMeta.y <= this._top) {
        recycler.preserve(node, false);
      } else {
        if (meta.y < this._top) {
          let headerOffset = Math.min(0, nextHeaderMeta.y - this._top - meta.h);
          node.style.position = 'sticky';
          node.style.top = `${headerOffset}px`;
        }
      }
    } else if (meta.y < this._top) {
      node.style.position = 'sticky';
      node.style.top = '0px';
    }
  }

  _makeActive(node, meta, nodes, metas, idx, from) {
    // Use the cached height if the cache id is valid.
    if (meta.cacheId != this._cacheId) {
      meta.h = meta.isHeader ? this.props.heightForHeader(node, meta.secIdx) :
          this.props.heightForRow(node, meta.secIdx, meta.rowIdx);
    }
    meta.y = getRowOffset(meta, idx, from, nodes, metas);
    meta.cacheId = this._cacheId;
    // Keep track of the widths to estimate the mean.
    this._sumHeights = this._sumHeights + meta.h;
    this._sumNodes = this._sumNodes + 1;
    this._startMeta = metas.get(nodes[0]);
  }

  _poolIdForIndex(idx, meta) {
    return meta.isHeader ? this.props.poolIdForHeader(meta.secIdx) :
        this.props.poolIdForRow(meta.secIdx, meta.rowIdx);
  }

  _nodeForIndex(node, idx, meta) {
    return meta.isHeader ? this.props.domForHeader(node, meta.secIdx) :
        this.props.domForRow(node, meta.secIdx, meta.rowIdx);
  }
}

customElements.define('layout-vertical', LayoutVertical);
