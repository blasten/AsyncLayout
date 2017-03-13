import {
  EMPTY,
  UNKNOWN_IDX,
  RENDER_START,
  RENDER_END,
  NOOP,
  GLOBAL,
  PROP_SCROLLING_ELEMENT,
  PROP_NUMBER_OF_ROWS_IN_SECTION,
  PROP_NUMBER_OF_SECTIONS,
  PROP_SECTION_INDEX,
  PROP_ROW_INDEX,
  PROP_POOL_FOR_HEADER,
  PROP_POOL_FOR_ROW,
  PROP_HEIGHT_FOR_HEADER,
  PROP_HEIGHT_FOR_ROW,
  PROP_DOM_FOR_HEADER,
  PROP_DOM_FOR_ROW,
  PROP_KEY_FOR_HEADER,
  PROP_KEY_FOR_ROW,
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
import Recycler from '../Recycler';
import { forBeforePaint } from '../Async';
import { styleLayoutVertical, styleItemContainerTopVertical } from './styles';

export default class LayoutVertical extends HTMLElement {
  constructor() {
    super();
    setInstanceProps(this);
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
    let self = this;
    this._recycler = new Recycler(
      this,
      this.__pool,
      this.__storage,
      this.__meta,
      {
        _initMeta(prevState) {
          if (prevState.idx != UNKNOWN_IDX) {
            return self.__copyMeta(prevState);
          }
          let meta = findInObject(self.__storage, self.__top);
          if (meta && meta.idx < self.__size && !this._shouldRecycle(meta)) {
            return self.__copyMeta(meta);
          }
          let idx = clamp(
            ~~(self.__top / self.__medianHeight),
            0,
            self.__size - 1,
          );
          return self.__copyMeta({
            idx: idx,
            _height: 0,
            _offsetTop: idx * self.__medianHeight,
          });
        },
        _shouldRecycle(meta) {
          return meta._offsetTop + meta._height < self.__top ||
            meta._offsetTop > self.__top + self.__clientHeight;
        },
        _isClientIncomplete(startMeta, endMeta, dir) {
          return checkThreshold(
            startMeta._offsetTop,
            endMeta._offsetTop + endMeta._height,
            self.__top,
            self.__clientHeight,
            dir,
            self._from === dir ? self.__delta : 0,
          );
        },
        _isBufferIncomplete(startMeta, endMeta, dir) {
          return checkThreshold(
            startMeta._offsetTop,
            endMeta._offsetTop + endMeta._height,
            self.__top,
            self.__clientHeight,
            dir,
            500,
          );
        },
        _poolForIndex(idx, meta) {
          return meta._isHeader
            ? self.props[PROP_POOL_FOR_HEADER](meta._secIdx)
            : self.props[PROP_POOL_FOR_ROW](meta._secIdx, meta._rowIdx);
        },
        _layout(node, meta) {
          let nodeStyle = node.style;
          nodeStyle.position = 'absolute';
          nodeStyle.top = `${meta._offsetTop}px`;
          nodeStyle.left = '0';
          nodeStyle.right = '0';

          if (meta._isHeader) {
            let intervals = self.__intervals,
              nextInterval = intervals[meta._secIdx + 1],
              headerContainerStyle = node.__header.style,
              nextHeaderMeta = nextInterval
                ? self.__storage[nextInterval[0]]
                : null;
            if (nextHeaderMeta && nextHeaderMeta._offsetTop > meta._offsetTop) {
              nodeStyle.height = `${nextHeaderMeta._offsetTop -
                meta._offsetTop}px`;
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
        },
        _makeActive(node, meta, nodes, metas, idx, dir) {
          meta._height = meta._isHeader
            ? self.props[PROP_HEIGHT_FOR_HEADER](
                node.firstElementChild,
                meta._secIdx,
              )
            : self.props[PROP_HEIGHT_FOR_ROW](node, meta._secIdx, meta._rowIdx);
          meta._offsetTop = getRowOffset(meta, idx, dir, nodes, metas);
          meta.__cacheId = self.__cacheId;
          // Keep track of the widths to estimate the mean.
          self.__sumHeights = self.__sumHeights + meta._height;
          self.__sumNodes = self.__sumNodes + 1;
        },
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
            self.props[PROP_DOM_FOR_HEADER](header, meta._secIdx);
          } else {
            self.props[PROP_DOM_FOR_ROW](node, meta._secIdx, meta._rowIdx);
          }
          return node;
        },

        _size() {
          return self.__size;
        },

        _createNodeContainer() {
          return getDiv();
        },
      },
    );
  }

  connectedCallback() {
    GLOBAL.addEventListener('resize', this.__windowDidResize);
    this.addEventListener('focus', this.__didFocus, true);
  }

  disconnectedCallback() {
    GLOBAL.removeEventListener('resize', this.__windowDidResize);
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
      newProps[PROP_SCROLLING_ELEMENT] instanceof HTMLElement,
      '`props.scrollingElement` should be an element',
    );
    invariant(
      newProps[PROP_POOL_FOR_HEADER] instanceof Function,
      '`props.poolForHeader` should be a function that returns an id',
    );
    invariant(
      newProps[PROP_POOL_FOR_ROW] instanceof Function,
      '`props.poolForRow` should be a function that returns an id',
    );
    invariant(
      newProps[PROP_HEIGHT_FOR_HEADER] instanceof Function,
      '`props.heightForHeader` should be a function that returns the height of the header',
    );
    invariant(
      newProps[PROP_HEIGHT_FOR_ROW] instanceof Function,
      '`props.heightForRow` should be a function that returns the height of the row',
    );
    let oldProps = this.__props;
    this.__props = newProps;
    // Create the interval tree that will allow to map sections to a flat array.
    this.__intervals = getIntervals(
      newProps[PROP_NUMBER_OF_SECTIONS],
      newProps[PROP_NUMBER_OF_ROWS_IN_SECTION],
    );
    this.__scrollTo(newProps.sectionIndex, newProps.rowIndex);
    this.__refresh();
    // Install the scroll event listener.
    let oldScrollingElement = oldProps
      ? oldProps[PROP_SCROLLING_ELEMENT]
      : null,
      newScrollingElement = newProps[PROP_SCROLLING_ELEMENT];
    if (oldScrollingElement !== newScrollingElement) {
      if (oldProps) {
        eventTarget(oldScrollingElement).removeEventListener(
          'scroll',
          this.__scrollDidUpdate,
        );
      }
      eventTarget(newScrollingElement).addEventListener(
        'scroll',
        this.__scrollDidUpdate,
      );
    }
  }

  get __size() {
    let intervals = this.__intervals;
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
      maxSecIdx = props[PROP_NUMBER_OF_SECTIONS] - 1,
      interval = this.__intervals[secIdx],
      idx = interval[0] + rowIdx + 1;
    if (secIdx > maxSecIdx) {
      if (rowIdx >= interval[1] - interval[0]) {
        return this.__scrollTo(
          maxSecIdx,
          props[PROP_NUMBER_OF_ROWS_IN_SECTION](maxSecIdx),
        );
      } else {
        return this.__scrollTo(maxSecIdx, rowIdx);
      }
    }
    // Pick a large height, so that the scroll position can be changed.
    this.style.height = `${this.__contentHeight * 2}px`;
    this.__top = idx * this.__medianHeight;
    setScrollTop(props[PROP_SCROLLING_ELEMENT], this.__top);
  }

  __refresh() {
    let cacheId = this.__cacheId, recycler = this._recycler;
    return forBeforePaint()
      .then(_ => {
        if (
          cacheId !== this.__cacheId || !this.__didRender && this.__size == 0
        ) {
          return;
        }
        // Invalidate the cache for height.
        let scrollingElement = this.__props[PROP_SCROLLING_ELEMENT];
        this.__cacheId++;
        this.__sumNodes = 0;
        this.__sumHeights = 0;
        this.__top = getScrollTop(scrollingElement);
        this.__clientHeight = scrollingElement.clientHeight;
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

  _adjust() {
    // Adjust first node's offset and scroll bar if needed.
    let recycler = this._recycler, startMeta = recycler._startMeta;
    Promise.resolve()
      .then(_ => {
        let startIdx = startMeta.idx, oldStartY = startMeta._offsetTop;
        if (startIdx > 0 && oldStartY < 0 || startIdx == 0 && oldStartY != 0) {
          startMeta._offsetTop = this.__medianHeight * startIdx;
          setScrollTop(
            this.props[PROP_SCROLLING_ELEMENT],
            startMeta._offsetTop + this.__top - oldStartY,
          );
          return recycler._refresh(recycler._nodes);
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

  __copyMeta(meta) {
    let intervals = this.__intervals,
      secIdx = findIntervalIdx(meta.idx, intervals),
      rowIdx = meta.idx - intervals[secIdx][0] - 1,
      isHeader = meta.idx == intervals[secIdx][0],
      key = isHeader
        ? this.props[PROP_KEY_FOR_HEADER](secIdx)
        : this.props[PROP_KEY_FOR_ROW](secIdx, rowIdx);

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

  __scrollDidUpdate() {
    if (this.__didRender) {
      let scrollingElement = this.props[PROP_SCROLLING_ELEMENT],
        top = getScrollTop(scrollingElement),
        oldTop = this.__top,
        clientHeight = scrollingElement.clientHeight,
        delta = Math.abs(oldTop - top);

      this.__top = top;
      this.__clientHeight = clientHeight;
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
