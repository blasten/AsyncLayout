import {
  forBeforePaint
} from '../Async';
import {
  styleLayoutVertical,
  styleItemContainerTopVertical,
  styleItemContainerHorizontal
} from './styles';
import {
  setProps,
  vnode,
  getApproxSize,
  eventTarget,
  checkThreshold,
  getRowOffset,
  getColumnOffset,
  shouldRecycleRow,
  shouldRecycleColumn,
} from '../utils';
import Recycler from '../Recycler';
import DomPool from '../DomPool';

export default class LayoutTable extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutVertical;
    this._props = {};
    this._renderedWidth = 0;
    this._renderedHeight = 0;
    this._columnOffsets = {};
    this._numberOfRenderedColumns = 0;
    this._numberOfRenderedRows = 0;
    this._scrollDidUpdate = this._scrollDidUpdate.bind(this);
    this._poolForCells = new DomPool();
    this._initMetaForCellAtIndex = this._initMetaForCellAtIndex.bind(this);
    this._shouldRecycleCell = this._shouldRecycleCell.bind(this);
    this._isClientFullCell = this._isClientFullCell.bind(this);
    this._hasEnoughCell = this._hasEnoughCell.bind(this);
    this._layoutCell = this._layoutCell.bind(this);
    this._makeCellActive = this._makeCellActive.bind(this);
    this._cellForIndex = this._cellForIndex.bind(this);
    this._initIndexForCell = this._initIndexForCell.bind(this);
    // Create recyler context.
    const r = new Recycler(null, new DomPool());
    r.initMetaForIndex = this._initMetaForRowAtIndex.bind(this);
    r.shouldRecycle = this._shouldRecycleRow.bind(this);
    r.isClientFull = this._isClientFullRows.bind(this);
    r.hasEnoughContent = this._hasEnoughRows.bind(this);
    r.layout = this._layoutRow.bind(this);
    r.makeActive = this._makeRowActive.bind(this);
    r.nodeForIndex = this._rowForIndex.bind(this);
    r.initIndex = this._initIndexForRow.bind(this);
    r.createNodeContainer = _ => vnode();
    r.poolIdForIndex = _ => 0;
    r.size = _ => this.numberOfRows;
    this._rowRecycler = r;

    setProps(this, [
      'poolIdForCell',
      'domForCell',
      'numberOfColumns',
      'numberOfRows',
      'widthForCell',
      'heightForRow',
      'scrollingElement'
    ]);
  }

  async connectedCallback() {
    await forBeforePaint();
    if (!this.scrollingElement) {
      this.scrollingElement = document.scrollingElement;
    }
    this.refresh();
  }

  disconnectedCallback() {
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

  set heightForRow(fn) {
    this._props.heightForRow = fn;
  }

  get heightForRow() {
    return this._props.heightForRow || ((idx, node) => 50);
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

  refresh() {
    const top = this._top;
    const left = this._left;
    const rowRecycler = this._rowRecycler;
    const rowPool = this._rowRecycler.pool;

    this._top = this.scrollingElement.scrollTop;
    this._left = this.scrollingElement.scrollLeft;
    this._clientWidth = this.scrollingElement.clientWidth;
    this._clientHeight = this.scrollingElement.clientHeight;

    if (this._top != top) {
      this._rowRecycler.recycle();
      rowPool.getById(0).forEach(node => node.recycler.enqueueRendered());
    }
    if (this._left != left) {
      rowRecycler._nodes.map(node => node.recycler.recycle());
    }
    this.style.width = `${this._contentWidth}px`;
    this.style.height = `${this._contentHeight}px`;
  }

  _rowForIndex(idx, node, meta) {
    if (node.recycler == null) {
      node.recycler = new Recycler(this, this._poolForCells);
      node.recycler.initMetaForIndex = this._initMetaForCellAtIndex;
      node.recycler.shouldRecycle = this._shouldRecycleCell;
      node.recycler.isClientFull = this._isClientFullCell;
      node.recycler.hasEnoughContent = this._hasEnoughCell;
      node.recycler.makeActive = this._makeCellActive;
      node.recycler.initIndex = this._initIndexForCell;
      node.recycler.poolIdForIndex = idx => this.poolIdForCell(idx);
      node.recycler.size = _ => this.numberOfColumns;
      node.recycler.createNodeContainer = _ => document.createElement('div');
    }
    node.recycler.nodeForIndex = this._cellForIndex.bind(null, meta);
    node.recycler.layout = this._layoutCell.bind(null, meta);
    node.recycler.enqueueRendered();
  }

  _initIndexForRow() {
    const itemHeightMean = this._renderedHeight/this._numberOfRenderedRows;
    return isNaN(itemHeightMean) ? 0 : ~~(this._top/itemHeightMean);
  }

  _initMetaForRowAtIndex(idx) {
    return { idx: idx, h: 0, y: this._numberOfRenderedRows == 0 ? 0 : this._top };
  }

  _shouldRecycleRow(node, meta) {
    return shouldRecycleRow(node, meta, this._top, this._clientHeight);
  }

  _isClientFullRows(startMeta, endMeta, from) {
    return checkThreshold(startMeta.y, endMeta.y, 0, this._top,
        this._clientHeight, from);
  }

  _hasEnoughRows(startMeta, endMeta, from) {
    return checkThreshold(startMeta.y, endMeta.y, this._clientHeight/2,
        this._top, this._clientHeight, from);
  }

  _layoutRow(node, meta) {
    node.recycler.recycle();
  }

  _makeRowActive(node, meta, nodes, metas, idx, from) {
    meta.h = this.heightForRow(meta.idx, node);
    meta.y = getRowOffset(meta, idx, from, nodes, metas);
    this._renderedHeight += meta.h;
    this._numberOfRenderedRows += 1;
  }

  _initIndexForCell() {
    const itemWidthMean = this._renderedWidth/this._numberOfRenderedColumns;
    return this._numberOfRenderedColumns == 0 ? 0 : ~~(this._left/itemWidthMean);
  }

  _initMetaForCellAtIndex(idx) {
    return { w: 0, x: this._left };
  }

  _shouldRecycleCell(node, meta) {
    return shouldRecycleColumn(node, meta, this._left, this._clientWidth);
  }

  _isClientFullCell(startMeta, endMeta, from) {
    return checkThreshold(startMeta.x, endMeta.x, 0, this._left,
        this._clientWidth, from);
  }

  _hasEnoughCell(startMeta, endMeta, from) {
    return checkThreshold(startMeta.x, endMeta.x, this._clientWidth/2,
        this._left, this._clientWidth, from);
  }

  _layoutCell(rowMeta, node, meta, nodes, metas) {
    if (node.style.position != 'absolute') {
      node.style.cssText = styleItemContainerHorizontal;
    }
    node.style.display = 'block';
    node.style.top = `${rowMeta.y}px`;
    node.style.left = `${meta.x}px`;
  }

  _makeCellActive(node, meta, nodes, metas, idx, from) {
    meta.w = this.widthForColumn(meta.idx);
    meta.x = getColumnOffset(meta, idx, from, nodes, metas);

    this._startCellMeta = metas.get(nodes[0]);
    this._renderedWidth += meta.w;
    this._numberOfRenderedColumns += 1;
  }

  _cellForIndex(rowMeta, idx, node, meta) {
    return this.domForCell(rowMeta.idx, idx, node);
  }
}

customElements.define('layout-table', LayoutTable);
