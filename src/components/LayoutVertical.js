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
    this.__top = 0;
    this.__cacheId = 0;
    this.__sumHeights = 0;
    this.__sumNodes = 0;
    this.__topHeaderId = UNKNOWN_IDX;
    this.__focusedNode = null;
    this.__intervals = null;
    this.__storage = {};
    this.__pool = {};
    this.__delta = 0;
    this.__didRender = false;
    this.__meta = new WeakMap();
    this.__scrollDidUpdate = this.__scrollDidUpdate.bind(this);
    this.__windowDidResize = this.__windowDidResize.bind(this);
    this.__didFocus = this.__didFocus.bind(this);
    // Create recyler context.
    let recycler = new Recycler(this, this.__pool, this.__storage, this.__meta);
    recycler._initMeta = this.__initMeta.bind(this);
    recycler._shouldRecycle = this.__shouldRecycle.bind(this);
    recycler._isClientIncomplete = this.__isClientIncomplete.bind(this);
    recycler._isBufferIncomplete = this.__isBufferIncomplete.bind(this);
    recycler._poolForIndex = this.__poolForIndex.bind(this);
    recycler._layout = this.__layout.bind(this);
    recycler._makeActive = this.__makeActive.bind(this);
    recycler._updateNode = this.__updateNode.bind(this);
    recycler._size = _ => this.__size;
    recycler._createNodeContainer = getDiv;
    this._recycler = recycler;
    setInstanceProps(this);
  }

  connectedCallback() {
    window.addEventListener('resize', this.__windowDidResize);
    this.addEventListener('focus', this.__didFocus, true);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.__windowDidResize);
    this.removeEventListener('focus', this.__didFocus);
  }

  get props() {
    return Object.assign({}, this.__props);
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
    let oldProps = this.__props;
    this.__props = newProps;
    // Create the interval tree that will allow to map sections to a flat array.
    this.__intervals = getIntervals(
      newProps.numberOfSections,
      newProps.numberOfRowsInSection,
    );
    this.__scrollTo(newProps.sectionIndex, newProps.rowIndex);
    this.__refresh();
    // Install the scroll event listener.
    if (!oldProps || oldProps.scrollingElement !== newProps.scrollingElement) {
      if (oldProps) {
        eventTarget(oldProps.scrollingElement).removeEventListener(
          'scroll',
          this.__scrollDidUpdate,
        );
      }
      eventTarget(newProps.scrollingElement).addEventListener(
        'scroll',
        this.__scrollDidUpdate,
      );
    }
  }

  get __size() {
    const intervals = this.__intervals;
    return intervals && intervals.length > 0
      ? intervals[intervals.length - 1][1] + 1
      : 0;
  }

  get __medianHeight() {
    return ~~(this.__sumHeights / this.__sumNodes) || 100;
  }

  get __contentHeight() {
    if (this.__size === 0) {
      return 0;
    }
    let lastMeta = this.__storage[this.__size - 1],
      endMeta = this._recycler._endMeta;

    return lastMeta && this.__cacheId == lastMeta.__cacheId
      ? lastMeta._offsetTop + lastMeta._height
      : this.__medianHeight * this.__size;
  }

  __scrollTo(secIdx, rowIdx = UNKNOWN_IDX) {
    if (secIdx == null || rowIdx == null) {
      return;
    }
    if (secIdx < 0) {
      secIdx = 0;
    }
    let props = this.props,
      maxSecIdx = props.numberOfSections - 1,
      interval = this.__intervals[secIdx],
      idx = interval[0] + rowIdx + 1;
    if (secIdx > maxSecIdx) {
      if (rowIdx >= interval[1] - interval[0]) {
        return this.__scrollTo(
          maxSecIdx,
          props.numberOfRowsInSection(maxSecIdx),
        );
      } else {
        return this.__scrollTo(maxSecIdx, rowIdx);
      }
    }
    // Pick a large height, so that the scroll position can be changed.
    this.style.height = `${this.__contentHeight * 2}px`;
    this.__top = idx * this.__medianHeight;
    setScrollTop(props.scrollingElement, this.__top);
  }

  _adjust() {
    // Adjust first node's offset and scroll bar if needed.
    let recycler = this._recycler, startMeta = recycler._startMeta;
    Promise.resolve()
      .then(_ => {
        let startIdx = startMeta.idx, oldStartY = startMeta._offsetTop;
        if (startIdx > 0 && oldStartY < 0 || startIdx == 0 && oldStartY != 0) {
          startMeta._offsetTop = this.__medianHeight * startIdx;
          setScrollTop(
            this.props.scrollingElement,
            startMeta._offsetTop + this.__top - oldStartY,
          );
          return recycler._refresh(recycler.nodes);
        }
      })
      .then(_ => {
        let sec = this.__intervals[recycler._startMeta._secIdx];
        if (sec) {
          let secStartIdx = sec[0], topHeaderId = recycler._keep(secStartIdx);
          if (topHeaderId != this.__topHeaderId) {
            recycler._release(this.__topHeaderId);
            this.__topHeaderId = topHeaderId;
          }
        }
        this.style.height = `${this.__contentHeight}px`;
      });
  }

  __refresh() {
    let cacheId = this.__cacheId, recycler = this._recycler;
    return forBeforePaint()
      .then(_ => {
        if (cacheId !== this.__cacheId || !this.__didRender && this.__size == 0) {
          return;
        }
        // Invalidate the cache for height.
        this.__cacheId++;
        this.__sumNodes = 0;
        this.__sumHeights = 0;
        this.__top = getScrollTop(this.__props.scrollingElement);
        this._clientHeight = this.__props.scrollingElement.clientHeight;

        return recycler._refresh(
          this.__didRender ? recycler._nodes : Array.from(this.children),
        );
      })
      .then(_ => this._adjust())
      .then(_ => recycler._recycle(true))
      .then(_ => {
        this.__didRender = true;
      });
  }

  __isClientIncomplete(startMeta, endMeta, dir) {
    return checkThreshold(
      startMeta._offsetTop,
      endMeta._offsetTop + endMeta._height,
      this.__top,
      this._clientHeight,
      dir,
      this._from === dir ? this.__delta : 0,
    );
  }

  __isBufferIncomplete(startMeta, endMeta, dir) {
    return checkThreshold(
      startMeta._offsetTop,
      endMeta._offsetTop + endMeta._height,
      this.__top,
      this._clientHeight,
      dir,
      500,
    );
  }

  __shouldRecycle(meta) {
    return meta._offsetTop + meta._height < this.__top ||
      meta._offsetTop > this.__top + this._clientHeight;
  }

  __copyMeta(meta) {
    let intervals = this.__intervals,
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
      __cacheId: meta.__cacheId || -1,
      _isHeader: isHeader,
      _secIdx: secIdx,
      _rowIdx: rowIdx,
    };
  }

  __initMeta(prevState) {
    if (prevState.idx != UNKNOWN_IDX) {
      return this.__copyMeta(prevState);
    }
    let meta = findInObject(this.__storage, this.__top);
    if (meta && meta.idx < this.__size && !this._shouldRecycle(meta)) {
      return this.__copyMeta(meta);
    }
    let idx = clamp(~~(this.__top / this.__medianHeight), 0, this.__size - 1);
    return this.__copyMeta({
      idx: idx,
      _height: 0,
      _offsetTop: idx * this.__medianHeight,
    });
  }

  __layout(node, meta) {
    let nodeStyle = node.style;
    nodeStyle.position = 'absolute';
    nodeStyle.top = `${meta._offsetTop}px`;
    nodeStyle.left = '0';
    nodeStyle.right = '0';

    if (meta._isHeader) {
      let intervals = this.__intervals,
        nextInterval = intervals[meta._secIdx + 1],
        headerContainerStyle = node.__header.style,
        nextHeaderMeta = nextInterval ? this.__storage[nextInterval[0]] : null;
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

  __makeActive(node, meta, nodes, metas, idx, dir) {
    meta._height = meta._isHeader
      ? this.props.heightForHeader(node.firstElementChild, meta._secIdx)
      : this.props.heightForRow(node, meta._secIdx, meta._rowIdx);
    meta._offsetTop = getRowOffset(meta, idx, dir, nodes, metas);
    meta.__cacheId = this.__cacheId;
    // Keep track of the widths to estimate the mean.
    this.__sumHeights = this.__sumHeights + meta._height;
    this.__sumNodes = this.__sumNodes + 1;
  }

  __poolForIndex(idx, meta) {
    return meta._isHeader
      ? this.props.poolForHeader(meta._secIdx)
      : this.props.poolForRow(meta._secIdx, meta._rowIdx);
  }

  __updateNode(node, idx, meta) {
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

  __scrollDidUpdate() {
    if (this.__didRender) {
      let se = this.props.scrollingElement,
        top = getScrollTop(se),
        oldTop = this.__top,
        delta = Math.abs(oldTop - top),
        clientHeight = se.clientHeight;
      this.__top = top;
      this._clientHeight = clientHeight;
      this.__delta = delta > clientHeight ? 0 : delta * 3;

      this._from = top > oldTop ? RENDER_END : RENDER_START;
      this._recycler
        ._recycle(false, delta > clientHeight)
        .then(_ => this._adjust());
    }
  }

  __windowDidResize() {
    this.__refresh();
  }

  __didFocus(e) {
    let current = e.target;
    while (current && current != this && !this.__meta._has(current)) {
      current = current.parentNode;
    }
    let meta = this.__meta.get(current);
    if (!meta) {
      return;
    }
    this._focusedNodeId && this._recycler._release(this._focusedNodeId);
    this._focusedNodeId = this._recycler._keep(meta.idx);
  }
}
