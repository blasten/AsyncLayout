(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.ListView = factory());
}(this, (function () { 'use strict';

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var get$1 = function get$1(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get$1(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};



var set$1 = function set$1(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set$1(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

var DomPool = function () {
  function DomPool() {
    classCallCheck(this, DomPool);

    this._pools = {};
  }

  createClass(DomPool, [{
    key: "push",
    value: function push(poolId, obj) {
      if (!this._pools[poolId]) {
        this._pools[poolId] = [];
      }
      this._pools[poolId].push(obj);
    }
  }, {
    key: "pop",
    value: function pop(poolId) {
      if (!this._pools[poolId]) {
        return null;
      }
      return this._pools[poolId].pop() || null;
    }
  }]);
  return DomPool;
}();

var _Promise = typeof Promise === 'undefined' ? require('es6-promise').Promise : Promise;

function forIdleTime() {
  return new _Promise(function (resolve) {
    var w = window;
    w.requestIdleCallback ? w.requestIdleCallback(resolve) : w.setTimeout(resolve.bind(null, {
      timeRemaining: function timeRemaining() {
        return 50;
      }
    }), 16);
  });
}

function forBeforePaint() {
  return new _Promise(function (resolve) {
    window.requestAnimationFrame(resolve);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

var Recycler = function () {
  function Recycler() {
    classCallCheck(this, Recycler);

    this._size = 0;
    this._pool = null;
    this._parentContainer = null;
    this._jobId = 0;
    this._nodes = [];
    this._isMounted = false;
    this.meta = new WeakMap();
  }

  createClass(Recycler, [{
    key: 'mount',
    value: function mount() {
      var _this2 = this;

      return Promise.resolve().then(function () {
        return forBeforePaint();
      }).then(function () {
        _this2._isMounted = true;
        _this2._putNodesInPool(_this2.parentContainer.children);
        return _this2.recycle();
      }).then(function () {});
    }
  }, {
    key: 'recycle',
    value: function recycle() {
      var _this3 = this;

      return Promise.resolve().then(function () {
        if (!!_this3._isMounted) {
          return Promise.resolve().then(function () {
            _this3._jobId++;
            return _this3._recycle(Recycler.START, 1, _this3._jobId);
          }).then(function () {
            return _this3._recycle(Recycler.END, 1, _this3._jobId);
          });
        }
      }).then(function () {});
    }
  }, {
    key: '_recycle',
    value: function _recycle(from, nextIncrement, jobId) {
      var now,
          idle,
          _this6 = this;

      return Promise.resolve().then(function () {
        if (!(_this6._jobId != jobId)) {
          // Schedule onscreen work.
          while (!_this6.isClientFull(_this6._nodes, _this6.meta, from)) {
            now = performance.now();

            nextIncrement = _this6._populateClient(from, nextIncrement);
            if (nextIncrement === 0) {
              break;
            }
            _this6._unitCost = (performance.now() - now) / nextIncrement;
            nextIncrement = nextIncrement * 2;
          }
          // Schedule offscreen work.
          if (nextIncrement > 0 && !_this6.hasEnoughContent(_this6._nodes, _this6.meta, from)) {
            return Promise.resolve().then(function () {
              return forIdleTime();
            }).then(function (_resp) {
              idle = _resp;

              nextIncrement = clamp(~~(idle.timeRemaining() / _this6._unitCost), 1, nextIncrement);
              return _this6._recycle(from, _this6._populateClient(from, nextIncrement) * 2, jobId);
            });
          }
        }
      }).then(function () {});
    }
  }, {
    key: '_putNodesInPool',
    value: function _putNodesInPool(nodes) {
      var _this = this;

      Array.from(nodes).forEach(function (node) {
        return _this._putInPool(node);
      });
    }
  }, {
    key: '_putInPool',
    value: function _putInPool(node) {
      if (!node.dataset.poolId) {
        node.dataset.poolId = 0;
      }
      this.pool.push(node.dataset.poolId, node);
    }
  }, {
    key: '_shouldRecycle',
    value: function _shouldRecycle(node) {
      return this.shouldRecycle(node, this.meta.get(node));
    }
  }, {
    key: '_populateClient',
    value: function _populateClient(from, nextIncrement) {
      var nodes = this._nodes;
      var meta = this.meta;
      while (from == Recycler.END && nodes.length > 0 && this._shouldRecycle(nodes[0])) {
        this._putInPool(nodes[0]);
        this._removeFromActive(nodes[0], 0);
      }
      while (from == Recycler.START && nodes.length > 0 && this._shouldRecycle(nodes[nodes.length - 1])) {
        this._putInPool(nodes[nodes.length - 1]);
        this._removeFromActive(nodes[nodes.length - 1], nodes.length - 1);
      }

      var poolIncrease = 0;
      var node = void 0;
      while (poolIncrease <= nextIncrement && (node = this._popNodeFromPool(from) || this._allocateNode(from))) {
        this._pushToClient(node, from);
        poolIncrease++;
      }
      // read
      for (var i = poolIncrease - 1; from == Recycler.START && i >= 0; i--) {
        this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes, meta);
      }
      for (var _i = nodes.length - poolIncrease; from == Recycler.END && _i < nodes.length; _i++) {
        this.makeActive(nodes[_i], meta.get(nodes[_i]), _i, from, nodes, meta);
      }
      // write
      for (var _i2 = poolIncrease - 1; from == Recycler.START && _i2 >= 0; _i2--) {
        this.layout(nodes[_i2], meta.get(nodes[_i2]), _i2, from);
      }
      for (var _i3 = nodes.length - poolIncrease; from == Recycler.END && _i3 < nodes.length; _i3++) {
        this.layout(nodes[_i3], meta.get(nodes[_i3]), _i3, from);
      }
      return poolIncrease;
    }
  }, {
    key: '_pushToClient',
    value: function _pushToClient(node, from) {
      var nodes = this._nodes;
      var parentContainer = this.parentContainer;
      from == Recycler.START ? nodes.unshift(node) : nodes.push(node);

      if (parentContainer && node.parentContainer !== parentContainer) {
        parentContainer.appendChild(node);
      }
    }
  }, {
    key: '_popNodeFromPool',
    value: function _popNodeFromPool(from) {
      var idx = void 0,
          poolId = void 0;
      var nodes = this._nodes;

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
      var node = this.pool.pop(poolId);
      if (node) {
        this.nodeForIndex(idx, node);
        this.meta.set(node, this.initMetaForIndex(idx, node));
      }
      return node;
    }
  }, {
    key: '_allocateNode',
    value: function _allocateNode(from) {
      var idx = void 0;
      var nodes = this._nodes;
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
      var node = document.createElement('div');
      node.dataset.poolId = this.poolIdForIndex(idx);
      this.nodeForIndex(idx, node);
      this.meta.set(node, this.initMetaForIndex(idx, node));
      return node;
    }
  }, {
    key: '_removeFromActive',
    value: function _removeFromActive(node, index) {
      this.meta.delete(node);
      this._nodes.splice(index, 1);
    }
  }, {
    key: 'shouldRecycle',
    value: function shouldRecycle(node) {
      return false;
    }
  }, {
    key: 'layout',
    value: function layout(node, idx, meta, from) {}
  }, {
    key: 'makeActive',
    value: function makeActive(node, idx, meta, from) {}
  }, {
    key: 'initMetaForIndex',
    value: function initMetaForIndex(idx) {
      return null;
    }
  }, {
    key: 'isClientFull',
    value: function isClientFull(nodes, metas, from) {
      return true;
    }
  }, {
    key: 'hasEnoughContent',
    value: function hasEnoughContent(nodes, metas, from) {
      return true;
    }
  }, {
    key: 'poolIdForIndex',
    value: function poolIdForIndex(idx) {
      return 0;
    }
  }, {
    key: 'mounted',
    get: function get() {
      return this._isMounted;
    }
  }, {
    key: 'size',
    set: function set(size) {
      this._size = size;
    },
    get: function get() {
      return this._size;
    }
  }, {
    key: 'pool',
    set: function set(pool) {
      if (pool instanceof DomPool) {
        this._pool = pool;
      } else {
        throw new TypeError('Invalid pool type');
      }
    },
    get: function get() {
      return this._pool;
    }
  }, {
    key: 'parentContainer',
    set: function set(node) {
      this._parentContainer = node;
    },
    get: function get() {
      return this._parentContainer;
    }
  }], [{
    key: 'START',
    get: function get() {
      return 1;
    }
  }, {
    key: 'END',
    get: function get() {
      return 2;
    }
  }]);
  return Recycler;
}();

function listViewStyles() {
  return {
    yScrollable: "\n      overflow-y: auto;\n      overflow-x: hidden;\n    ",
    parentContainer: "\n      position: relative;\n    ",
    itemContainer: "\n      position: absolute;\n      top: 0px;\n      will-change: transform;\n    "
  };
}

var ListView = function (_HTMLElement) {
  inherits(ListView, _HTMLElement);

  function ListView() {
    classCallCheck(this, ListView);

    var _this = possibleConstructorReturn(this, (ListView.__proto__ || Object.getPrototypeOf(ListView)).call(this));

    _this.attachShadow({ mode: 'open' }).innerHTML = _this._getTemplate(listViewStyles());
    _this._$scrollingElement = _this.shadowRoot.getElementById('scrollingElement');
    _this._$parentContainer = _this.shadowRoot.getElementById('parentContainer');
    _this._props = {};
    _this._sumHeights = 0;
    _this._sumNodes = 0;
    // Create recyler context.
    var recycler = new Recycler();
    // Set the DOM pool for the context.
    recycler.pool = new DomPool();
    recycler.parentContainer = _this;
    recycler.initMetaForIndex = _this._initMetaForIndex;
    recycler.shouldRecycle = _this._shouldRecycle.bind(_this);
    recycler.isClientFull = _this._isClientFull.bind(_this);
    recycler.hasEnoughContent = _this._hasEnoughContent.bind(_this);
    recycler.poolIdForIndex = _this._poolIdForIndex;
    recycler.layout = _this._layout;
    recycler.makeActive = _this._makeActive.bind(_this);
    _this._recycler = recycler;
    _this._setProps(['numberOfRows', 'domForRow', 'heightForRow', 'scrollingElement']);
    return _this;
  }

  createClass(ListView, [{
    key: 'connectedCallback',
    value: function connectedCallback() {
      this._refresh();
    }
  }, {
    key: '_refresh',
    value: function _refresh() {
      var _this3 = this;

      return Promise.resolve().then(function () {
        if (!_this3._recycler.mounted) {
          return _this3._recycler.mount();
        } else {
          return _this3._recycler.recycle();
        }
      }).then(function () {
        _this3._$parentContainer.style.height = _this3._heightMean * _this3.numberOfRows + 'px';
      });
    }
  }, {
    key: 'disconnectedCallback',
    value: function disconnectedCallback() {
      this._recycler.unmount();
    }
  }, {
    key: '_canFitExtra',
    value: function _canFitExtra(t, nodes, metas, from) {
      if (nodes.length == 0) {
        return false;
      }
      var se = this.scrollingElement;
      var win = se.scrollTop + se.clientHeight * t;
      if (from == Recycler.START && metas.get(nodes[0]).y <= win) {
        return true;
      }
      if (from == Recycler.END && metas.get(nodes[nodes.length - 1]).y >= win + se.clientHeight) {
        return true;
      }
      return false;
    }
  }, {
    key: '_isClientFull',
    value: function _isClientFull(nodes, metas, from) {
      return this._canFitExtra(0, nodes, metas, from);
    }
  }, {
    key: '_hasEnoughContent',
    value: function _hasEnoughContent(nodes, metas, from) {
      return this._canFitExtra(0.5, nodes, metas, from);
    }
  }, {
    key: '_poolIdForIndex',
    value: function _poolIdForIndex(idx) {
      return 0;
    }
  }, {
    key: '_initMetaForIndex',
    value: function _initMetaForIndex(idx) {
      return {
        idx: idx,
        h: 0,
        y: 0
      };
    }
  }, {
    key: '_shouldRecycle',
    value: function _shouldRecycle(node, meta) {
      var se = this.scrollingElement;
      var clientHeight = se.clientHeight;
      return meta.y + meta.h < se.scrollTop - clientHeight || meta.y + meta.h > se.scrollTop + clientHeight * 1.5;
    }
  }, {
    key: '_layout',
    value: function _layout(node, meta) {
      // Set initial styles.
      if (node.style.position != 'absolute') {
        node.style.position = 'absolute';
        node.style.top = '0px';
        node.style.willChange = 'transform';
      }
      node.style.transform = 'translateY(' + meta.y + 'px)';
    }
  }, {
    key: '_makeActive',
    value: function _makeActive(node, meta, idx, from, nodes, metas) {
      meta.h = this._props.heightForRow ? this._props.heightForRow(meta.idx, node) : node.offsetHeight;
      // Keep track of the heights to estimate the mean.
      this._sumHeights = this._sumHeights + meta.h;
      this._sumNodes = this._sumNodes + 1;

      if (from == Recycler.START && idx + 1 < nodes.length) {
        var nextM = metas.get(nodes[idx + 1]);
        meta.y = nextM.y - meta.h;
      } else if (from == Recycler.END && idx > 0) {
        var prevM = metas.get(nodes[idx - 1]);
        meta.y = prevM.y + prevM.h;
      } else {
        meta.y = 0;
      }
    }
  }, {
    key: '_getTemplate',
    value: function _getTemplate(styles) {
      return '<div id="scrollingElement" style="' + styles.yScrollable + '">\n      <div id="parentContainer" style="' + styles.parentContainer + '">\n        <slot></slot>\n      </div>\n    </div>';
    }
  }, {
    key: '_setProps',
    value: function _setProps(props) {
      var _this2 = this;

      props.forEach(function (prop) {
        if (_this2.hasOwnProperty(prop)) {
          var propVal = _this2[prop];
          delete _this2[prop];
          _this2[prop] = propVal;
        }
      });
    }
  }, {
    key: 'poolIdForRow',
    set: function set(fn) {
      this._recycler.poolIdForIndex = fn;
    }
  }, {
    key: 'poolIdForIndex',
    get: function get() {
      return this._recycler.poolIdForIndex;
    }
  }, {
    key: 'domForRow',
    set: function set(fn) {
      this._props.domForRow = fn;
      this._recycler.nodeForIndex = function (idx, container) {
        fn(idx, container);
      };
    },
    get: function get() {
      return this._props.domForRow;
    }
  }, {
    key: 'numberOfRows',
    set: function set(size) {
      this._recycler.size = size;
    },
    get: function get() {
      return this._recycler.size;
    }
  }, {
    key: 'heightForRow',
    get: function get() {
      return this._props.heightForRow;
    },
    set: function set(fn) {
      this._props.heightForRow = fn;
    }
  }, {
    key: 'scrollingElement',
    get: function get() {
      return this._props.scrollingElement || this;
    },
    set: function set(se) {
      this._props.scrollingElement = se;
      this._$scrollingElement.style.cssText = se === this ? listViewStyles().yScrollable : '';
    }
  }, {
    key: '_heightMean',
    get: function get() {
      return this._sumNodes === 0 ? 0 : this._sumHeights / this._sumNodes;
    }
  }]);
  return ListView;
}(HTMLElement);

customElements.define('list-view', ListView);

return ListView;

})));
