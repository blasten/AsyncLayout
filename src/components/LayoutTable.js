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
  vdom, 
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

const ROW_HOOK = {};

export default class LayoutTable extends HTMLElement {
  constructor() {
    super();
    this.style.cssText = styleLayoutVertical;
    this._props = {};
    this._renderedWidth = 0;
    this._renderedHeight = 0;
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
    // Create recyler contexts.
    const r = new Recycler(null, new DomPool());
    r.initMetaForIndex = this._initMetaForRowAtIndex.bind(this);
    r.shouldRecycle = this._shouldRecycleRow.bind(this);
    r.isClientFull = this._isClientFullRows.bind(this);
    r.hasEnoughContent = this._hasEnoughRows.bind(this);
    r.layout = this._layoutRow.bind(this);
    r.makeActive = this._makeRowActive.bind(this);
    r.nodeForIndex = this._rowForIndex.bind(this);
    r.createNodeContainer = _ => vdom();
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
    this._rowRecycler.mount();
    await forBeforePaint();
    if (!this.scrollingElement) {
      this.scrollingElement = document.scrollingElement;
    }
    this.refresh();
  }

  disconnectedCallback() {
    this._rowRecycler.unmount();
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

  async refresh() {
    this._top = this.scrollingElement.scrollTop;
    this._left = this.scrollingElement.scrollLeft;
    this._clientWidth = this.scrollingElement.clientWidth;
    this._clientHeight = this.scrollingElement.clientHeight;

    await this._rowRecycler.recycle();
    let rowRecycler = this._rowRecycler;
    let recyclers = rowRecycler._nodes.map(node => rowRecycler._pool.meta.get(node).recycler.recycle(), this);
    await Promise.all(recyclers);
    this.style.width = `${this._contentWidth}px`;
    this.style.height = `${this._contentHeight}px`;
  }

  _rowForIndex(idx, node, meta) {
    if (meta.recycler == null) {
      meta.recycler = new Recycler(this, this._poolForCells);
      meta.recycler.initMetaForIndex = this._initMetaForCellAtIndex;
      meta.recycler.shouldRecycle = this._shouldRecycleCell;
      meta.recycler.isClientFull = this._isClientFullCell;
      meta.recycler.hasEnoughContent = this._hasEnoughCell;
      meta.recycler.makeActive = this._makeCellActive;
      meta.recycler.nodeForIndex = this._cellForIndex;
      meta.recycler.poolIdForIndex = idx => this.poolIdForCell(idx);
      meta.recycler.size = _ => this.numberOfColumns;
    }
    meta.recycler.layout = this._layoutCell.bind(null, meta);
    meta.recycler.mount();
  }

  _initMetaForRowAtIndex(idx) {
    return { idx: idx, h: 0, y: 0 };
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
    meta.recycler.recycleAll();
  }

  _makeRowActive(node, meta, nodes, metas, idx, from) {
    meta.h = this.heightForRow(meta.idx, node);
    meta.y = getRowOffset(meta, idx, from, nodes, metas);
    this._renderedHeight += meta.h;
    this._numberOfRenderedRows += 1;
  }

  _initMetaForCellAtIndex(idx) {
    return { idx: idx, w: 0, x: 0, y: 0 };
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
    node.style.transform = `matrix(1, 0, 0, 1, ${meta.x}, ${rowMeta.y})`;
  }

  _makeCellActive(node, meta, nodes, metas, idx, from) {
    meta.w = this.widthForColumn(meta.idx, node);
    meta.x = getColumnOffset(meta, idx, from, nodes, metas);
    this._renderedWidth += meta.w;
    this._numberOfRenderedColumns += 1;
  }

  _cellForIndex(idx, node, meta) {
    return this.domForCell(idx, node);
  }
}

customElements.define('layout-table', LayoutTable);
