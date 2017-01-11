import {
    clamp, getApproxSize, eventTarget, checkThreshold, setInstanceProps,
    getRowOffset, getScrollTop, setScrollTop, getHeightForElement,
    getIntervals, findIntervalIdx, NOOP, EMPTY, invariant
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
    this._render(newProps);
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

  async _render(props) {
    await forBeforePaint();
    if (props === this._props) {
      this.refresh();
    }
  }

  async _refresh(top, clientHeight) {
    if (this.props.bottom) {
      let se = this.props.scrollingElement;
      top = (se.scrollHeight + se.clientHeight) - top;
    }
    this._top = top;
    this._clientHeight = clientHeight;
    await this._recycler.recycle();
    this.style.height = this._size == 0 ? '' : `${this._contentHeight}px`;
    // Adjust first node's offset and scroll bar if needed.
    let recycler = this._recycler,
        startMeta = recycler.startMeta,
        startIdx = startMeta.idx,
        oldStartY = startMeta.y;

    if (this._recycler.startMeta == EMPTY) {
      return;
    }
    if ((startIdx > 0 && oldStartY < 0) || (startIdx == 0 && oldStartY != 0)) {
      startMeta.y = this._medianHeight * startIdx;
      setScrollTop(this.props.scrollingElement, startMeta.y + this._top - oldStartY);
      recycler.enqueueRendered();
      await recycler.recycle();
    }
    if (this._recycler.startMeta == EMPTY) {
      return;
    }
    let sec = this._intervals[this._recycler.startMeta.secIdx];
    let secStartIdx = this.props.bottom ? this._size - sec[1] - 1 : sec[0],
        m = this._recycler.meta.getByIndex(secStartIdx);
    if (!m || !this._recycler._keptNodes[m.id]) {
      this._recycler.removeKeptNodes();
      this._recycler.keepIdx(secStartIdx, true);
    }
  }

  async refresh() {
    let props = this.props,
        top = getScrollTop(props.scrollingElement),
        clientHeight = props.scrollingElement.clientHeight;
    // Update intervals.
    this._intervals = getIntervals(props.numberOfSections, props.numberOfRowsInSection);
    // Invalidate the cache for height.
    this._cacheId++;
    this._sumNodes = 0;
    this._sumHeights = 0;
    this._recycler.removeKeptNodes();
    if (!this._firstRender && this._size == 0) {
      return;
    }
    else if (!this._firstRender && this._size > 0) {
      this._firstRender = true;
      this._recycler.enqueuePrerendered();
    }
    else {
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
    let intervals = this._intervals,
        tidx = meta.idx,
        secIdx = findIntervalIdx(tidx, intervals),
        rowIdx = tidx - intervals[secIdx][0] - 1,
        isHeader = (tidx == intervals[secIdx][this.props.bottom ? 0 : 0]),
        id = isHeader ? this.props.idForHeader(secIdx) : this.props.idForRow(secIdx, rowIdx);

    invariant(id != null, 'Invalid id. Provide a valid id using idForHeader or idForRow.');

    return {
      idx: meta.idx,
      h: meta.h || 0,
      y: meta.y || 0,
      id: id,
      isHeader: isHeader,
      secIdx: secIdx,
      rowIdx: rowIdx,
      cacheId: meta.cacheId || -1
    };
  }

  _initMetaForIndex(prevState) {
    if (prevState.idx != Recycler.UNKNOWN_IDX) {
      return this._copyMeta(prevState);
    }
    let meta = this._recycler.meta.find('y', this._top);
    if (meta && meta.idx < this._size && !this._shouldRecycle(null, meta)) {
      return this._copyMeta(meta);
    }
    let idx = clamp(~~(this._top/this._medianHeight), 0, this._size-1);
    return this._copyMeta({ idx: idx, h: 0, y: this._top });
  }

  _layout(node, meta) {
    let intervals = this._intervals, recycler = this._recycler;

    node.style.position = 'absolute';
    node.style.left = '0px';
    node.style.right = '0px';

    if (this.props.bottom) {
      node.style.top = 'auto';
      node.style.bottom = `${meta.y}px`;
    } else {
      node.style.top = `${meta.y}px`;
      node.style.bottom = 'auto';
    }

    if (!meta.isHeader) {
      return;
    }
    let nextInterval = intervals[meta.secIdx + 1],
        nextHeaderMeta = nextInterval ? recycler.meta.getByIndex(nextInterval[0]) : null;

    recycler.keep(node, true);

    if (nextHeaderMeta && nextHeaderMeta.y > 0) {
      if (nextHeaderMeta.y > this._top && meta.y < this._top) {
        let headerOffset = Math.min(0, nextHeaderMeta.y - this._top - meta.h);
        node.style.position = 'sticky';
        node.style.top = `${headerOffset}px`;
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
