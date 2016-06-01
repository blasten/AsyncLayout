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
