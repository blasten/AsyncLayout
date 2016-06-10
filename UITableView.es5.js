"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

(function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var a = typeof require == "function" && require;if (!u && a) return a(o, !0);if (i) return i(o, !0);var f = new Error("Cannot find module '" + o + "'");throw f.code = "MODULE_NOT_FOUND", f;
      }var l = n[o] = { exports: {} };t[o][0].call(l.exports, function (e) {
        var n = t[o][1][e];return s(n ? n : e);
      }, l, l.exports, e, t, n, r);
    }return n[o].exports;
  }var i = typeof require == "function" && require;for (var o = 0; o < r.length; o++) {
    s(r[o]);
  }return s;
})({ 1: [function (require, module, exports) {
    /**
     * QueueList
     *
     * Supports push, pop, shift, unshift and remove operations all in constant time.
     */

    'use strict';

    var QueueList = function () {
      function QueueList() {
        _classCallCheck(this, QueueList);

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


      _createClass(QueueList, [{
        key: "isEmpty",
        value: function isEmpty() {
          return this._length === 0;
        }

        /**
         * Adds one element to the end of the list
         * in constant time.
         *
         * @param {object} obj
         */

      }, {
        key: "push",
        value: function push(obj) {
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

      }, {
        key: "unshift",
        value: function unshift(obj) {
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

      }, {
        key: "delete",
        value: function _delete(obj) {
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

      }, {
        key: "getPrevious",
        value: function getPrevious(obj) {
          if (this.has(obj)) {
            var listItem = this._map.get(obj);
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

      }, {
        key: "getNext",
        value: function getNext(obj) {
          if (this.has(obj)) {
            var listItem = this._map.get(obj);
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

      }, {
        key: "pop",
        value: function pop() {
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

      }, {
        key: "shift",
        value: function shift() {
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

      }, {
        key: "has",
        value: function has(obj) {
          return this._map.has(obj);
        }

        /**
         * Returns an iterator.
         *
         * @param {boolean} reverse Reverse order
         * @return {object} iterator An iterator
         */

      }, {
        key: "iterator",
        value: function iterator(reverse) {
          var currentListItem, lastListItem;
          var self = this;

          return {
            next: function next() {
              if (currentListItem === undefined) {
                currentListItem = reverse ? self._rearListItem : self._peekListItem;
                lastListItem = reverse ? self._peekListItem : self._rearListItem;
              }

              var presentItem = currentListItem;
              currentListItem = currentListItem && (reverse ? currentListItem.previous : currentListItem.next);

              return {
                value: presentItem ? presentItem.key : null,
                done: presentItem === lastListItem
              };
            }
          };
        }
      }, {
        key: "asArray",
        value: function asArray() {
          var itr = this.iterator();
          var next = itr.next();
          var arr = [];

          while (next.value != null) {
            arr.push(next.value);
            next = itr.next();
          }

          return arr;
        }
      }, {
        key: "peek",
        get: function get() {
          return this._peekListItem ? this._peekListItem.key : null;
        }

        /**
         * Gets the rear item.
         * That is, the last item inserted to the queue.
         *
         * @return {object} object
         */

      }, {
        key: "rear",
        get: function get() {
          return this._rearListItem ? this._rearListItem.key : null;
        }

        /**
         * Gets the length of the list.
         *
         * @return {number} length
         */

      }, {
        key: "length",
        get: function get() {
          return this._length;
        }
      }]);

      return QueueList;
    }();

    module.exports = QueueList;
  }, {}], 2: [function (require, module, exports) {
    /**
     * UITableView
     */

    'use strict';

    var assert = require('./assert');
    var QueueList = require('./QueueList');
    var errorMessages = require('./errorMessages');
    var factory = require('./factory');

    var UITableView = function () {
      function UITableView() {
        _classCallCheck(this, UITableView);

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

      _createClass(UITableView, [{
        key: "mount",
        value: function mount() {
          this.scrollingElement.addEventListener('scroll', this._didScroll);
          this._setContainerStyles();
          this._updateCachedStates();
          this._reconcile();
        }
      }, {
        key: "unmount",
        value: function unmount() {
          this.scrollingElement.removeEventListener('scroll', this._didScroll);
        }
      }, {
        key: "_reconcile",
        value: function _reconcile() {
          var nodes = this.contentElement.querySelectorAll('[data-reusable-id]');
          for (var i = 0; i < nodes.length; i++) {
            this._pushToReusableQueue(nodes[i]);
          }
          this._update(true);
        }
      }, {
        key: "isIndexRendered",
        value: function isIndexRendered(idx) {
          var Q = this._renderedQueue;
          return !Q.isEmpty() && idx >= Q.peek._d.index && idx <= Q.rear._d.index;
        }

        /**
         *
         */

      }, {
        key: "reloadData",
        value: function reloadData() {
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

      }, {
        key: "reloadCellAtIndex",
        value: function reloadCellAtIndex(idx, animation) {
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

          return function () {};
        }
      }, {
        key: "scrollToCellIndex",
        value: function scrollToCellIndex(idx) {
          var Q = this._renderedQueue;
          var offsetStart = this._containerOffsetStart;
          if (Q.isEmpty() || idx < 0 || idx >= this.numberOfCells) {
            return;
          }
          if (idx >= Q.peek._d.index && idx <= Q.rear._d.index) {
            var itr = Q.iterator(),
                next = itr.next();
            while (next.value != null) {
              if (next.value._d.index === idx) {
                this.scrollStart = next.value._d.offsetStart + offsetStart;
                return;
              }
              next = itr.next();
            }
          } else {
            this._updateReusables(true, function () {
              return true;
            });
            var cell = this._allocateCell(idx);
            if (this._sumNodeLength === 0) {
              this._sumNodeSizes = this.getCellSize(idx, cell);
              this._sumNodeLength = 1;
            }
            var avgSize = this._sumNodeSizes / this._sumNodeLength;
            this._estContentSize = avgSize * this.numberOfCells;
            this.contentElement.style.height = this._estContentSize + 'px';
            cell._d.index = idx;
            cell._d.offsetStart = ~ ~(avgSize * idx);
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

      }, {
        key: "insertCellsAtIndex",
        value: function insertCellsAtIndex(idx) {
          if (this.isIndexRendered(idx)) {
            this.reloadData();
          }
        }

        /**
         *
         */

      }, {
        key: "deleteCellsAtIndex",
        value: function deleteCellsAtIndex(idx) {
          if (this.isIndexRendered(idx)) {
            this.reloadData();
          }
        }
      }, {
        key: "_updateCachedStates",
        value: function _updateCachedStates() {
          this._scrollStart = this.scrollStart;
          this._clientSize = this.clientSize;
          this._scrollEnd = this.scrollEnd;
          this._containerOffsetStart = this.getContainerOffsetStart();
        }
      }, {
        key: "_setContainerStyles",
        value: function _setContainerStyles() {
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
      }, {
        key: "_setCellStyles",
        value: function _setCellStyles(node) {
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

      }, {
        key: "_update",
        value: function _update(end) {
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

      }, {
        key: "_didScroll",
        value: function _didScroll() {
          this._sameScrollPosition = 0;
          this._scrollUpdate();
          this.scrollingElement.removeEventListener('scroll', this._didScroll);
        }
      }, {
        key: "_scrollUpdate",
        value: function _scrollUpdate() {
          if (this._scrollStart === this.scrollStart) {
            this._sameScrollPosition++;
            if (this._sameScrollPosition > 2) {
              this.scrollingElement.addEventListener('scroll', this._didScroll);
              return;
            }
          } else {
            this._sameScrollPosition = 0;
            var end = this.scrollStart > this._scrollStart;
            this._scrollStart = this.scrollStart;
            this._scrollEnd = this.scrollEnd;
            this._update(end);
          }
          requestAnimationFrame(this._scrollUpdate);
        }

        /**
         *
         */

      }, {
        key: "_updateReusables",
        value: function _updateReusables(end, fn) {
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

      }, {
        key: "releaseReusableQueue",
        value: function releaseReusableQueue() {
          var _this = this;

          var Q = this._reusableQueues;
          Object.keys(Q).forEach(function (reusableId) {
            var queue = Q[reusableId];
            var itr = queue.iterator();
            var next = itr.next();

            while (next.value != null) {
              _this._removeFromContainer(next.value);
              queue.delete(next.value);
              next = itr.next();
            }
          }, this);
        }

        /**
         *
         */

      }, {
        key: "_adjustScrollbarsIfNeeded",
        value: function _adjustScrollbarsIfNeeded() {
          var Q = this._renderedQueue;
          if (Q.isEmpty()) {
            return;
          }
          if (Q.peek._d.offsetStart < 0 || Q.peek._d.index === 0 && Q.peek._d.offsetStart > 0) {
            var offsetStart = Q.peek._d.offsetStart;
            Q.peek._d.offsetStart = offsetStart < 0 ? this._avgCellSize * Q.peek._d.index : 0;
            this._positionNodes(Q.peek, Q.rear, true);
            this.scrollStart = this._scrollStart + (Q.peek._d.offsetStart - offsetStart);
          }
          if (this._realContentSize > 0) {
            this._estContentSize = this._realContentSize;
            this.contentElement.style.height = this._realContentSize + 'px';
          } else {
            var newContentSize = Math.round(this._avgCellSize * this.numberOfCells);
            if (Math.abs(newContentSize - this._estContentSize) > 100) {
              this._estContentSize = newContentSize;
              this.contentElement.style.height = newContentSize + 'px';
            }
          }
        }

        /**
         * @param {boolean} end
         */

      }, {
        key: "_shouldReuse",
        value: function _shouldReuse(node) {
          var win = this._clientSize * this._window;
          return node._d.offsetEnd < this._scrollStart - win || node._d.offsetStart > this._scrollEnd + win;
        }

        /**
         * @param {boolean} end
         */

      }, {
        key: "_allocateNodesIfNeeded",
        value: function _allocateNodesIfNeeded(end) {
          var Q = this._renderedQueue;

          if (Q.isEmpty()) {
            if (this.numberOfCells === 0) {
              return;
            }
            // if the queue was empty, fill toward the end
            end = true;
            var length = this._allocateNodes(3, end);
            this._sumNodeSizes += this._positionNodes(Q.peek, Q.rear, end);
            this._sumNodeLength += length;
          }

          var cwin = this._clientSize * this._window;
          var win = end ? this._scrollEnd + cwin : this._scrollStart - cwin;
          var maxIndex = this.numberOfCells - 1;
          var MAX_NODES = 500;

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

            var _length = this._allocateNodes(size, end);
            var fromNode = end ? Q.getNext(last) : Q.getPrevious(last);
            this._sumNodeSizes += this._positionNodes(fromNode, Q[lastKey], end);
            this._sumNodeLength += _length;
            last = Q[lastKey];
            requiredOffset = end ? win - last._d.offsetEnd : last._d.offsetStart - win;
            size = Math.max(3, Math.round(requiredOffset / this._avgCellSize));
          }
        }

        /**
         * @param {number} size
         * @param {boolean} end
         */

      }, {
        key: "_allocateNodes",
        value: function _allocateNodes(size, end) {
          var Q = this._renderedQueue;
          var currentSize = 0;
          var maxSize = this.numberOfCells;
          var lastRendered = end ? this._renderedQueue.rear : this._renderedQueue.peek;
          var idx = 0;

          if (lastRendered) {
            idx = end ? lastRendered._d.index + 1 : lastRendered._d.index - 1;
          }
          while (currentSize < size && idx >= 0 && idx < maxSize) {
            var cell = this._allocate(idx);
            if (cell._d.isHeader) {
              cell._d.section.header = cell;
            }
            this._appendToContent(cell);
            end ? Q.push(cell) : Q.unshift(cell);
            idx = end ? idx + 1 : idx - 1;
            currentSize++;
          }
          return currentSize;
        }

        /**
         *
         */

      }, {
        key: "_allocate",
        value: function _allocate(idx) {
          var Q = this._renderedQueue;
          var section = this._getSectionForIndex(idx);
          var isHeader = Boolean(section.start === idx);
          var cell = isHeader ? this.getHeaderElement(section.index, section) : this.getCellElement(idx - section.start - 1, section.index, section);

          if (!cell._d) {
            this._setCellStyles(cell);
          }
          cell._d = cell._d || {};
          cell._d.index = idx;
          cell._d.isHeader = isHeader;
          cell._d.section = section;
          cell._d.size = 0;
          cell._d.offsetStart = 0;
          cell._d.offsetEnd = 0;
          Q.delete(cell);
          return cell;
        }
      }, {
        key: "_getSections",
        value: function _getSections() {
          if (this._sections) {
            return this._sections;
          }
          var sections = [];
          var maxSec = this.numberOfSections - 1;
          var secIdx = 0;
          var startIdx = 0;
          var endIndex = void 0;

          while (secIdx <= maxSec) {
            endIndex = this.getNumberOfCellsInSection(secIdx) + startIdx;
            sections.push({ index: secIdx, start: startIdx, end: endIndex, header: null });
            startIdx = endIndex + 1;
            secIdx++;
          }
          this.size = startIdx;
          this._sections = sections;
          return sections;
        }
      }, {
        key: "_getSectionForIndex",
        value: function _getSectionForIndex(idx) {
          var sections = this._getSections();
          var l = 0;
          var r = this.numberOfSections - 1;

          while (l <= r) {
            var mid = l + r >> 1;
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

      }, {
        key: "_positionNodes",
        value: function _positionNodes(fromNode, toNode, end) {
          var Q = this._renderedQueue;
          var sumSize = 0;
          var offset, lastNode;
          var node = fromNode;

          if (end) {
            var previousNode = Q.getPrevious(fromNode);
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
            var nextNode = Q.getNext(fromNode);
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
      }, {
        key: "_position",
        value: function _position(node, offsetStart) {
          if (this.orientation === UITableView.ORIENTATION_VERTICAL) {
            node.style.transform = 'translate3d(0, ' + offsetStart + 'px, 0)';
          } else {
            node.style.transform = 'translate3d(' + offsetStart + 'px, 0, 0)';
          }
        }
      }, {
        key: "_adjustStickyCells",
        value: function _adjustStickyCells() {
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
            var offsetStart = this._scrollStart - this._containerOffsetStart;
            var currentSecIdx = peekSecIdx;

            while (currentSecIdx <= rearSecIdx) {
              var header = this._sections[currentSecIdx].header;
              if (header) {
                var minStart = offsetStart;
                if (this._stickyHeader) {
                  minStart += this._stickyHeader._d.size;
                }
                if (header._d.offsetStart < offsetStart) {
                  topSecIdx = currentSecIdx;
                } else if (header._d.offsetStart <= minStart) {
                  headerOffsetStart = minStart >= offsetStart ? Math.min(0, header._d.offsetStart - minStart) : 0;
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

          var currentHeader = this._sections[topSecIdx].header;
          this._position(this._stickyHeader, headerOffsetStart);
        }
      }, {
        key: "_isolate",
        value: function _isolate(cell, yes) {
          if (yes) {
            this._isolatedCells[cell._d.index] = cell;
          } else {
            delete this._isolatedCells[cell._d.index];
          }
        }
      }, {
        key: "_appendToContent",
        value: function _appendToContent(node) {
          if (this.contentElement && node && !node.parentNode) {
            this.contentElement.appendChild(node);
          }
        }
      }, {
        key: "_removeFromContainer",
        value: function _removeFromContainer(node) {
          if (this.contentElement && node) {
            this.contentElement.removeChild(node);
          }
        }
      }, {
        key: "_pushToReusableQueue",
        value: function _pushToReusableQueue(cell) {
          var reusableId = cell.dataset.reusableId;
          if (!reusableId) {
            throw new Error('node is missing `dataset.reusableId`');
          }

          this._renderedQueue.delete(cell);

          if (cell._d && this._isolatedCells[cell._d.index]) {
            return;
          }
          if (!this._reusableQueues[reusableId]) {
            this._reusableQueues[reusableId] = new QueueList();
          }
          this._reusableQueues[reusableId].push(cell);
        }
      }, {
        key: "dequeueReusableElementWithId",
        value: function dequeueReusableElementWithId(id, args) {
          var idx = args[args.length - 1].index;
          if (this.isUpdating && this.isIndexRendered(idx)) {
            for (var nodes = this._renderedQueue.asArray(), i = 0; i < nodes.length; i++) {
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
      }, {
        key: "getNumberOfCellsInSection",
        value: function getNumberOfCellsInSection(sectionIdx) {
          return 0;
        }
      }, {
        key: "shouldHeaderStick",
        value: function shouldHeaderStick(secIdx) {
          return false;
        }
      }, {
        key: "getContainerOffsetStart",
        value: function getContainerOffsetStart() {
          var offset = 0,
              node = this.contentElement;
          while (node != null && node !== this.scrollingElement && node !== this.containerElement) {
            offset += this.orientation === UITableView.ORIENTATION_VERTICAL ? this.contentElement.offsetTop : this.contentElement.offsetLeft;
            node = node.offsetParent;
          }
          return offset;
        }
      }, {
        key: "getHeaderElement",
        value: function getHeaderElement(sectionIdx) {
          throw new Error(errorMessages.unimplemented);
        }
      }, {
        key: "getHeaderSize",
        value: function getHeaderSize(sectionIdx, headerEl) {
          return this.orientation === UITableView.ORIENTATION_VERTICAL ? headerEl.offsetHeight : headerEl.offsetWidth;
        }
      }, {
        key: "getCellElement",
        value: function getCellElement(cellIdx, sectionIdx) {
          throw new Error(errorMessages.unimplemented);
        }
      }, {
        key: "getNodeSize",
        value: function getNodeSize(node) {
          return this.orientation === UITableView.ORIENTATION_VERTICAL ? node.offsetHeight : node.offsetWidth;
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

      }, {
        key: "_avgCellSize",
        get: function get() {
          return this._sumNodeSizes / this._sumNodeLength;
        }
      }, {
        key: "clientSize",
        get: function get() {
          return this.orientation === UITableView.ORIENTATION_VERTICAL ? this.scrollingElement.clientHeight : this.scrollingElement.clientWidth;
        }
      }, {
        key: "scrollStart",
        get: function get() {
          return this.orientation === UITableView.ORIENTATION_VERTICAL ? this.scrollingElement.scrollTop : this.scrollingElement.scrollLeft;
        },
        set: function set(start) {
          if (this.orientation === UITableView.ORIENTATION_VERTICAL) {
            this.scrollingElement.scrollTop = start;
          } else {
            this.scrollingElement.scrollLeft = start;
          }
        }
      }, {
        key: "scrollEnd",
        get: function get() {
          return this.scrollStart + this.clientSize;
        }
      }, {
        key: "scrollingElement",
        get: function get() {
          throw new Error(errorMessages.unimplemented);
        }
      }, {
        key: "contentElement",
        get: function get() {
          return this.scrollingElement;
        }
      }, {
        key: "containerElement",
        get: function get() {
          return null;
        }
      }, {
        key: "numberOfSections",
        get: function get() {
          return 1;
        }
      }, {
        key: "numberOfCells",
        get: function get() {
          var sections = this._getSections();
          return sections[sections.length - 1].end + 1;
        }
      }], [{
        key: "create",
        value: function create(props) {
          return factory(props);
        }
      }]);

      return UITableView;
    }();

    UITableView.CLASS_CELL = 1;
    UITableView.CLASS_HEADER = 2;
    UITableView.ORIENTATION_VERTICAL = 1;
    UITableView.ORIENTATION_HORIZONTAL = 2;
    UITableView.DIRECTION_START_END = 3;
    UITableView.DIRECTION_END_START = 4;

    module.exports = UITableView;

    // Export to the global object
    if ((typeof window === "undefined" ? "undefined" : _typeof(window)) === 'object') {
      window.UITableView = UITableView;
    }
  }, { "./QueueList": 1, "./assert": 3, "./errorMessages": 4, "./factory": 5 }], 3: [function (require, module, exports) {
    'use strict';

    module.exports = function assert(isTrue, msg) {
      if (!isTrue) {
        throw new Error(msg || 'Assertion failed');
      }
    };
  }, {}], 4: [function (require, module, exports) {
    'use strict';

    module.exports = {
      unimplemented: 'This method should be implemented',
      invalidOrientation: 'Invalid orientation value'
    };
  }, {}], 5: [function (require, module, exports) {
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
      var tableView = new (function (_UITableView) {
        _inherits(CustomUITableView, _UITableView);

        function CustomUITableView() {
          _classCallCheck(this, CustomUITableView);

          return _possibleConstructorReturn(this, Object.getPrototypeOf(CustomUITableView).apply(this, arguments));
        }

        _createClass(CustomUITableView, [{
          key: "getNumberOfCellsInSection",
          value: function getNumberOfCellsInSection(secIdx) {
            return props.data[secIdx].items.length;
          }
        }, {
          key: "scrollingElement",
          get: function get() {
            return props.scrollingElement;
          }
        }, {
          key: "containerElement",
          get: function get() {
            return props.containerElement;
          }
        }, {
          key: "contentElement",
          get: function get() {
            return props.contentElement || props.scrollingElement;
          }
        }, {
          key: "numberOfSections",
          get: function get() {
            return props.data.length;
          }
        }]);

        return CustomUITableView;
      }(UITableView))();

      tableView.data = props.data;
      tableView.getHeaderElement = props.getHeaderElement;
      tableView.getCellElement = props.getCellElement;
      tableView.shouldHeaderStick = props.shouldHeaderStick;
      tableView.mount();

      return tableView;
    };
  }, {}] }, {}, [2]);
