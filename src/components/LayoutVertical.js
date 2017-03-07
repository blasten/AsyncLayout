import { Recycler } from '../Recycler';
import { EMPTY, UNKNOWN_IDX, NOOP } from '../constants';
import { forBeforePaint } from '../Async';
import { styleLayoutVertical, styleItemContainerTopVertical } from './styles';
import {
  clamp,
  getApproxSize,
  eventTarget,
  checkThreshold,
  setInstanceProps,
  getRowOffset,
  getScrollTop,
  setScrollTop,
  getHeightForElement,
  getIntervals,
  findIntervalIdx,
  getDiv,
  findInObject,
  invariant
} from '../utils';

export default class LayoutVertical extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutVertical;
    this._top = 0;
    this._cacheId = 0;
    this._sumHeights = 0;
    this._sumNodes = 0;
    this._focusedNode = null;
    this._intervals = null;
    this._storage = {};
    this._pool = {};
    this._didRender = false;
    this._meta = new WeakMap();
    this._scrollDidUpdate = this._scrollDidUpdate.bind(this);
    this._windowDidResize = this._windowDidResize.bind(this);
    this._didFocus = this._didFocus.bind(this);
    // Create recyler context.
    const recycler = new Recycler(this, this._pool, this._storage, this._meta);
    recycler.$initMeta = this._initMeta.bind(this);
    recycler.$shouldRecycle = this._shouldRecycle.bind(this);
    recycler.$isClientIncomplete = this._isClientIncomplete.bind(this);
    recycler.$isBufferIncomplete = this._isBufferIncomplete.bind(this);
    recycler.$poolIdForIndex = this._poolIdForIndex.bind(this);
    recycler.$layout = this._layout.bind(this);
    recycler.$makeActive = this._makeActive.bind(this);
    recycler.$updateNode = this._updateNode.bind(this);
    recycler.$size = _ => this._size;
    recycler.$createNodeContainer = getDiv;
    this._recycler = recycler;
    setInstanceProps(this);
  }

  connectedCallback() {
    window.addEventListener('resize', this._windowDidResize);
    this.addEventListener('focus', this._didFocus, true);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._windowDidResize);
    this.removeEventListener('focus', this._didFocus);
  }

  get props() {
    return Object.assign({}, this._props);
  }

  set props(newProps) {
    invariant(
      newProps instanceof Object && !Array.isArray(newProps),
      '`props` should be an object'
    );
    invariant(
      newProps.scrollingElement instanceof HTMLElement,
      '`props.scrollingElement` should be an element'
    );
    invariant(
      newProps.poolIdForHeader instanceof Function,
      '`props.poolIdForHeader` should be a function that returns an id'
    );
    invariant(
      newProps.poolIdForRow instanceof Function,
      '`props.poolIdForRow` should be a function that returns an id'
    );
    invariant(
      newProps.heightForHeader instanceof Function,
      '`props.heightForHeader` should be a function that returns the height of the header'
    );
    invariant(
      newProps.heightForRow instanceof Function,
      '`props.heightForRow` should be a function that returns the height of the row'
    );
    let oldProps = this._props;
    this._props = newProps;
    // Create the interval tree that will allow to map sections to a flat array.
    this._intervals = getIntervals(
      newProps.numberOfSections,
      newProps.numberOfRowsInSection
    );
    this._scrollTo(newProps.sectionIndex, newProps.rowIndex);
    this._refresh();
    // Install the scroll event listener.
    if (!oldProps || oldProps.scrollingElement !== newProps.scrollingElement) {
      if (oldProps) {
        eventTarget(oldProps.scrollingElement).removeEventListener(
          'scroll',
          this._scrollDidUpdate
        );
      }
      eventTarget(newProps.scrollingElement).addEventListener(
        'scroll',
        this._scrollDidUpdate
      );
    }
  }

  get _size() {
    const intervals = this._intervals;
    return intervals && intervals.length > 0
      ? intervals[intervals.length - 1][1] + 1
      : 0;
  }

  get _medianHeight() {
    return ~~(this._sumHeights / this._sumNodes) || 100;
  }

  get _contentHeight() {
    if (this._size === 0) {
      return 0;
    }
    let lastMeta = this._storage[this._size - 1];
    return lastMeta && this._cacheId == lastMeta._cacheId
      ? lastMeta.y + lastMeta.h
      : getApproxSize(
          this._sumHeights,
          this._sumNodes,
          this._medianHeight,
          this._size
        );
  }

  _scrollTo(secIdx, rowIdx = UNKNOWN_IDX) {
    let props = this.props,
      interval = this._intervals[secIdx];
    if (!interval || rowIdx >= interval[1] - interval[0]) {
      this.style.height = `${this._contentHeight}px`;
      this._top = 0;
      setScrollTop(props.scrollingElement, this._top);
      return;
    }
    let idx = interval[0] + rowIdx + 1;
    // Pick a large height, so that the scroll position can be changed.
    this.style.height = `${this._contentHeight * 2}px`;
    this._top = idx * this._medianHeight;
    setScrollTop(props.scrollingElement, this._top);
  }

  _adjust() {
    // Adjust first node's offset and scroll bar if needed.
    let recycler = this._recycler,
        startMeta = recycler.startMeta;
    Promise.resolve()
      .then(_ => {
        let startIdx = startMeta.idx,
            oldStartY = startMeta.y;
        if (startIdx > 0 && oldStartY < 0 || startIdx == 0 && oldStartY != 0) {
          startMeta.y = this._medianHeight * startIdx;
          setScrollTop(
            this.props.scrollingElement,
            startMeta.y + this._top - oldStartY
          );
          return recycler.refresh(recycler.nodes);
        }
      })
      .then(_ => {
        let sec = this._intervals[recycler.startMeta._secIdx];
        if (sec) {
          let secStartIdx = sec[0],
            topHeaderId = recycler.keep(secStartIdx);
          if (topHeaderId != this._topHeaderId) {
            recycler.release(this._topHeaderId);
            this._topHeaderId = topHeaderId;
          }
        }
        this.style.height = `${this._contentHeight}px`;
      });
  }

  _refresh() {
    let cacheId = this._cacheId,
        recycler = this._recycler;
    return forBeforePaint()
      .then(_ => {
        if (cacheId !== this._cacheId || !this._didRender && this._size == 0) {
          return;
        }
        // Invalidate the cache for height.
        this._cacheId++;
        this._sumNodes = 0;
        this._sumHeights = 0;
        this._top = getScrollTop(this._props.scrollingElement);
        this._clientHeight = this._props.scrollingElement.clientHeight;

        return recycler.refresh(
          this._didRender ? recycler.nodes : Array.from(this.children)
        );
      })
      .then(_ => this._adjust())
      .then(_ => recycler.recycle(true))
      .then(_ => {
        this._didRender = true;
      });
  }

  _isClientIncomplete(startMeta, endMeta, from) {
    return checkThreshold(
      startMeta.y,
      endMeta.y + endMeta.h,
      this._top,
      this._clientHeight,
      from,
      0
    );
  }

  _isBufferIncomplete(startMeta, endMeta, from) {
    return checkThreshold(
      startMeta.y,
      endMeta.y + endMeta.h,
      this._top,
      this._clientHeight,
      from,
      1000
    );
  }

  _shouldRecycle(meta) {
    return meta.y + meta.h < this._top - 500 ||
      meta.y > this._top + this._clientHeight + 500;
  }

  _copyMeta(meta) {
    let intervals = this._intervals,
      secIdx = findIntervalIdx(meta.idx, intervals),
      rowIdx = meta.idx - intervals[secIdx][0] - 1,
      isHeader = meta.idx == intervals[secIdx][0],
      id = isHeader
        ? this.props.idForHeader(secIdx)
        : this.props.idForRow(secIdx, rowIdx);

    invariant(
      id != null,
      'Invalid id. Provide a valid id using idForHeader or idForRow.'
    );
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

  _initMeta(prevState) {
    if (prevState.idx != UNKNOWN_IDX) {
      return this._copyMeta(prevState);
    }
    let meta = findInObject(this._storage, 'y', this._top);
    if (meta && meta.idx < this._size && !this._shouldRecycle(meta)) {
      return this._copyMeta(meta);
    }
    let idx = clamp(~~(this._top / this._medianHeight), 0, this._size - 1);
    return this._copyMeta({ idx: idx, h: 0, y: idx * this._medianHeight });
  }

  _layout(node, meta) {
    let nodeStyle = node.style;
    nodeStyle.position = 'absolute';
    nodeStyle.top = `${meta.y}px`;
    nodeStyle.left = '0';
    nodeStyle.right = '0';

    if (meta._isHeader) {
      let intervals = this._intervals,
        nextInterval = intervals[meta._secIdx + 1],
        headerContainerStyle = node.__header.style,
        nextHeaderMeta = nextInterval
          ? this._storage[nextInterval[0]]
          : null;
      if (nextHeaderMeta && nextHeaderMeta.y > meta.y) {
        nodeStyle.height = `${nextHeaderMeta.y - meta.y}px`;
        nodeStyle.bottom = 'auto';
      } else {
        nodeStyle.height = '';
        nodeStyle.bottom = '0';
      }
      headerContainerStyle.position = '-webkit-sticky';
      headerContainerStyle.position = 'sticky';
      headerContainerStyle.top = '0px';
    } else {
      nodeStyle.contain = 'content';
    }
  }

  _makeActive(node, meta, nodes, metas, idx, from) {
    meta.h = meta._isHeader
      ? this.props.heightForHeader(node.firstElementChild, meta._secIdx)
      : this.props.heightForRow(node, meta._secIdx, meta._rowIdx);
    meta.y = getRowOffset(meta, idx, from, nodes, metas);
    meta._cacheId = this._cacheId;
    // Keep track of the widths to estimate the mean.
    this._sumHeights = this._sumHeights + meta.h;
    this._sumNodes = this._sumNodes + 1;
  }

  _poolIdForIndex(idx, meta) {
    return meta._isHeader
      ? this.props.poolIdForHeader(meta._secIdx)
      : this.props.poolIdForRow(meta._secIdx, meta._rowIdx);
  }

  _updateNode(node, idx, meta) {
    if (meta._isHeader) {
      let header = node.__header;
      if (!header) {
        header = node;
        node = getDiv();
        node.__header = header;
        node.appendChild(header);
      }
      node.style.pointerEvents = 'none';
      header.style.zIndex = '1';
      header.style.pointerEvents = 'auto';
      this.props.domForHeader(header, meta._secIdx);
    } else {
      this.props.domForRow(node, meta._secIdx, meta._rowIdx);
    }
    return node;
  }

  _scrollDidUpdate() {
    if (this._didRender) {
      let se = this.props.scrollingElement;
      this._top = getScrollTop(se);
      this._clientHeight = se.clientHeight;
      this._recycler
        .recycle(false)
        .then(_ => this._adjust());
    }
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