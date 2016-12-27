import { styleLayoutHorizontal, styleItemContainerHorizontal } from './styles';
import { getApproxSize, eventTarget } from '../utils';
import { forBeforePaint } from '../Async';
import Recycler from '../Recycler';
import DomPool from '../DomPool';

export default class LayoutTable extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutHorizontal;
    this._props = {};
    this._renderedWidth = 0;
    this._renderedHeight = 0;
    this._numberOfRenderedColumns = 0;
    this._numberOfRenderedRows = 0;
    this._scrollDidUpdate = this._scrollDidUpdate.bind(this);
    // Create recyler contexts.
    const pool = new DomPool();
    const meta = new WeakMap();
    const recyclerProps = {
      parentContainer: this,
      initMetaForIndex: this._initMetaForIndex.bind(this),
      shouldRecycle: this._shouldRecycle.bind(this),
      poolIdForIndex: this._poolIdForIndex.bind(this),
      layout: this._layout.bind(this),
      nodeForIndex: this._nodeForIndex.bind(this)
    };
    this._recyclerX = new Recycler(
      pool,
      meta,
      Object.assign({},
        recyclerProps,
        {
          size: this._sizeX.bind(this),
          isClientFull: this._isXClientFull.bind(this),
          hasEnoughContent: this._hasEnoughXContent.bind(this),
          makeActive: this._makeXActive.bind(this)
        }
      )
    );
    this._recyclerY = new Recycler(
      pool,
      meta,
      Object.assign({},
        recyclerProps,
        {
          size: this._sizeY.bind(this),
          isClientFull: this._isYClientFull.bind(this),
          hasEnoughContent: this._hasEnoughYContent.bind(this),
          makeActive: this._makeYActive.bind(this)
        }
      )
    );
    this._setProps([
      'poolIdForCell',
      'domForCell',
      'numberOfColumns',
      'numberOfRows',
      'widthForCell',
      'heightForCell',
      'scrollingElement'
    ]);
  }

  async connectedCallback() {
    this._recyclerX.mount();
    this._recyclerY.mount();
    await forBeforePaint();
    if (!this.scrollingElement) {
      this.scrollingElement = document.scrollingElement;
    }
    this.refresh();
  }

  disconnectedCallback() {
    this._recyclerX.unmount();
    this._recyclerY.unmount();
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

  set numberOfColumns(size) {
    this._props.numberOfColumns = size;
  }

  get numberOfColumns() {
    return this._props.numberOfColumns || 0;
  }

  set numberOfRows(size) {
    this._props.numberOfRows = size;
  }

  get numberOfRows() {
    return this._props.numberOfRows || 0;
  }

  set widthForCell(fn) {
    this._props.widthForCell = fn;
  }

  get widthForCell() {
    return this._props.widthForCell || ((idx, node) => node.getBoundingClientRect().width);
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

  get _contentWidth() {
    return getApproxSize(this._renderedWidth, this._numberOfRenderedColumns, this.numberOfColumns);
  }

  get _contentHeight() {
    return getApproxSize(this._renderedHeight, this._numberOfRenderedRows, this.numberOfRows);
  }

  _scrollDidUpdate() {
    this.refresh();
  }

  async refresh() {
    this._top = this.scrollingElement.scrollTop;
    this._left = this.scrollingElement.scrollLeft;
    this._clientWidth = this.scrollingElement.clientWidth;
    this._clientHeight = this.scrollingElement.clientHeight;
    await Promise.all([this._recyclerX.recycle(), this._recyclerY.recycle()]);
    this.style.width = `${this._contentWidth}px`;
    this.style.height = `${this._contentHeight}px`;
  }

  _checkXThresholds(dist, nodes, metas, from) {
    if (nodes.length == 0) {
      return false;
    }
    if (from == Recycler.START) {
      return metas.get(this._recyclerX.startNode).x <= this._left - dist;
    }
    return metas.get(this._recyclerX.endNode).x >= this._left + this._clientWidth + dist;
  }

  _checkYThresholds(dist, nodes, metas, from) {
    if (nodes.length == 0) {
      return false;
    }
    if (from == Recycler.START) {
      return metas.get(this._recyclerY.startNode).y <= this._top - dist;
    }
    return metas.get(this._recyclerY.endNode).y >= this._top + this._clientHeight + dist;
  }

  _isXClientFull(nodes, metas, from) {
    return this._checkXThresholds(0, nodes, metas, from);
  }

  _hasEnoughXContent(nodes, metas, from) {
    return this._checkXThresholds(this._clientWidth/2, nodes, metas, from);
  }

  _isYClientFull(nodes, metas, from) {
    return this._checkYThresholds(0, nodes, metas, from);
  }

  _hasEnoughYContent(nodes, metas, from) {
    return this._checkYThresholds(this._clientHeight/2, nodes, metas, from);
  }

  _poolIdForIndex(idx) {
    return this.poolIdForCell(idx);
  }

  _initMetaForIndex(idx) {
    return { idx: idx, w: 0, h: 0, x: 0, y: 0 };
  }

  _shouldRecycle(node, meta) {
    return meta.x + meta.w < this._left - this._clientWidth/2 ||
        meta.x > this._left + this._clientWidth*1.5 ||
        meta.y + meta.h < this._top - this._clientHeight/2 ||
        meta.y > this._top + this._clientHeight*1.5;
  }

  _layout(node, meta) {
    if (node.style.position != 'absolute') {
      node.style.cssText = styleItemContainerHorizontal;
    }
    node.style.transform = `matrix(1, 0, 0, 1, ${meta.x}, ${meta.y})`;
  }

  _makeXActive(node, meta, idx, from, nodes, metas) {
    meta.w = this.widthForCell(meta.idx, node);
    if (from == Recycler.START && idx + 1 < nodes.length) {
      let nextM = metas.get(nodes[idx + 1]);
      meta.x = nextM.x - meta.w;
    }
    else if (from == Recycler.END && idx > 0) {
      let prevM = metas.get(nodes[idx - 1]);
      meta.x = prevM.x + prevM.w;
    }
    else {
      meta.x = 0;
    }
    // Keep track of the widths to estimate the mean.
    this._renderedWidth = this._renderedWidth + meta.w;
    this._numberOfRenderedColumns = this._numberOfRenderedColumns + 1;
  }

  _makeYActive(node, meta, idx, from, nodes, metas) {
    meta.h = this.heightForCell(meta.idx, node);
    if (from == Recycler.START && idx + 1 < nodes.length) {
      let nextM = metas.get(nodes[idx + 1]);
      meta.y = nextM.y - meta.h;
    }
    else if (from == Recycler.END && idx > 0) {
      let prevM = metas.get(nodes[idx - 1]);
      meta.y = prevM.y + prevM.h;
    }
    else {
      meta.y = 0;
    }
    // Keep track of the height to estimate the mean.
    this._renderedHeight = this._renderedHeight + meta.h;
    this._numberOfRenderedRows = this._numberOfRenderedRows + 1;
  }

  _nodeForIndex(idx, container) {
    return this.domForCell(idx, container);
  }

  _sizeX() {
    return this.numberOfColumns;
  }

  _sizeY() {
    return this.numberOfRows;
  }

  _setProps(props) {
    props.forEach((prop) => {
      if (this.hasOwnProperty(prop)) {
        let propVal = this[prop];
        delete this[prop];
        this[prop] = propVal;
      }
    });
  }
}

customElements.define('layout-table', LayoutTable);
