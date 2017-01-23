import { EMPTY, UNKNOWN_IDX, NOOP } from '../constants';
import { forBeforePaint } from '../Async';
import Recycler from '../Recycler';
import { styleLayoutVertical, styleItemContainerTopVertical } from './styles';
import {
    clamp, getApproxSize, eventTarget, checkThreshold, setInstanceProps,
    getRowOffset, getScrollTop, setScrollTop, getHeightForElement,
    getIntervals, findIntervalIdx, getDiv, findInObject, invariant
} from '../utils';

export default class LayoutVertical extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutVertical;
    this._cacheId = 0;
    this._sumHeights = 0;
    this._sumNodes = 0;
    this._firstRender = false;
    this._focusedNode = null;
    this._intervals = null;
    this._storage = {};
    this._pool = {};
    this._meta = new WeakMap();
    this._scrollDidUpdate = this._scrollDidUpdate.bind(this);
    this._windowDidResize = this._windowDidResize.bind(this);
    this._didFocus = this._didFocus.bind(this);
    // Create recyler context.
    const recycler = new Recycler(this, this._pool, this._storage, this._meta);
    recycler.$initMeta = this._initMeta.bind(this);
    recycler.$shouldRecycle = this._shouldRecycle.bind(this);
    recycler.$isClientFull = this._isClientFull.bind(this);
    recycler.$hasEnoughContent = this._hasEnoughContent.bind(this);
    recycler.$poolIdForIndex = this._poolIdForIndex.bind(this);
    recycler.$layout = this._layout.bind(this);
    recycler.$makeActive = this._makeActive.bind(this);
    recycler.$updateNode = this._updateNode.bind(this);
    recycler.$size = _ => this._size;
    recycler.$createNodeContainer = getDiv;
    this._recycler = recycler;
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
    this.addEventListener('focus', this._didFocus, true);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._windowDidResize);
    this.removeEventListener('focus', this._didFocus);
  }

  get props() {
    return this._props;
  }

  set props(v) {
    let oldProps = this._props,
        newProps = Object.assign({}, oldProps, v);

    if (!oldProps || oldProps.scrollingElement !== newProps.scrollingElement) {
      if (oldProps) {
        eventTarget(oldProps.scrollingElement)
          .removeEventListener('scroll', this._scrollDidUpdate);
      }
      eventTarget(newProps.scrollingElement)
          .addEventListener('scroll', this._scrollDidUpdate);
    }
    this._props = newProps;
    this._refresh(true);
  }

  get _size() {
    const intervals = this._intervals;
    return intervals && intervals.length > 0 ? intervals[intervals.length-1][1] + 1 : 0;
  }

  get _contentHeight() {
    // Try to use the meta of the last node.
    const size = this._size;
    const lastMeta = this._storage[size-1];
    return lastMeta && this._cacheId == lastMeta._cacheId ? lastMeta.y + lastMeta.h :
        getApproxSize(this._sumHeights, this._sumNodes, size);
  }

  get _medianHeight() {
    return ~~(this._sumHeights/this._sumNodes);
  }

  async _recycle(top, clientHeight, nodes) {
    if (!this._firstRender) {
      return;
    }
    let recycler = this._recycler;

    this._top = top;
    this._clientHeight = clientHeight;
    await recycler.recycle(nodes);
    this.style.height = this._size == 0 ? '' : `${this._contentHeight}px`;

    // Adjust first node's offset and scroll bar if needed.
    let startMeta = recycler.startMeta,
        startIdx = startMeta.idx,
        oldStartY = startMeta.y;
    if (startMeta == EMPTY) {
      return;
    }
    if ((startIdx > 0 && oldStartY < 0) || (startIdx == 0 && oldStartY != 0)) {
      startMeta.y = this._medianHeight * startIdx;
      setScrollTop(this.props.scrollingElement, startMeta.y + this._top - oldStartY);
      await recycler.recycle(recycler.nodes);
    }
    let sec = this._intervals[startMeta._secIdx],
        secStartIdx = this.props.bottom ? this._size - sec[1] - 1 : sec[0],
        topHeaderId = recycler.keep(secStartIdx);

    if (topHeaderId != this._topHeaderId) {
      recycler.release(this._topHeaderId);
      this._topHeaderId = topHeaderId;
    }
  }

  async _refresh(scroll) {
    let cacheId = this._cacheId;

    await forBeforePaint();

    if (cacheId !== this._cacheId) {
      return;
    }
    // Invalidate the cache for height.
    this._cacheId++;
    this._sumNodes = 0;
    this._sumHeights = 0;

    let props = this.props,
        top = getScrollTop(props.scrollingElement),
        clientHeight = props.scrollingElement.clientHeight,
        recycler = this._recycler;
    // Update intervals.
    this._intervals = getIntervals(props.numberOfSections, props.numberOfRowsInSection);
    if (!this._firstRender && this._size == 0) {
      return;
    }
    else if (!this._firstRender && this._size > 0) {
      this._firstRender = true;
      await this._recycle(top, clientHeight, Array.from(this.children));
    } 
    else {
      await this._recycle(top, clientHeight, recycler.nodes);
    }
    if (scroll) {
      this._scrollTo(props.sectionIndex, props.rowIndex);
    }
  }

  _isClientFull(startMeta, endMeta, from) {
    return checkThreshold(startMeta.y, endMeta.y+endMeta.h,
        this._top, this._clientHeight, from, 0);
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
        bottom = this.props.bottom,
        tidx = bottom ? this._size - meta.idx - 1 : meta.idx,
        secIdx = findIntervalIdx(tidx, intervals),
        rowIdx = bottom ? tidx - intervals[secIdx][0] : tidx - intervals[secIdx][0] - 1,
        isHeader = (tidx == intervals[secIdx][bottom ? 1 : 0]),
        id = isHeader ? this.props.idForHeader(secIdx) : this.props.idForRow(secIdx, rowIdx);

    invariant(id != null, 'Invalid id. Provide a valid id using idForHeader or idForRow.');

    return {
      idx: meta.idx,
      h: meta.h || 0,
      y: meta.y || 0,
      id: id,
      _cacheId: meta._cacheId || -1,
      _isHeader: isHeader,
      _secIdx: secIdx,
      _rowIdx: rowIdx
    };
  }

  _scrollTo(secIdx, rowIdx = UNKNOWN_IDX) {
    let interval = this._intervals[secIdx];
    if (!interval || rowIdx >= interval[1] - interval[0]) {
      return;
    }
    let idx = interval[0] + 1 + rowIdx,
        se = this.props.scrollingElement,
        storage = this._storage[idx];
    setScrollTop(se, storage && storage.y > 0 ? storage.y : idx * this._medianHeight);
  }

  _initMeta(prevState) {
    if (prevState.idx != UNKNOWN_IDX) {
      return this._copyMeta(prevState);
    }
    let meta = findInObject(this._storage, 'y', this._top);
    if (meta && meta.idx < this._size && !this._shouldRecycle(null, meta)) {
      return this._copyMeta(meta);
    }
    let idx = clamp(~~(this._top/this._medianHeight), 0, this._size-1);
    return this._copyMeta({ idx: idx, h: 0, y: idx * this._medianHeight});
  }

  _layout(node, meta) {
    let nodeStyle = node.style;
    nodeStyle.position = 'absolute';
    nodeStyle.top = `${meta.y}px`;
    nodeStyle.left = '0px';
    nodeStyle.right = '0px';

    if (meta._isHeader) {
      let intervals = this._intervals,
          recycler = this._recycler,
          nextInterval = intervals[meta._secIdx+1],
          headerContainerStyle = node.firstElementChild.style;

      if (nextInterval && recycler.has(nextInterval[0])) {
        let nextHeaderMeta = this._storage[nextInterval[0]];
        nodeStyle.height = `${nextHeaderMeta.y-meta.y}px`;
        nodeStyle.bottom = 'auto';
      } else {
        nodeStyle.height = '';
        nodeStyle.bottom = '0px';
      }
      headerContainerStyle.position = '-webkit-sticky';
      headerContainerStyle.position = 'sticky';
      headerContainerStyle.top = '0px';
    }
  }

  _makeActive(node, meta, nodes, metas, idx, from) {
    // Use the cached height if the cache id is valid.
    if (meta._cacheId != this._cacheId) {
      meta.h = meta._isHeader ? this.props.heightForHeader(node.firstElementChild, meta._secIdx) :
          this.props.heightForRow(node, meta._secIdx, meta._rowIdx);
    }
    meta.y = getRowOffset(meta, idx, from, nodes, metas);
    meta._cacheId = this._cacheId;
    // Keep track of the widths to estimate the mean.
    this._sumHeights = this._sumHeights + meta.h;
    this._sumNodes = this._sumNodes + 1;
  }

  _poolIdForIndex(idx, meta) {
    return meta._isHeader ? this.props.poolIdForHeader(meta._secIdx) :
        this.props.poolIdForRow(meta._secIdx, meta._rowIdx);
  }

  _updateNode(node, idx, meta) {
    if (meta._isHeader) {
      if (!node.firstElementChild) {
        node.appendChild(getDiv());
      }
      return this.props.domForHeader(node.firstElementChild, meta._secIdx);
    }
    return this.props.domForRow(node, meta._secIdx, meta._rowIdx);
  }

  _scrollDidUpdate() {
    let se = this.props.scrollingElement;
    this._recycle(getScrollTop(se), se.clientHeight);
  }

  _windowDidResize() {
    this._refresh();
  }

  _didFocus(e) {
    let current = e.target;
    while (current && current != this && !this._meta.has(current)) {
      current = current.parentNode;
    }
    let meta = this._meta.get(current);
    if (!meta) {
      return;
    }
    this._focusedNodeId && this._recycler.release(this._focusedNodeId);
    this._focusedNodeId = this._recycler.keep(meta.idx);
  }
}
