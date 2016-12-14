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
    w.requestIdleCallback ? w.requestIdleCallback(resolve) : w.setTimeout(resolve.bind(null, {
      timeRemaining() {
        return 50;
      }
    }), 16);
  });
}

function forBeforePaint() {
  return new Promise(function (resolve) {
    window.requestAnimationFrame(resolve);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

  get mounted() {
    return this._isMounted;
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
        // Schedule onscreen work.
        while (!_this5.isClientFull(_this5._nodes, _this5.meta, from)) {
          let now = performance.now();
          nextIncrement = _this5._populateClient(from, nextIncrement);
          if (nextIncrement === 0) {
            break;
          }
          _this5._unitCost = (performance.now() - now) / nextIncrement;
          nextIncrement = nextIncrement * 2;
        }
        // Schedule offscreen work.
        if (nextIncrement > 0 && !_this5.hasEnoughContent(_this5._nodes, _this5.meta, from)) {
          return Promise.resolve().then(function () {
            return forIdleTime();
          }).then(function (_resp) {
            let idle = _resp;
            nextIncrement = clamp(~~(idle.timeRemaining() / _this5._unitCost), 1, nextIncrement);
            return _this5._recycle(from, _this5._populateClient(from, nextIncrement) * 2, jobId);
          });
        }
      }
    }).then(function () {});
  }

  _putNodesInPool(nodes) {
    Array.from(nodes).forEach(node => this._putInPool(node));
  }

  _putInPool(node) {
    if (!node.dataset.poolId) {
      node.dataset.poolId = 0;
    }
    this.pool.push(node.dataset.poolId, node);
  }

  _shouldRecycle(node) {
    return this.shouldRecycle(node, this.meta.get(node));
  }

  _populateClient(from, nextIncrement) {
    const nodes = this._nodes;
    const meta = this.meta;
    while (from == Recycler.END && nodes.length > 0 && this._shouldRecycle(nodes[0])) {
      this._putInPool(nodes[0]);
      this._removeFromActive(nodes[0], 0);
    }
    while (from == Recycler.START && nodes.length > 0 && this._shouldRecycle(nodes[nodes.length - 1])) {
      this._putInPool(nodes[nodes.length - 1]);
      this._removeFromActive(nodes[nodes.length - 1], nodes.length - 1);
    }

    let poolIncrease = 0;
    let node;
    while (poolIncrease <= nextIncrement && (node = this._popNodeFromPool(from) || this._allocateNode(from))) {
      this._pushToClient(node, from);
      poolIncrease++;
    }
    // read
    for (let i = poolIncrease - 1; from == Recycler.START && i >= 0; i--) {
      this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes, meta);
    }
    for (let i = nodes.length - poolIncrease; from == Recycler.END && i < nodes.length; i++) {
      this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes, meta);
    }
    // write
    for (let i = poolIncrease - 1; from == Recycler.START && i >= 0; i--) {
      this.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
    for (let i = nodes.length - poolIncrease; from == Recycler.END && i < nodes.length; i++) {
      this.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
    return poolIncrease;
  }

  _pushToClient(node, from) {
    const nodes = this._nodes;
    const parentContainer = this.parentContainer;
    from == Recycler.START ? nodes.unshift(node) : nodes.push(node);

    if (parentContainer && node.parentContainer !== parentContainer) {
      parentContainer.appendChild(node);
    }
  }

  _popNodeFromPool(from) {
    let idx, poolId;
    const nodes = this._nodes;

    if (nodes.length === 0) {
      idx = 0;
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
    if (nodes.length == 0) {
      idx = 0;
    } else if (from == Recycler.START) {
      idx = this.meta.get(nodes[0]).idx - 1;
    } else {
      idx = this.meta.get(nodes[nodes.length - 1]).idx + 1;
    }
    if (idx < 0 || idx >= this.size) {
      return null;
    }
    const node = document.createElement('div');
    node.dataset.poolId = this.poolIdForIndex(idx);
    this.nodeForIndex(idx, node);
    this.meta.set(node, this.initMetaForIndex(idx, node));
    return node;
  }

  _removeFromActive(node, index) {
    this.meta.delete(node);
    this._nodes.splice(index, 1);
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

  poolIdForIndex(idx) {
    return 0;
  }

  set size(size) {
    this._size = size;
  }

  get size() {
    return this._size;
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
    this._sumHeights = 0;
    this._sumNodes = 0;
    // Create recyler context.
    const recycler = new Recycler();
    // Set the DOM pool for the context.
    recycler.pool = new DomPool();
    recycler.parentContainer = this;
    recycler.initMetaForIndex = this._initMetaForIndex;
    recycler.shouldRecycle = this._shouldRecycle.bind(this);
    recycler.isClientFull = this._isClientFull.bind(this);
    recycler.hasEnoughContent = this._hasEnoughContent.bind(this);
    recycler.poolIdForIndex = this._poolIdForIndex;
    recycler.layout = this._layout;
    recycler.makeActive = this._makeActive.bind(this);
    this._recycler = recycler;
    this._setProps(['numberOfRows', 'domForRow', 'heightForRow', 'scrollingElement']);
  }

  connectedCallback() {
    this._refresh();
  }

  _refresh() {
    var _this = this;

    return Promise.resolve().then(function () {
      if (!_this._recycler.mounted) {
        return _this._recycler.mount();
      } else {
        return _this._recycler.recycle();
      }
    }).then(function () {
      _this._$parentContainer.style.height = _this._heightMean * _this.numberOfRows + 'px';
    });
  }

  disconnectedCallback() {
    this._recycler.unmount();
  }

  set poolIdForRow(fn) {
    this._recycler.poolIdForIndex = fn;
  }

  get poolIdForIndex() {
    return this._recycler.poolIdForIndex;
  }

  set domForRow(fn) {
    this._props.domForRow = fn;
    this._recycler.nodeForIndex = (idx, container) => {
      fn(idx, container);
    };
  }

  get domForRow() {
    return this._props.domForRow;
  }

  set numberOfRows(size) {
    this._recycler.size = size;
  }

  get numberOfRows() {
    return this._recycler.size;
  }

  get heightForRow() {
    return this._props.heightForRow;
  }

  set heightForRow(fn) {
    this._props.heightForRow = fn;
  }

  get scrollingElement() {
    return this._props.scrollingElement || this;
  }

  set scrollingElement(se) {
    this._props.scrollingElement = se;
    this._$scrollingElement.style.cssText = se === this ? listViewStyles().yScrollable : '';
  }

  get _heightMean() {
    return this._sumNodes === 0 ? 0 : this._sumHeights / this._sumNodes;
  }

  _canFitExtra(t, nodes, metas, from) {
    if (nodes.length == 0) {
      return false;
    }
    const se = this.scrollingElement;
    const win = se.scrollTop + se.clientHeight * t;
    if (from == Recycler.START && metas.get(nodes[0]).y <= win) {
      return true;
    }
    if (from == Recycler.END && metas.get(nodes[nodes.length - 1]).y >= win + se.clientHeight) {
      return true;
    }
    return false;
  }

  _isClientFull(nodes, metas, from) {
    return this._canFitExtra(0, nodes, metas, from);
  }

  _hasEnoughContent(nodes, metas, from) {
    return this._canFitExtra(0.5, nodes, metas, from);
  }

  _poolIdForIndex(idx) {
    return 0;
  }

  _initMetaForIndex(idx) {
    return {
      idx: idx,
      h: 0,
      y: 0
    };
  }

  _shouldRecycle(node, meta) {
    const se = this.scrollingElement;
    const clientHeight = se.clientHeight;
    return meta.y + meta.h < se.scrollTop - clientHeight || meta.y + meta.h > se.scrollTop + clientHeight * 1.5;
  }

  _layout(node, meta) {
    // Set initial styles.
    if (node.style.position != 'absolute') {
      node.style.position = 'absolute';
      node.style.top = '0px';
      node.style.willChange = 'transform';
    }
    node.style.transform = `translateY(${ meta.y }px)`;
  }

  _makeActive(node, meta, idx, from, nodes, metas) {
    meta.h = this._props.heightForRow ? this._props.heightForRow(meta.idx, node) : node.offsetHeight;
    // Keep track of the heights to estimate the mean.
    this._sumHeights = this._sumHeights + meta.h;
    this._sumNodes = this._sumNodes + 1;

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
