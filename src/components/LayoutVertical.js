import Recycler from '../Recycler';
import { forBeforePaint } from '../Async';
import { styleLayoutVertical, styleItemContainerTopVertical } from './styles';
import {
  EMPTY,
  UNKNOWN_IDX,
  RENDER_START,
  RENDER_END,
  NOOP,
} from '../constants';
import {
  clamp,
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
  invariant,
} from '../utils';

export default class LayoutVertical extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutVertical;
    this._top = 0;
    this._cacheId = 0;
    this._sumHeights = 0;
    this._sumNodes = 0;
    this._topHeaderId = UNKNOWN_IDX;
    this._focusedNode = null;
    this._intervals = null;
    this._storage = {};
    this._pool = {};
    this._delta = 0;
    this._didRender = false;
    this._meta = new WeakMap();
    this._scrollDidUpdate = this._scrollDidUpdate.bind(this);
    this._windowDidResize = this._windowDidResize.bind(this);
    this._didFocus = this._didFocus.bind(this);
    // Create recyler context.
    let recycler = new Recycler(this, this._pool, this._storage, this._meta);
    recycler.$initMeta = this._initMeta.bind(this);
    recycler.$shouldRecycle = this._shouldRecycle.bind(this);
    recycler.$isClientIncomplete = this._isClientIncomplete.bind(this);
    recycler.$isBufferIncomplete = this._isBufferIncomplete.bind(this);
    recycler.$poolForIndex = this._poolForIndex.bind(this);
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
      '`props` should be an object',
    );
    invariant(
      newProps.scrollingElement instanceof HTMLElement,
      '`props.scrollingElement` should be an element',
    );
    invariant(
      newProps.poolForHeader instanceof Function,
      '`props.poolIdForHeader` should be a function that returns an id',
    );
    invariant(
      newProps.poolForRow instanceof Function,
      '`props.poolIdForRow` should be a function that returns an id',
    );
    invariant(
      newProps.heightForHeader instanceof Function,
      '`props.heightForHeader` should be a function that returns the height of the header',
    );
    invariant(
      newProps.heightForRow instanceof Function,
      '`props.heightForRow` should be a function that returns the height of the row',
    );
    let oldProps = this._props;
    this._props = newProps;
    // Create the interval tree that will allow to map sections to a flat array.
    this._intervals = getIntervals(
      newProps.numberOfSections,
      newProps.numberOfRowsInSection,
    );
    this._scrollTo(newProps.sectionIndex, newProps.rowIndex);
    this._refresh();
    // Install the scroll event listener.
    if (!oldProps || oldProps.scrollingElement !== newProps.scrollingElement) {
      if (oldProps) {
        eventTarget(oldProps.scrollingElement).removeEventListener(
          'scroll',
          this._scrollDidUpdate,
        );
      }
      eventTarget(newProps.scrollingElement).addEventListener(
        'scroll',
        this._scrollDidUpdate,
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
    let lastMeta = this._storage[this._size - 1],
      endMeta = this._recycler.endMeta;

    return lastMeta && this._cacheId == lastMeta._cacheId
      ? lastMeta._offsetTop + lastMeta._height
      : this._medianHeight * this._size;
  }

  _scrollTo(secIdx, rowIdx = UNKNOWN_IDX) {
    if (secIdx == null || rowIdx == null) {
      return;
    }
    if (secIdx < 0) {
      secIdx = 0;
    }
    let props = this.props,
      maxSecIdx = props.numberOfSections - 1,
      interval = this._intervals[secIdx],
      idx = interval[0] + rowIdx + 1;
    if (secIdx > maxSecIdx) {
      if (rowIdx >= interval[1] - interval[0]) {
        return this._scrollTo(
          maxSecIdx,
          props.numberOfRowsInSection(maxSecIdx),
        );
      } else {
        return this._scrollTo(maxSecIdx, rowIdx);
      }
    }
    // Pick a large height, so that the scroll position can be changed.
    this.style.height = `${this._contentHeight * 2}px`;
    this._top = idx * this._medianHeight;
    setScrollTop(props.scrollingElement, this._top);
  }

  _adjust() {
    // Adjust first node's offset and scroll bar if needed.
    let recycler = this._recycler, startMeta = recycler.startMeta;
    Promise.resolve()
      .then(_ => {
        let startIdx = startMeta.idx, oldStartY = startMeta._offsetTop;
        if (startIdx > 0 && oldStartY < 0 || startIdx == 0 && oldStartY != 0) {
          startMeta._offsetTop = this._medianHeight * startIdx;
          setScrollTop(
            this.props.scrollingElement,
            startMeta._offsetTop + this._top - oldStartY,
          );
          return recycler.refresh(recycler.nodes);
        }
      })
      .then(_ => {
        let sec = this._intervals[recycler.startMeta._secIdx];
        if (sec) {
          let secStartIdx = sec[0], topHeaderId = recycler.keep(secStartIdx);
          if (topHeaderId != this._topHeaderId) {
            recycler.release(this._topHeaderId);
            this._topHeaderId = topHeaderId;
          }
        }
        this.style.height = `${this._contentHeight}px`;
      });
  }

  _refresh() {
    let cacheId = this._cacheId, recycler = this._recycler;
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
          this._didRender ? recycler.nodes : Array.from(this.children),
        );
      })
      .then(_ => this._adjust())
      .then(_ => recycler.recycle(true))
      .then(_ => {
        this._didRender = true;
      });
  }

  _isClientIncomplete(startMeta, endMeta, dir) {
    return checkThreshold(
      startMeta._offsetTop,
      endMeta._offsetTop + endMeta._height,
      this._top,
      this._clientHeight,
      dir,
      this._from === dir ? this._delta : 0,
    );
  }

  _isBufferIncomplete(startMeta, endMeta, dir) {
    return checkThreshold(
      startMeta._offsetTop,
      endMeta._offsetTop + endMeta._height,
      this._top,
      this._clientHeight,
      dir,
      500,
    );
  }

  _shouldRecycle(meta) {
    return meta._offsetTop + meta._height < this._top ||
      meta._offsetTop > this._top + this._clientHeight;
  }

  _copyMeta(meta) {
    let intervals = this._intervals,
      secIdx = findIntervalIdx(meta.idx, intervals),
      rowIdx = meta.idx - intervals[secIdx][0] - 1,
      isHeader = meta.idx == intervals[secIdx][0],
      key = isHeader
        ? this.props.keyForHeader(secIdx)
        : this.props.keyForRow(secIdx, rowIdx);

    invariant(
      key != null,
      'Invalid key. Provide a valid key using keyForHeader or keyForRow.',
    );
    return {
      idx: meta.idx,
      key: key,
      _height: meta._height || 0,
      _offsetTop: meta._offsetTop || 0,
      _cacheId: meta._cacheId || -1,
      _isHeader: isHeader,
      _secIdx: secIdx,
      _rowIdx: rowIdx,
    };
  }

  _initMeta(prevState) {
    if (prevState.idx != UNKNOWN_IDX) {
      return this._copyMeta(prevState);
    }
    let meta = findInObject(this._storage, this._top);
    if (meta && meta.idx < this._size && !this._shouldRecycle(meta)) {
      return this._copyMeta(meta);
    }
    let idx = clamp(~~(this._top / this._medianHeight), 0, this._size - 1);
    return this._copyMeta({
      idx: idx,
      _height: 0,
      _offsetTop: idx * this._medianHeight,
    });
  }

  _layout(node, meta) {
    let nodeStyle = node.style;
    nodeStyle.position = 'absolute';
    nodeStyle.top = `${meta._offsetTop}px`;
    nodeStyle.left = '0';
    nodeStyle.right = '0';

    if (meta._isHeader) {
      let intervals = this._intervals,
        nextInterval = intervals[meta._secIdx + 1],
        headerContainerStyle = node.__header.style,
        nextHeaderMeta = nextInterval ? this._storage[nextInterval[0]] : null;
      if (nextHeaderMeta && nextHeaderMeta._offsetTop > meta._offsetTop) {
        nodeStyle.height = `${nextHeaderMeta._offsetTop - meta._offsetTop}px`;
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

  _makeActive(node, meta, nodes, metas, idx, dir) {
    meta._height = meta._isHeader
      ? this.props.heightForHeader(node.firstElementChild, meta._secIdx)
      : this.props.heightForRow(node, meta._secIdx, meta._rowIdx);
    meta._offsetTop = getRowOffset(meta, idx, dir, nodes, metas);
    meta._cacheId = this._cacheId;
    // Keep track of the widths to estimate the mean.
    this._sumHeights = this._sumHeights + meta._height;
    this._sumNodes = this._sumNodes + 1;
  }

  _poolForIndex(idx, meta) {
    return meta._isHeader
      ? this.props.poolForHeader(meta._secIdx)
      : this.props.poolForRow(meta._secIdx, meta._rowIdx);
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
      let se = this.props.scrollingElement,
        top = getScrollTop(se),
        oldTop = this._top,
        delta = Math.abs(oldTop - top),
        clientHeight = se.clientHeight;
      this._top = top;
      this._clientHeight = clientHeight;
      this._delta = delta > clientHeight ? 0 : delta * 3;

      this._from = top > oldTop ? RENDER_END : RENDER_START;
      this._recycler
        .recycle(false, delta > clientHeight)
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
