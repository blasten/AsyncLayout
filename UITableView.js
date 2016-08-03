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
    this[Symbol.iterator] = this.iterator.bind(this);
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
          done: presentItem === null
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
    this._didScroll = this._didScroll.bind(this);
    this._didResize = this._didResize.bind(this);
    this._scrollUpdate = this._scrollUpdate.bind(this);
    this._shouldReuse = this._shouldReuse.bind(this);
  }

  mount() {
    this.scrollingElement.addEventListener('scroll', this._didScroll);
    window.addEventListener('resize', this._didResize);
    this._setContainerStyles();
    this._updateCachedStates();
    this._reconcile();
  }

  unmount() {
    this.scrollingElement.removeEventListener('scroll', this._didScroll);
    window.removeEventListener('resize', this._didResize);
  }

  _reconcile() {
    var nodes = this.contentElement.querySelectorAll('[data-reusable-id]');
    for (let i = 0; i < nodes.length; i++) {
      this._pushToReusableQueue(nodes[i]);
    }
    this._update(true);
  }

  getIdxForCell(cell) {
    var idx = cell._d.index - cell._d.section.start;
    return cell._d.section.hasHeader ? idx - 1 : idx;
  }

  isCellRendered(cellIdx, sectionIdx) {
    let Q = this._renderedQueue;
    if (Q.isEmpty()) {
      return false;
    }
    if (sectionIdx < Q.peek._d.section.index || sectionIdx > Q.rear._d.section.index) {
      return false;
    }
    if (cellIdx < this.getIdxForCell(Q.peek) || cellIdx > this.getIdxForCell(Q.rear)) {
      return false;
    }
    return true;
  }

  /**
   *
   */
  reloadData() {
    // var Q = this._renderedQueue;
    // if (Q.isEmpty()) {
    //   return;
    // }

    // var node = Q.peek;
    // while (node != null) {
    //   this.getCellElement(node._d.index);
    //   node = Q.getNext(node);
    // }
    // this._positionNodes(Q.peek, Q.rear, true);
  }

  /**
   *
   */
  reloadCellAtIndex(cellIdx, sectionIdx) {
    if (!this.isCellRendered(cellIdx, sectionIdx)) {
      return;
    }
    this.getCellElement(cellIdx, sectionIdx, {updating: true});
    this._positionNodes(this._renderedQueue.peek, this._renderedQueue.rear, true);
  }

  scrollToCellIndex(idx) {
    var Q = this._renderedQueue;
    var offsetStart = this._containerOffsetStart;
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
  }

  /**
   *
   */
  deleteCellsAtIndex(idx) {
  }

  _updateCachedStates() {
    this._scrollStart = this.scrollStart;
    this._clientSize = this.clientSize;
    this._scrollEnd = this.scrollEnd;
    this._containerOffsetStart = this.getContainerOffsetStart();
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
      this._scrollToEnd = this.scrollStart > this._scrollStart;
      this._scrollStart = this.scrollStart;
      this._scrollEnd = this.scrollEnd;
      this._update(this._scrollToEnd);
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
    var cell;

    while ((cell = next.value) != null && fn(cell)) {
      this._pushToReusableQueue(cell);
      if (cell._d && cell._d.isHeader) {
        cell._d.section.header = null;
      }
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
      if (this.numberOfCells === 0) {
        return;
      }
      // if the queue was empty, fill toward the end
      end = true;
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
      let cell = this._allocate(idx);
      if (cell._d.isHeader) {
        cell._d.section.header = cell;
      }
      this._appendToContent(cell, end);
      end ? Q.push(cell) : Q.unshift(cell);
      idx = end ? idx + 1 : idx - 1;
      currentSize++;
    }
    return currentSize;
  }

  /**
   *
   */
  _allocate(idx) {
    var Q = this._renderedQueue;
    var section = this._getSectionForIndex(idx);
    var isHeader = Boolean(section.start === idx);
    var cell = isHeader ? this.getHeaderElement(section.index, section) :
        this.getCellElement(idx - section.start - 1, section.index, section);

    if (!cell) {
      return null;
    }
    if (!cell._d) {
      this._setCellStyles(cell);
    }
    cell._d = cell._d || {};
    cell._d.index = idx;
    cell._d.isHeader = isHeader;
    if (isHeader) {
      section.hasHeader = true;
    }
    cell._d.section = section;
    cell._d.size = 0;
    cell._d.offsetStart = 0;
    cell._d.offsetEnd = 0;
    Q.delete(cell);
    return cell;
  }

  _getSections() {
    if (this._sections) {
      return this._sections;
    }
    let sections = [];
    let maxSec = this.numberOfSections - 1;
    let secIdx = 0;
    let startIdx = 0;
    let endIndex;

    while (secIdx <= maxSec) {
      endIndex = this.getNumberOfCellsInSection(secIdx) + startIdx;
      sections.push({
        index: secIdx,
        start: startIdx,
        end: endIndex,
        header: null,
        hasHeader: false
      });
      startIdx = endIndex + 1;
      secIdx++;
    }
    this.size = startIdx;
    this._sections = sections;
    return sections;
  }

  _getSectionForIndex(idx) {
    var sections = this._getSections();
    var l = 0;
    var r = this.numberOfSections - 1;

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
        node._d.size = this.getNodeSize(node);
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
        node._d.size = this.getNodeSize(node);
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
      node.style.transform = 'translateY(' + offsetStart + 'px)';
    } else {
      node.style.transform = 'translateX(' + offsetStart + 'px)';
    }
  }

  _adjustStickyCells() {
    var Q = this._renderedQueue;

    if (Q.isEmpty()) {
      return;
    }

    var headerOffsetStart = 0;
    var peekSecIdx = Q.peek._d.section.index;
    var rearSecIdx = Q.rear._d.section.index;
    var topSecIdx = peekSecIdx;

    if (peekSecIdx !== rearSecIdx) {
      // try to use _section
      let offsetStart = this._scrollStart - this._containerOffsetStart;
      let currentSecIdx = peekSecIdx;

      while (currentSecIdx <= rearSecIdx) {
        let header = this._sections[currentSecIdx].header;
        if (header) {
          let minStart = offsetStart;
          if (this._stickyHeader) {
            minStart += this._stickyHeader._d.size;
          }
          if (header._d.offsetStart < offsetStart) {
            topSecIdx = currentSecIdx;
          } else if (header._d.offsetStart <= minStart) {
            headerOffsetStart = minStart >= offsetStart ?
                Math.min(0, header._d.offsetStart - minStart) : 0;
          } else {
            break;
          }
        } else {
          topSecIdx = currentSecIdx;
        }
        currentSecIdx++;
      }
    }
    // no sticky header found
    if (topSecIdx == null || !this.shouldHeaderStick(topSecIdx)) {
      return;
    }
    if (!this._stickyHeader || this._stickyHeader._d.section.index !== topSecIdx) {
      if (this._stickyHeader) {
        this._pushToReusableQueue(this._stickyHeader);
      }
      this._stickyHeader = this._allocate(this._sections[topSecIdx].start);
      this.containerElement.appendChild(this._stickyHeader);
      this._stickyHeader._d.size = this.getNodeSize(this._stickyHeader);
    }
    this._position(this._stickyHeader, headerOffsetStart);
  }

  _isolate(cell, yes) {
    if (yes) {
      this._isolatedCells[cell._d.index] = cell;
    } else {
      delete this._isolatedCells[cell._d.index];
    }
  }

  _appendToContent(node, end) {
    let Q = this._renderedQueue;
    let dest = this.contentElement;
    if (node && !node.parentNode) {
      if (Q.isEmpty()) {
        dest.appendChild(node);
      } else if (end) {
        dest.insertBefore(node, Q.rear.nextSibling);
      } else {
        dest.insertBefore(node, Q.peek);
      }
    }
  }

  _removeFromContainer(node) {
    if (this.contentElement && node) {
      this.contentElement.removeChild(node);
    }
  }

  _pushToReusableQueue(cell) {
    var id = cell.dataset.reusableId;
    if (!id) {
      throw new Error('node is missing `dataset.reusableId`');
    }

    this._renderedQueue.delete(cell);

    if (cell._d && this._isolatedCells[cell._d.index]) {
      return;
    }
    let rQ;
    if (!(rQ = this._reusableQueues[id])) {
      rQ = new QueueList();
      this._reusableQueues[id] = rQ;
    }
    this._scrollToEnd ? rQ.push(cell) : rQ.unshift(cell);
  }

  dequeueReusableElementWithId(id, args) {
    var idx = args[args.length - 1].index;
    if (args.length === 2) {
      let [secIdx, opts] = args;
      //
    } else if (args.length === 3) {
      let [cellIdx, secIdx, opts] = args;
      if (this.isCellRendered(cellIdx, secIdx)) {
        for (let cell of this._renderedQueue) {
          if (cell._d.section.index === secIdx && this.getIdxForCell(cell) === cellIdx) {
            return cell;
          }
        }
      }
    }

    if (this._isolatedCells[idx]) {
      return this._isolatedCells[idx];
    }
    let rQ;
    if (rQ = this._reusableQueues[id]) {
      return this._scrollToEnd ? rQ.shift() : rQ.pop();
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
    var sections = this._getSections();
    return sections[sections.length - 1].end + 1;
  }

  shouldHeaderStick(secIdx) {
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

  getNodeSize(node) {
    return this.orientation === UITableView.ORIENTATION_VERTICAL ?
        node.offsetHeight : node.offsetWidth;
  }

  _didResize() {
    let Q = this._renderedQueue;
    if (!Q.isEmpty()) {
      this._sumNodeSizes = this._positionNodes(Q.peek, Q.rear, true);
      this._sumNodeLength = Q.length;
      this._update(true);
    }
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
  var tableView = new (class extends UITableView {

    get scrollingElement() {
      return props.scrollingElement;
    }

    get containerElement() {
      return props.containerElement;
    }

    get contentElement() {
      return props.contentElement || props.scrollingElement;
    }

    getNumberOfCellsInSection(secIdx) {
      return props.data[secIdx].items.length;
    }

    get numberOfSections() {
      return props.data.length;
    }

  });

  tableView.data = props.data;
  tableView.getHeaderElement = props.getHeaderElement;
  tableView.getCellElement = props.getCellElement;
  tableView.shouldHeaderStick = props.shouldHeaderStick;
  tableView.mount();

  return tableView;
};

},{}]},{},[2]);
