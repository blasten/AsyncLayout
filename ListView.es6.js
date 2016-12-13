(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.ListView = factory());
}(this, (function () { 'use strict';

class DomPool {
  constructor() {
    this._pools = {};
  }

  push(poolId, obj) {
    if (!this._pools[poolId]) {
      this._pools[poolId] = [];
    }
    this._pools[poolId].push(obj);
  }

  pop(poolId) {
    if (!this._pools[poolId]) {
      return null;
    }
    return this._pools[poolId].pop() || null;
  }
}

function forIdleTime() {
  return new Promise(function (resolve) {
    let w = window;
    w.requestIdleCallback ? w.requestIdleCallback(resolve) : w.setTimeout(resolve, 16);
  });
}

function forBeforePaint() {
  return new Promise(function (resolve) {
    window.requestAnimationFrame(resolve);
  });
}

class Recycler {
  constructor() {
    this._size = 0;
    this._pool = null;
    this._parentContainer = null;
    this._jobId = 0;
    this._nodes = [];
    this._isMounted = false;
    this.meta = new WeakMap();
  }

  mount() {
    var _this = this;

    return Promise.resolve().then(function () {
      return forBeforePaint();
    }).then(function () {
      _this._isMounted = true;
      _this._putNodesInPool(_this.parentContainer.children);
      return _this.recycle();
    }).then(function () {});
  }

  recycle() {
    var _this2 = this;

    return Promise.resolve().then(function () {
      if (!!_this2._isMounted) {
        return Promise.resolve().then(function () {
          _this2._jobId++;
          return _this2._recycle(Recycler.START, 1, _this2._jobId);
        }).then(function () {
          return _this2._recycle(Recycler.END, 1, _this2._jobId);
        });
      }
    }).then(function () {});
  }

  _recycle(from, nextIncrement, jobId) {
    var _this5 = this;

    return Promise.resolve().then(function () {
      if (!(_this5._jobId != jobId)) {
        while (!_this5.isClientFull(_this5._nodes, _this5._metas, from)) {
          _this5._populateClient(from, nextIncrement);
          nextIncrement = nextIncrement * 2;
        }
        if (!_this5.hasEnoughContent(_this5._nodes, _this5._metas, from)) {
          return Promise.resolve().then(function () {
            return forIdleTime();
          }).then(function (_resp) {
            let idle = _resp;
            _this5._populateClient(from, nextIncrement);
            return _this5._recycle(from, nextIncrement * 2, jobId);
          });
        }
      }
    }).then(function () {});
  }

  _putNodesInPool(nodes) {
    Array.from(nodes).forEach(node => {
      this.pool.push(node.dataset.poolId || 0, node);
    });
  }

  _shouldRecycle(node) {
    return this.shouldRecycle(node, meta.get(node));
  }

  _populateClient(from, nextIncrement) {
    const nodes = this._nodes;
    const meta = this.meta;

    for (let i = 0; from == Recycler.END && i < nodes.length - 1 && this._shouldRecycle(nodes[i]); i++) {
      this._putInPool(nodes[i]);
      this._removeFromActive(nodes[i], i);
    }
    for (let i = nodes.length - 1; from == Recycler.START && i > 0 && this._shouldRecycle(nodes[i]); i--) {
      this._putInPool(nodes[i]);
      this._removeFromActive(nodes[i], i);
    }

    let poolSize = nextIncrement;
    let node;

    while (poolSize > 0 && (node = this._popNodeFromPool(from) || this._allocateNode(from))) {
      this._pushToClient(node, from);
      poolSize--;
    }
    // read
    for (let i = 0; from == Recycler.START && i < nextIncrement; i++) {
      this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes, meta);
    }
    for (let i = nodes.length - 1; from == Recycler.END && i >= nodes.length - nextIncrement; i--) {
      this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes, meta);
    }
    // write
    for (let i = 0; from == Recycler.START && i < nextIncrement; i++) {
      this.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
    for (let i = nodes.length - 1; from == Recycler.END && i >= nodes.length - nextIncrement; i--) {
      this.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
  }

  shouldRecycle(node) {
    return false;
  }

  layout(node, idx, meta, from) {}

  makeActive(node, idx, meta, from) {}

  initMetaForIndex(idx) {
    return null;
  }

  isClientFull(nodes, metas, from) {
    return true;
  }

  hasEnoughContent(nodes, metas, from) {
    return true;
  }

  set size(size) {
    this._size = size;
  }

  get size() {
    return this._size;
  }

  _pushToClient(node, from) {
    const nodes = this._nodes;
    const parentContainer = this.parentContainer;
    from == Recycler.START ? nodes.unshift(node) : nodes.push(node);

    if (parentContainer && node.parentContainer !== parentContainer) {
      parentContainer.appendChild(node);
    }
  }

  _putInPool(node) {
    let meta = this.meta.get(node);
    this.pool.push(meta.poolId, node);
  }

  _popNodeFromPool(from) {
    let idx, poolId;
    const nodes = this._nodes;

    if (nodes.length === 0) {
      poolId = this.poolIdForIndex(0);
    } else if (from == Recycler.START) {
      idx = this.meta.get(nodes[0]).idx - 1;
      poolId = idx >= 0 ? this.poolIdForIndex(idx) : null;
    } else {
      idx = this.meta.get(nodes[nodes.length - 1]).idx + 1;
      poolId = idx < this.size ? this.poolIdForIndex(idx) : null;
    }
    const node = this.pool.pop(poolId);
    if (node) {
      this.nodeForIndex(idx, node);
      this.meta.set(node, this.initMetaForIndex(idx, node));
    }
    return node;
  }

  _allocateNode(from) {
    let idx;
    const nodes = this._nodes;
    if (from == Recycler.START) {
      idx = this.meta.get(nodes[0]).idx;
      if (idx <= 0) {
        return null;
      }
    } else {
      idx = this.meta.get(nodes[nodes.length - 1]).idx;
      if (idx >= this.size - 1) {
        return null;
      }
    }
    const node = document.createElement('div');
    this.nodeForIndex(idx, node);
    this.meta.set(node, this.initMetaForIndex(idx, node));
    return node;
  }

  _removeFromActive(node, index) {
    this.meta.delete(node);
    this._nodes.splice(index, 1);
  }

  set pool(pool) {
    if (pool instanceof DomPool) {
      this._pool = pool;
    } else {
      throw new TypeError('Invalid pool type');
    }
  }

  get pool() {
    return this._pool;
  }

  set parentContainer(node) {
    this._parentContainer = node;
  }

  get parentContainer() {
    return this._parentContainer;
  }

  static get START() {
    return 1;
  }

  static get END() {
    return 2;
  }
}

function listViewStyles() {
  return {
    yScrollable: `
      overflow-y: auto;
      overflow-x: hidden;
    `,
    parentContainer: `
      position: relative;
    `,
    itemContainer: `
      position: absolute;
      top: 0px;
      will-change: transform;
    `
  };
}

class ListView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = this._getTemplate(listViewStyles());
    this._$scrollingElement = this.shadowRoot.getElementById('scrollingElement');
    this._$parentContainer = this.shadowRoot.getElementById('parentContainer');
    this._props = {};
    const recycler = new Recycler();
    recycler.pool = new DomPool();
    recycler.parentContainer = this._$parentContainer;
    recycler.initMetaForIndex = this._initMetaForIndex;
    recycler.shouldRecycle = this._shouldRecycle;
    recycler.layout = this._layout;
    recycler.makeActive = this._makeActive;
    this._recycler = recycler;
    this._setProps(['numberOfRows', 'domForRow']);
  }

  connectedCallback() {
    this._recycler.mount();
  }

  disconnectedCallback() {
    this._recycler.unmount();
  }

  set poolIdForRow(fn) {
    this._props['poolIdForRow'] = fn;
    this._recycler.poolIdForIndex = idx => {
      fn(idx);
    };
  }

  get poolIdForIndex() {
    return this._props['poolIdForRow'];
  }

  set domForRow(fn) {
    this._props['domForRow'] = fn;
    this._recycler.nodeForIndex = (idx, container) => {
      fn(idx, container);
    };
  }

  get domForRow() {
    return this._props['domForRow'];
  }

  set numberOfRows(size) {
    this._recycler.size = size;
  }

  get numberOfRows() {
    return this._recycler.size;
  }

  _initMetaForIndex(idx) {
    return {
      idx: 0,
      h: 0,
      y: 0
    };
  }

  _shouldRecycle(node, meta) {
    const se = this.scrollingElement();
    const clientHeight = this.clientHeight();

    return meta.y + meta.h < se.scrollTop - clientHeight || meta.y + meta.h > se.scrollTop + clientHeight * 2;
  }

  _layout(node, meta) {
    // Set initial styles.
    if (node.style.position != 'absolute') {
      node.style.position = 'absolute';
      node.style.top = '0px';
      node.style.willChange = 'transform';
    }
    transform(node, `translateY(${ meta.y }px)`);
  }

  _makeActive(node, meta, idx, from, nodes, metas) {
    meta.h = node.offsetHeight;

    if (from == Recycler.START && idx + 1 < nodes.length) {
      let nextM = metas.get(nodes[idx + 1]);
      meta.y = nextM.y - meta.h;
    } else if (from == Recycler.END && idx > 0) {
      let prevM = metas.get(nodes[idx - 1]);
      meta.y = prevM.y + prevM.h;
    } else {
      meta.y = 0;
    }
  }

  _getTemplate(styles) {
    return `<div id="scrollingElement" style="${ styles.yScrollable }">
      <div id="parentContainer" style="${ styles.parentContainer }">
        <slot></slot>
      </div>
    </div>`;
  }

  _setProps(props) {
    props.forEach(prop => {
      if (this.hasOwnProperty(prop)) {
        let propVal = this[prop];
        delete this[prop];
        this[prop] = propVal;
      }
    });
  }
}

customElements.define('list-view', ListView);

return ListView;

})));
