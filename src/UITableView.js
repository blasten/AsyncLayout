/**
 * UITableView
 */

'use strict';

var assert = require('./assert');
var QueueList = require('./QueueList');
var errorMessages = require('./errorMessages');
var factory = require('./factory');

class UITableView {

  constructor() {
    this.orientation = UITableView.ORIENTATION_VERTICAL;
    this.direction = UITableView.DIRECTION_START_END;
    this._renderedQueue = new QueueList();
    this._reusableQueues = {};
    this._window = 0.5;
    this._sumNodeSizes = 0;
    this._sumNodeLength = 0;
    this._estContentSize = 0;
    this._realContentSize = 0;
    this._sameScrollPosition = -1;
    this.isUpdating = false;
    this._didScroll = this._didScroll.bind(this);
    this._scrollUpdate = this._scrollUpdate.bind(this);
    this._shouldReuse = this._shouldReuse.bind(this);
  }

  mount() {
    this.scrollingElement.addEventListener('scroll', this._didScroll);
    this._setContainerStyles();
    this._updateCachedStates();
    this._reconcile();
  }

  unmount() {
    this.scrollingElement.removeEventListener('scroll', this._didScroll);
  }

  _reconcile() {
    var nodes = this.containerElement.querySelectorAll('[data-reusable-id]');
    for (let i = 0; i < nodes.length; i++) {
      this._pushToReusableQueue(nodes[i]);
    }
    this._update(true);
  }

  isIndexRendered(idx) {
    var Q = this._renderedQueue;
    return !Q.isEmpty() && idx >= Q.peek._d.index && idx <= Q.rear._d.index;
  }

  /**
   *
   */
  reloadData() {
    var Q = this._renderedQueue;
    if (Q.isEmpty()) {
      return;
    }

    this.isUpdating = true;
    var node = Q.peek;
    while (node != null) {
      this.getCellElement(node._d.index);
      node = Q.getNext(node);
    }
    this.isUpdating = false;
    this._positionNodes(Q.peek, Q.rear, true);
  }

  /**
   *
   */
  reloadCellAtIndex(idx, animation) {
    if (!this.isIndexRendered(idx)) {
      return;
    }
    animation = animation || { deltaSize: 0 };
    var willAnimate = Math.abs(animation.deltaSize) > 0;
    this.isUpdating = true;
    var cell = this.getCellElement(idx);
    this.isUpdating = false;

    if (!cell || !cell.parentNode) {
      return;
    }

    var newSize = this.getCellSize(cell._d.index, cell);
    var deltaSize = newSize - cell._d.size;

    return () => {

    };
  }

  scrollToCellIndex(idx) {
    var Q = this._renderedQueue;
    if (Q.isEmpty() || idx < 0 || idx >= this.numberOfCells) {
      return;
    }
    if (idx >= Q.peek._d.index && idx <= Q.rear._d.index) {
      let itr = Q.iterator(), next = itr.next();
      while (next.value != null) {
        if (next.value._d.index === idx) {
          this.scrollStart = next.value._d.offsetStart;
          return;
        }
        next = itr.next();
      }
    } else {
      this._updateReusables(true, () => true);
      let cell = this.allocateCell(idx);
      if (this._sumNodeLength === 0) {
        this._sumNodeSizes = this.getCellSize(idx, cell);
        this._sumNodeLength = 1;
      }
      let avgSize = this._sumNodeSizes / this._sumNodeLength;
      this._estContentSize = avgSize * this.numberOfCells;
      this.containerElement.style.height = this._estContentSize + 'px';
      cell._d.index = idx;
      cell._d.offsetStart = ~~(avgSize * idx);
      Q.push(cell);
      this.scrollStart = cell._d.offsetStart;
      this._updateCachedStates();
      this._positionNodes(Q.peek, Q.rear, true);
      this._update(false);
      this._update(true);
    }
  }

  /**
   *
   */
  insertCellsAtIndex(idx) {
    if (this.isIndexRendered(idx)) {
      this.reloadData();
    }
  }

  /**
   *
   */
  deleteCellsAtIndex(idx) {
    if (this.isIndexRendered(idx)) {
      this.reloadData();
    }
  }

  _updateCachedStates() {
    this._scrollStart = this.scrollStart;
    this._clientSize = this.clientSize;
    this._scrollEnd = this.scrollEnd;
  }

  _setContainerStyles() {
    var scrollingElement = this.scrollingElement;

    if (scrollingElement === document.body) {
      scrollingElement.style.overflow = '';
    } else {
      if (this.orientation === UITableView.ORIENTATION_VERTICAL) {
        scrollingElement.style.overflowX = 'hidden';
        scrollingElement.style.overflowY = 'auto';
      } else if (this.orientation === UITableView.ORIENTATION_HORIZONTAL) {
        scrollingElement.style.overflowX = 'hidden';
        scrollingElement.style.overflowY = 'auto';
      }
    }
  }

  _setCellStyles(node) {
    node.style.position = 'absolute';
    node.style.top = '0';
    node.style.left = '0';
    node.style.right = '0';
    node.style.bottom = '';
  }
  /**
   *
   * @param {boolean} end True if scrolling toward the end.
   */
  _update(end) {
    this._updateReusables(end, this._shouldReuse);
    this._allocateNodesIfNeeded(end);
    var rear = this._renderedQueue.rear;
    if (rear && rear._d.index === this.numberOfCells - 1) {
      this._realContentSize = rear._d.offsetEnd;
    }
    this._adjustScrollbarsIfNeeded();
  }

  /**
   * Runs on the scroll event.
   */
  _didScroll() {
    this._sameScrollPosition = 0;
    this._scrollUpdate();
    this.scrollingElement.removeEventListener('scroll', this._didScroll);
  }

  _scrollUpdate() {
    if (this._scrollStart === this.scrollStart) {
      this._sameScrollPosition++;
      if (this._sameScrollPosition > 2) {
        this.scrollingElement.addEventListener('scroll', this._didScroll);
        return;
      }
    } else {
      this._sameScrollPosition = 0;
      let end = this.scrollStart > this._scrollStart;
      this._scrollStart = this.scrollStart;
      this._scrollEnd = this.scrollEnd;
      this._update(end);
    }
    requestAnimationFrame(this._scrollUpdate);
  }

  /**
   *
   */
  _updateReusables(end, fn) {
    var Q = this._renderedQueue;
    var itr = Q.iterator(!end);
    var next = itr.next();

    while (next.value != null && fn(next.value)) {
      this._pushToReusableQueue(next.value);
      next = itr.next();
    }
  }

  /**
   *
   */
  releaseReusableQueue() {
    var Q = this._reusableQueues;
    Object.keys(Q).forEach((reusableId) => {
      var queue = Q[reusableId];
      var itr = queue.iterator();
      var next = itr.next();

      while (next.value != null) {
        this._removeFromContainer(next.value);
        queue.delete(next.value);
        next = itr.next();
      }
    }, this);
  }

  /**
   *
   */
  _adjustScrollbarsIfNeeded() {
    var Q = this._renderedQueue;
    if (Q.isEmpty()) {
      return;
    }
    if (Q.peek._d.offsetStart < 0 || (Q.peek._d.index === 0 && Q.peek._d.offsetStart > 0)) {
      let offsetStart = Q.peek._d.offsetStart;
      Q.peek._d.offsetStart = offsetStart < 0 ? this._avgCellSize * Q.peek._d.index : 0;
      this._positionNodes(Q.peek, Q.rear, true);
      this.scrollStart = this._scrollStart + (Q.peek._d.offsetStart - offsetStart);
    }
    if (this._realContentSize > 0) {
      this._estContentSize = this._realContentSize;
      this.containerElement.style.height = this._realContentSize + 'px';
    } else {
      let newContentSize = Math.round(this._avgCellSize * this.numberOfCells);
      if (Math.abs(newContentSize - this._estContentSize) > 100) {
        this._estContentSize = newContentSize;
        this.containerElement.style.height = newContentSize + 'px';
      }
    }
  }

  /**
   * @param {boolean} end
   */
  _shouldReuse(node) {
    if (this._renderedQueue.length <= 1) {
      return false;
    }
    var win = this._clientSize * this._window;
    return node._d.offsetEnd < this._scrollStart - win || node._d.offsetStart > this._scrollEnd + win;
  }

  /**
   * @param {boolean} end
   */
  _allocateNodesIfNeeded(end) {
    var Q = this._renderedQueue;

    if (Q.isEmpty()) {
      let length = this._allocateCells(3, end);
      this._sumNodeSizes += this._positionNodes(Q.peek, Q.rear, end);
      this._sumNodeLength += length;
    }

    const cwin = this._clientSize * this._window;
    const win = end ? this._scrollEnd + cwin : this._scrollStart - cwin;
    const maxIndex = this.numberOfCells - 1;
    const MAX_NODES = 500;

    var lastKey = end ? 'rear' : 'peek';
    var last = Q[lastKey];
    var requiredOffset = end ? win - last._d.offsetEnd : last._d.offsetStart - win;
    var size = Math.max(3, Math.round(requiredOffset / this._avgCellSize));

    while (requiredOffset > 0) {
      if (end && last._d.index === maxIndex) {
        return;
      }
      if (!end && last._d.index === 0) {
        return;
      }
      if (Q.length + size >= MAX_NODES) {
        size = MAX_NODES - Q.length;
      }
      if (size === 0) {
        return;
      }

      let length = this._allocateCells(size, end);
      let fromNode = end ? Q.getNext(last) : Q.getPrevious(last);
      this._sumNodeSizes += this._positionNodes(fromNode, Q[lastKey], end);
      this._sumNodeLength += length;
      last = Q[lastKey];
      requiredOffset = end ? win - last._d.offsetEnd : last._d.offsetStart - win;
      size = Math.max(3, Math.round(requiredOffset / this._avgCellSize));
    }
  }

  /**
   * @param {number} size
   * @param {boolean} end
   */
  _allocateCells(size, end) {
    var Q = this._renderedQueue;
    var currentSize = 0;
    var maxSize = this.numberOfCells;
    var lastRendered = end ? this._renderedQueue.rear : this._renderedQueue.peek;
    var idx = 0;

    if (lastRendered) {
      idx = end ? lastRendered._d.index + 1 : lastRendered._d.index - 1;
    }
    while (currentSize < size && idx >= 0 && idx < maxSize) {
      end ? Q.push(this.allocateCell(idx)) : Q.unshift(this.allocateCell(idx));
      idx = end ? idx + 1 : idx - 1;
      currentSize++;
    }

    return currentSize;
  }

  /**
   *
   */
  allocateCell(idx) {
    var Q = this._renderedQueue;
    var cell = this.getCellElement(idx);
    if (!cell._d) {
      this._setCellStyles(cell);
    }
    cell._d = {
      index: idx,
      size: 0,
      offsetStart: 0,
      offsetEnd: 0
    };
    Q.delete(cell);
    this._appendToContainer(cell);
    return cell;
  }

  /**
   * @param {Array<Node>} nodes
   * @param {boolean} end True if scrolling toward the end.
   */
  _positionNodes(fromNode, toNode, end) {
    var Q = this._renderedQueue;
    var sumSize = 0;
    var offset, lastNode;
    var node = fromNode;

    if (end) {
      let previousNode = Q.getPrevious(fromNode);
      lastNode = Q.getNext(toNode);
      offset = previousNode ? previousNode._d.offsetEnd : fromNode._d.offsetStart;

      if (node._d.index === 0 && offset !== 0) {
        offset = 0;
      }

      while (node != lastNode) {
        node._d.size = this.getCellSize(node._d.index, node);
        node._d.offsetStart = offset;
        node._d.offsetEnd = offset + node._d.size;
        offset = node._d.offsetEnd;
        sumSize = sumSize + node._d.size;
        node = Q.getNext(node);
      }
    } else {
      let nextNode = Q.getNext(fromNode);
      lastNode = Q.getPrevious(toNode);
      offset = nextNode ? nextNode._d.offsetStart : fromNode._d.offsetEnd;

      while (node != lastNode) {
        node._d.offsetEnd = offset;
        node._d.size = this.getCellSize(node._d.index, node);
        node._d.offsetStart = node._d.offsetEnd - node._d.size;
        offset = node._d.offsetStart;
        sumSize = sumSize + node._d.size;
        node = Q.getPrevious(node);
      }
    }

    node = fromNode;
    while (node != lastNode) {
      if (this.orientation === UITableView.ORIENTATION_VERTICAL) {
        node.style.transform = 'translate3d(0, ' + node._d.offsetStart + 'px, 0)';
      } else {
        node.style.transform = 'translate3d(' + node._d.offsetStart + 'px, 0, 0)';
      }
      node = end ? Q.getNext(node) : Q.getPrevious(node);
    }

    return sumSize;
  }

  _appendToContainer(node) {
    if (this.containerElement && node && !node.parentNode) {
      this.containerElement.appendChild(node);
    }
  }

  _removeFromContainer(node) {
    if (this.containerElement && node) {
      this.containerElement.removeChild(node);
    }
  }

  _pushToReusableQueue(node) {
    var reusableId = node.dataset.reusableId;
    if (!reusableId) {
      return;
    }
    if (!this._reusableQueues[reusableId]) {
      this._reusableQueues[reusableId] = new QueueList();
    }
    this._reusableQueues[reusableId].push(node);
    this._renderedQueue.delete(node);
  }

  dequeueReusableElementWithId(id, idx) {
    if (this.isUpdating && this.isIndexRendered(idx)) {
      for (let nodes = this._renderedQueue.asArray(), i = 0; i < nodes.length; i++) {
        if (nodes[i]._d.index === idx) {
          return nodes[i];
        }
      }
    }
    if (this._reusableQueues[id]) {
      return this._reusableQueues[id].pop();
    }
    return null;
  }

  get _avgCellSize() {
    return this._sumNodeSizes / this._sumNodeLength;
  }

  get clientSize() {
    return this.orientation === UITableView.ORIENTATION_VERTICAL ?
        this.scrollingElement.clientHeight : this.scrollingElement.clientWidth;
  }

  get scrollStart() {
    return this.orientation === UITableView.ORIENTATION_VERTICAL ?
        this.scrollingElement.scrollTop :  this.scrollingElement.scrollLeft;
  }

  set scrollStart(start) {
    if (this.orientation === UITableView.ORIENTATION_VERTICAL) {
      this.scrollingElement.scrollTop = start;
    } else {
      this.scrollingElement.scrollLeft = start;
    }
  }

  get scrollEnd() {
    return this.scrollStart + this.clientSize;
  }

  get scrollingElement() {
    throw new Error(errorMessages.unimplemented);
  }

  get containerElement() {
    return this.scrollingElement;
  }

  get numberOfCells() {
    return 0;
  }

  getCellElement(idx) {
    throw new Error(errorMessages.unimplemented);
  }

  getCellSize(idx, cellElement) {
    return this.orientation === UITableView.ORIENTATION_VERTICAL ?
        cellElement.offsetHeight : cellElement.offsetWidth;
  }

  /**
   * Factory for UITableView
   *
   * Sample usage:
   *
   * ```js
   * UITableView.create({
   *   data: []
   * });
   * ```
   */
  static create(props) {
    return factory(props);
  }

}

UITableView.ORIENTATION_VERTICAL = 1;
UITableView.ORIENTATION_HORIZONTAL = 2;
UITableView.DIRECTION_START_END = 3;
UITableView.DIRECTION_END_START = 4;

module.exports = UITableView;

// Export to the global object
if (typeof window === 'object') {
  window.UITableView = UITableView;
}
