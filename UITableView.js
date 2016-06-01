(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * QueueList
 *
 * Supports push, pop, shift, unshift and remove operations all in constant time.
 */

'use strict';

class QueueList {

  constructor() {
    this._map = new WeakMap();
    this._rearListItem = null;
    this._peekListItem = null;
    this._length = 0;
  }

  /**
   * Returns true if the queue is empty.
   *
   * @param {boolean}
   */
  isEmpty() {
    return this._length === 0;
  }

  /**
   * Adds one element to the end of the list
   * in constant time.
   *
   * @param {object} obj
   */
  push(obj) {
    if (this.has(obj)) {
      return;
    }

    var listItem = {
      key: obj,
      previous: this._rearListItem,
      next: null
    };

    this._map.set(obj, listItem);

    if (this._rearListItem != null) {
      this._rearListItem.next = listItem;
    }

    if (this._peekListItem == null) {
      this._peekListItem = listItem;
    }

    this._rearListItem = listItem;
    this._length++;
  }

  /**
   * Adds one element to the beginning of the list
   * in constant time.
   *
   * @param {object} obj
   */
  unshift(obj) {
    if (this.has(obj)) {
      return;
    }

    var listItem = {
      key: obj,
      previous: null,
      next: this._peekListItem
    };

    this._map.set(obj, listItem);

    if (this._peekListItem != null) {
      this._peekListItem.previous = listItem;
    }

    if (this._rearListItem == null) {
      this._rearListItem = listItem;
    }

    this._peekListItem = listItem;
    this._length++;
  }

  /**
   * Removes the object from the queue in constant time.
   *
   * @param {object} obj
   */
  delete(obj) {
    if (!this.has(obj)) {
      return;
    }

    var listItem = this._map.get(obj);

    if (listItem.previous != null) {
      listItem.previous.next = listItem.next;
    }

    if (listItem.next != null) {
      listItem.next.previous = listItem.previous;
    }

    if (listItem === this._rearListItem) {
      this._rearListItem = listItem.previous;
    }

    if (listItem === this._peekListItem) {
      this._peekListItem = listItem.next;
    }

    this._map.delete(obj);
    this._length--;
    return obj;
  }

  /**
   * Obtains the previous object.
   *
   * @param {object} obj
   */

  getPrevious(obj) {
    if (this.has(obj)) {
      let listItem = this._map.get(obj);
      if (listItem.previous) {
        return listItem.previous.key;
      }
    }
    return null;
  }

  /**
   * Obtains the next object.
   *
   * @param {object} obj
   */

  getNext(obj) {
    if (this.has(obj)) {
      let listItem = this._map.get(obj);
      if (listItem.next) {
        return listItem.next.key;
      }
    }
    return null;
  }

  /**
   * Removes the last element from the list and returns that element
   * in constant time.
   *
   * @return {object} object
   */
  pop() {
    if (this._rearListItem == null) {
      return null;
    }
    return this.delete(this._rearListItem.key);
  }

  /**
   * Removes the first element from the list and returns that element
   * in constant time.
   *
   * @return {object} object
   */
  shift() {
    if (this._peekListItem == null) {
      return null;
    }
    return this.delete(this._peekListItem.key);
  }

  /**
   * Gets the peek item.
   * That is, the first item inserted to the queue.
   *
   * @return {object} object
   */
  get peek() {
    return this._peekListItem ? this._peekListItem.key : null;
  }

  /**
   * Gets the rear item.
   * That is, the last item inserted to the queue.
   *
   * @return {object} object
   */
  get rear() {
    return this._rearListItem ? this._rearListItem.key : null;
  }

  /**
   * Gets the length of the list.
   *
   * @return {number} length
   */
  get length() {
    return this._length;
  }


  has(obj) {
    return this._map.has(obj);
  }

  /**
   * Returns an iterator.
   *
   * @param {boolean} reverse Reverse order
   * @return {object} iterator An iterator
   */
  iterator(reverse) {
    var currentListItem, lastListItem;
    var self = this;

    return {
      next() {
        if (currentListItem === undefined) {
          currentListItem = reverse ? self._rearListItem : self._peekListItem;
          lastListItem = reverse ? self._peekListItem : self._rearListItem;
        }

        let presentItem = currentListItem;
        currentListItem = currentListItem && (reverse ? currentListItem.previous : currentListItem.next);

        return {
          value: presentItem ? presentItem.key : null,
          done: presentItem === lastListItem
        };
      }
    };
  }

  asArray() {
    var itr = this.iterator();
    var next = itr.next();
    var arr = [];

    while (next.value != null) {
      arr.push(next.value);
      next = itr.next();
    }

    return arr;
  }

}

module.exports = QueueList;

},{}],2:[function(require,module,exports){
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
    this._stickyQueue = new QueueList();
    this._reusableQueues = {};
    this._isolatedCells = {};
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
    var nodes = this.contentElement.querySelectorAll('[data-reusable-id]');
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
    var offsetStart = this.getContainerOffsetStart();
    if (Q.isEmpty() || idx < 0 || idx >= this.numberOfCells) {
      return;
    }
    if (idx >= Q.peek._d.index && idx <= Q.rear._d.index) {
      let itr = Q.iterator(), next = itr.next();
      while (next.value != null) {
        if (next.value._d.index === idx) {
          this.scrollStart = next.value._d.offsetStart + offsetStart;
          return;
        }
        next = itr.next();
      }
    } else {
      this._updateReusables(true, () => true);
      let cell = this._allocateCell(idx);
      if (this._sumNodeLength === 0) {
        this._sumNodeSizes = this.getCellSize(idx, cell);
        this._sumNodeLength = 1;
      }
      let avgSize = this._sumNodeSizes / this._sumNodeLength;
      this._estContentSize = avgSize * this.numberOfCells;
      this.contentElement.style.height = this._estContentSize + 'px';
      cell._d.index = idx;
      cell._d.offsetStart = ~~(avgSize * idx);
      Q.push(cell);
      this.scrollStart = cell._d.offsetStart + offsetStart;
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
    this._adjustStickyCells();
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
      this.contentElement.style.height = this._realContentSize + 'px';
    } else {
      let newContentSize = Math.round(this._avgCellSize * this.numberOfCells);
      if (Math.abs(newContentSize - this._estContentSize) > 100) {
        this._estContentSize = newContentSize;
        this.contentElement.style.height = newContentSize + 'px';
      }
    }
  }

  /**
   * @param {boolean} end
   */
  _shouldReuse(node) {
    var win = this._clientSize * this._window;
    return node._d.offsetEnd < this._scrollStart - win || node._d.offsetStart > this._scrollEnd + win;
  }

  /**
   * @param {boolean} end
   */
  _allocateNodesIfNeeded(end) {
    var Q = this._renderedQueue;

    if (Q.isEmpty()) {
      let length = this._allocateNodes(3, end);
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

      let length = this._allocateNodes(size, end);
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
  _allocateNodes(size, end) {
    var Q = this._renderedQueue;
    var currentSize = 0;
    var maxSize = this.numberOfCells;
    var lastRendered = end ? this._renderedQueue.rear : this._renderedQueue.peek;
    var idx = 0;

    if (lastRendered) {
      idx = end ? lastRendered._d.index + 1 : lastRendered._d.index - 1;
    }
    while (currentSize < size && idx >= 0 && idx < maxSize) {
      end ? Q.push(this._allocate(idx)) : Q.unshift(this._allocate(idx));
      idx = end ? idx + 1 : idx - 1;
      currentSize++;
    }

    return currentSize;
  }

  _getSectionObject(idx) {
    var sections = this._sections;
    var l = 0;
    var r = this.numberOfSections - 1;

    if (!this._sections) {
      sections = [];
      let secIdx = 0;
      let startIdx = 0;
      let endIndex;

      while (secIdx <= r) {
        endIndex = this.getNumberOfCellsInSection(secIdx) + startIdx;
        sections.push({ index: secIdx, start: startIdx, end: endIndex });
        startIdx = endIndex + 1;
        secIdx++;
      }
      this.size = startIdx;
      this._sections = sections;
    }
    // Binary search
    while (l <= r) {
      let mid = (l + r) >> 1;
      if (idx < sections[mid].start) {
        r = l - 1;
      } else if (idx > sections[mid].end) {
        l = l + 1;
      } else {
        return sections[mid];
      }
    }
    return null;
  }

  // _allocateCells(size, end) {
  //   var Q = this._renderedQueue;
  //   var lastRendered = end ? this._renderedQueue.rear : this._renderedQueue.peek;
  //   var idx = 0;
  //   var secIdx = 0;
  //   var cellsInSec;
  //   var numSections = this.numberOfSections;
  //   var allocated = 0;

  //   if (lastRendered) {
  //     if (lastRendered._d.is === UITableView.CLASS_HEADER) {
  //       cellsInSec = this.getNumberOfCellsInSection(secIdx);
  //       secIdx = end ? lastRendered._d.index + 1 : lastRendered._d.index - 1;
  //       idx = end ? 0 : cellsInSec - 1;
  //     } else {
  //       cellsInSec = this.getNumberOfCellsInSection(lastRendered._d.secIndex);
  //       idx = end ? lastRendered._d.index + 1 : lastRendered._d.index - 1;
  //     }
  //   }
  //   while (allocated < size && idx >= 0 && idx < cellsInSec) {
  //     if (idx === 0) {
  //       let header = this._allocate(UITableView.CLASS_HEADER, secIdx);
  //       if (!header) {
  //         continue;
  //       }
  //       end ? Q.push(cell) : Q.unshift(cell);
  //       if (this.shouldHeaderStick(secIdx, header)) {
  //         end ? this._stickyQueue.push(cell) : this._stickyQueue.unshift(cell);
  //       }
  //       allocated = allocated + 1;
  //     }
  //     if (allocated < size) {
  //       let cell = this._allocate(UITableView.CLASS_CELL, idx, secIdx);
  //       if (!cell) {
  //         continue;
  //       }
  //       end ? Q.push(cell) : Q.unshift(cell);
  //     }
  //     idx = end ? idx + 1 : idx - 1;
  //     if (idx < 0) {
  //       secIdx = secIdx - 1;
  //       if (secIdx >= 0) {
  //         cellsInSec = this.getNumberOfCellsInSection(secIdx);
  //         idx = cellsInSec - 1;
  //       } else {
  //         return allocated;
  //       }
  //     }
  //     if (idx >= cellsInSec) {
  //       idx = 0;
  //       secIdx = secIdx + 1;
  //       if (secIdx < numSections) {
  //         cellsInSec = this.getNumberOfCellsInSection(secIdx);
  //       } else {
  //         return allocated;
  //       }
  //     }
  //     allocated = allocated + 1;
  //   }
  //   return allocated;
  // }

  /**
   *
   */
  _allocate(idx) {
    var Q = this._renderedQueue;
    var section = this._getSectionObject(idx);

    console.log(this._sections);
    var cell = section.start === idx ? this.getHeaderElement(section.index, section) :
        this.getCellElement(idx - section.start, section.index, section);

    if (!cell._d) {
      this._setCellStyles(cell);
    }
    cell._d = cell._d || {};
    cell._d.index = idx;
    cell._d.section = this._getSectionObject(idx);
    cell._d.size = 0;
    cell._d.offsetStart = 0;
    cell._d.offsetEnd = 0;
    Q.delete(cell);
    this._appendToContent(cell);
    return cell;
  }
  // _allocate(is, idx, secIdx) {
  //   var Q = this._renderedQueue;
  //   var cell = this.getCellElement(idx);
  //   if (!cell._d) {
  //     this._setCellStyles(cell);
  //   }
  //   cell._d = cell._d || {};
  //   cell._d.is = is;
  //   cell._d.index = idx;
  //   cell._d.secIndex = secIdx;
  //   cell._d.size = 0;
  //   cell._d.offsetStart = 0;
  //   cell._d.offsetEnd = 0;
  //   Q.delete(cell);
  //   this._appendToContent(cell);
  //   return cell;
  // }

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
      this._position(node, node._d.offsetStart);
      node = end ? Q.getNext(node) : Q.getPrevious(node);
    }

    return sumSize;
  }

  _position(node, offsetStart) {
    if (this.orientation === UITableView.ORIENTATION_VERTICAL) {
      node.style.transform = 'translate3d(0, ' + offsetStart + 'px, 0)';
    } else {
      node.style.transform = 'translate3d(' + offsetStart + 'px, 0, 0)';
    }
  }

  _adjustStickyCells() {
    var SQ = this._stickyQueue;
    if (SQ.isEmpty()) {
      return;
    }
    var itr = SQ.iterator();
    var next = itr.next();
    var offsetStart = this._scrollStart - this.getContainerOffsetStart();

    while (next.value != null) {
      let cell = next.value;
      let stickyCell = cell._d.stickyCell;

      if (cell._d.offsetStart <= offsetStart) {
        if (!stickyCell) {
          this._isolate(cell, false);
          stickyCell = this._allocateCell(cell._d.index);
          this._isolate(cell, true);
          cell._d.stickyCell = stickyCell;
          this.containerElement.appendChild(stickyCell);
        }
        let nextStickyCell = SQ.getNext(cell);
        if (nextStickyCell) {
          let slideDy = nextStickyCell._d.offsetStart - (offsetStart + cell._d.size);
          this._position(stickyCell, slideDy < 0 ? slideDy : 0);
        }
        cell.style.visibility = 'hidden';
        stickyCell.style.display = 'block';
      } else if (stickyCell) {
        cell.style.visibility = '';
        stickyCell.style.display = 'none';
      }
      next = itr.next();
    }
  }

  _isolate(cell, yes) {
    if (yes) {
      this._isolatedCells[cell._d.index] = cell;
    } else {
      delete this._isolatedCells[cell._d.index];
    }
  }

  _appendToContent(node) {
    if (this.contentElement && node && !node.parentNode) {
      this.contentElement.appendChild(node);
    }
  }

  _removeFromContainer(node) {
    if (this.contentElement && node) {
      this.contentElement.removeChild(node);
    }
  }

  _pushToReusableQueue(node) {
    var reusableId = node.dataset.reusableId;
    if (!reusableId) {
      throw new Error('node is missing `dataset.reusableId`');
    }
    this._renderedQueue.delete(node);
    if (node._d && this._isolatedCells[node._d.index]) {
      return;
    }
    if (!this._reusableQueues[reusableId]) {
      this._reusableQueues[reusableId] = new QueueList();
    }
    this._reusableQueues[reusableId].push(node);
  }

  dequeueReusableElementWithId(id, args) {
    if (this.isUpdating && this.isIndexRendered(idx)) {
      for (let nodes = this._renderedQueue.asArray(), i = 0; i < nodes.length; i++) {
        if (nodes[i]._d.index === idx) {
          return nodes[i];
        }
      }
    }
    if (this._isolatedCells[idx]) {
      return this._isolatedCells[idx];
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

  get contentElement() {
    return this.scrollingElement;
  }

  get containerElement() {
    return null;
  }

  get numberOfSections() {
    return 1;
  }

  getNumberOfCellsInSection(sectionIdx) {
    return 0;
  }

  get numberOfCells() {
    return 0;
  }

  shouldCellStick(el) {
    return false;
  }


  shouldHeaderStick(secIdx, el) {
    return false;
  }

  getContainerOffsetStart() {
    var offset = 0, node = this.contentElement;
    while (node != null && node !== this.scrollingElement && node !== this.containerElement) {
      offset += this.orientation === UITableView.ORIENTATION_VERTICAL ?
          this.contentElement.offsetTop : this.contentElement.offsetLeft;
      node = node.offsetParent;
    }
    return offset;
  }

  getHeaderElement(sectionIdx) {
    throw new Error(errorMessages.unimplemented);
  }

  getHeaderSize(sectionIdx, headerEl) {
    return this.orientation === UITableView.ORIENTATION_VERTICAL ?
        headerEl.offsetHeight : headerEl.offsetWidth;
  }

  getCellElement(cellIdx, sectionIdx) {
    throw new Error(errorMessages.unimplemented);
  }
  
  getCellSize(cellIdx, sectionIdx, cellEl) {
    return this.orientation === UITableView.ORIENTATION_VERTICAL ?
        cellEl.offsetHeight : cellEl.offsetWidth;
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

UITableView.CLASS_CELL = 1;
UITableView.CLASS_HEADER = 2;
UITableView.ORIENTATION_VERTICAL = 1;
UITableView.ORIENTATION_HORIZONTAL = 2;
UITableView.DIRECTION_START_END = 3;
UITableView.DIRECTION_END_START = 4;

module.exports = UITableView;

// Export to the global object
if (typeof window === 'object') {
  window.UITableView = UITableView;
}

},{"./QueueList":1,"./assert":3,"./errorMessages":4,"./factory":5}],3:[function(require,module,exports){
'use strict';

module.exports = function assert(isTrue, msg) {
  if (!isTrue) {
    throw new Error(msg || 'Assertion failed');
  }
}

},{}],4:[function(require,module,exports){
'use strict';

module.exports = {
  unimplemented: 'This method should be implemented',
  invalidOrientation: 'Invalid orientation value'
};

},{}],5:[function(require,module,exports){
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

'use strict';

module.exports = function factory(props) {
  var tableView = new (class CustomUITableView extends UITableView {

    get scrollingElement() {
      return props.scrollingElement;
    }

    get containerElement() {
      return props.containerElement;
    }

    get contentElement() {
      return props.contentElement || props.scrollingElement;
    }

    get numberOfCells() {
      return props.data.length;
    }
  });

  tableView.data = props.data;
  tableView.getCellElement = props.getCellElement;
  tableView.mount();

  return tableView;
};

},{}]},{},[2]);
