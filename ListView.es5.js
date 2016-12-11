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
    w.requestIdleCallback ? w.requestIdleCallback(resolve) : w.setTimeout(resolve, 16);
  });
}

function forBeforePaint() {
  return new _Promise(function (resolve) {
    window.requestAnimationFrame(resolve);
  });
}

var Recycler = function () {
  function Recycler() {
    classCallCheck(this, Recycler);

    this._pool = null;
    this._jobId = 0;
    this._nodes = [];
    this._isMounted = false;
    this.meta = new WeekMap();
  }

  createClass(Recycler, [{
    key: 'mount',
    value: function mount() {
      var _this2 = this;

      return Promise.resolve().then(function () {
        return forBeforePaint();
      }).then(function () {
        _this2._isMounted = true;
        _this2.putNodesInPool(_this2.parentElement.children);
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
      var idle,
          _this6 = this;

      return Promise.resolve().then(function () {
        if (!(_this6._jobId != jobId)) {
          while (!_this6._isClientFull(from)) {
            _this6._populateClient(from, nextIncrement);
            nextIncrement = nextIncrement * 2;
          }
          if (!_this6._hasEnoughContent(from)) {
            return Promise.resolve().then(function () {
              return forIdleTime();
            }).then(function (_resp) {
              idle = _resp;

              _this6._populateClient(from, nextIncrement);
              return _this6._recycle(from, nextIncrement * 2, jobId);
            });
          }
        }
      }).then(function () {});
    }
  }, {
    key: 'putNodesInPool',
    value: function putNodesInPool(nodes) {
      var _this = this;

      Array.from(nodes).forEach(function (node) {
        _this._pool.push(node.dataset.poolId || 0, node);
      });
    }
  }, {
    key: '_shouldRecycle',
    value: function _shouldRecycle(node) {
      return this.shouldRecycle(node, meta.get(node));
    }
  }, {
    key: '_populateClient',
    value: function _populateClient(from, nextIncrement) {
      var nodes = this._nodes;
      var meta = this.meta;

      for (var i = 0; from == Recycler.END && i < nodes.length - 1 && this._shouldRecycle(nodes[i]); i++) {
        this._putInPool(nodes[i]);
        this._removeFromActive(nodes[i], i);
      }
      for (var _i = nodes.length - 1; from == Recycler.START && _i > 0 && this._shouldRecycle(nodes[_i]); _i--) {
        this._putInPool(nodes[_i]);
        this._removeFromActive(nodes[_i], _i);
      }

      var poolSize = nextIncrement;
      var node = void 0;

      while (poolSize > 0 && (node = this._popNodeFromPool(from) || this._allocateNode(from))) {
        this._pushToClient(node, from);
        poolSize--;
      }
      // read
      for (var _i2 = 0; from == Recycler.START && _i2 < nextIncrement; _i2++) {
        this.makeActive(nodes[_i2], meta.get(nodes[_i2]), _i2, from, nodes, meta);
      }
      for (var _i3 = nodes.length - 1; from == Recycler.END && _i3 >= nodes.length - nextIncrement; _i3--) {
        this.makeActive(nodes[_i3], meta.get(nodes[_i3]), _i3, from, nodes, meta);
      }
      // write
      for (var _i4 = 0; from == Recycler.START && _i4 < nextIncrement; _i4++) {
        this.layout(nodes[_i4], meta.get(nodes[_i4]), _i4, from);
      }
      for (var _i5 = nodes.length - 1; from == Recycler.END && _i5 >= nodes.length - nextIncrement; _i5--) {
        this.layout(nodes[_i5], meta.get(nodes[_i5]), _i5, from);
      }
    }
  }, {
    key: 'shouldRecycle',
    value: function shouldRecycle(node) {}
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
    key: '_pushToClient',
    value: function _pushToClient(node, from) {
      var nodes = this._nodes;
      var parentElement = this.parentElement;
      from == Recycler.START ? nodes.unshift(node) : nodes.push(node);

      if (parentElement && node.parentElement !== parentElement) {
        parentElement.appendChild(node);
      }
    }
  }, {
    key: '_putInPool',
    value: function _putInPool(node) {
      var meta = this.meta.get(node);
      this._pool.push(meta.poolId, node);
    }
  }, {
    key: '_popNodeFromPool',
    value: function _popNodeFromPool(from) {
      var idx = void 0,
          poolId = void 0;
      var nodes = this._nodes;

      if (nodes.length === 0) {
        poolId = this.poolIdForIndex(0);
      } else if (from == Recycler.START) {
        idx = this.meta.get(nodes[0]).idx - 1;
        poolId = idx >= 0 ? this.poolIdForIndex(idx) : null;
      } else {
        idx = this.meta.get(nodes[nodes.length - 1]).idx + 1;
        poolId = idx < this.size ? this.poolIdForIndex(idx) : null;
      }
      var node = this._pool.pop(poolId);
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
      var node = document.createElement('div');
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
    key: 'size',
    get: function get() {
      return 0;
    }
  }, {
    key: 'parentElement',
    get: function get() {
      return null;
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

var styles = {
  classes: "\n\n  "
};

var ListView = function (_HTMLElement) {
  inherits(ListView, _HTMLElement);

  function ListView() {
    classCallCheck(this, ListView);

    var _this = possibleConstructorReturn(this, (ListView.__proto__ || Object.getPrototypeOf(ListView)).call(this));

    _this._props = {};
    var r = new Recycler();

    _this.attachShadow({ mode: 'open' }).innerHTML = '\n      <style>\n        :host {\n          display: block;\n        }\n        ' + styles.classes + '\n      </style>\n      <div id="scrollingElement">\n        <div id="parentElement">\n          <slot></slot>\n        </div>\n      </div>';

    _this._$scrollingElement = _this.shadowRoot.getElementById('scrollingElement');
    _this._$parentElement = _this.shadowRoot.getElementById('contentElement');
    r.pool = new DomPool();
    r.parentElement = _this._$parentElement;
    r.initMetaForIndex = _this._initMetaForIndex;
    r.shouldRecycle = _this._shouldRecycle;
    r.layout = _this._layout;
    r.makeActive = _this._makeActive;
    _this._recycler = r;
    return _this;
  }

  createClass(ListView, [{
    key: 'connectedCallback',
    value: function connectedCallback() {
      this._recycler.mount();
    }
  }, {
    key: 'disconnectedCallback',
    value: function disconnectedCallback() {
      this._recycler.unmount();
    }
  }, {
    key: '_initMetaForIndex',
    value: function _initMetaForIndex(idx) {
      return {
        idx: 0,
        h: 0,
        y: 0
      };
    }
  }, {
    key: '_shouldRecycle',
    value: function _shouldRecycle(node, meta) {
      var se = this.scrollingElement();
      var clientHeight = this.clientHeight();

      return meta.y + meta.h < se.scrollTop - clientHeight || meta.y + meta.h > se.scrollTop + clientHeight * 2;
    }
  }, {
    key: '_layout',
    value: function _layout(node, meta) {
      transform(node, 'translateY(' + meta.y + 'px)');
    }
  }, {
    key: '_makeActive',
    value: function _makeActive(node, meta, idx, from, nodes, metas) {
      meta.h = node.offsetHeight;

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
    key: 'poolIdForRow',
    set: function set(fn) {
      this._props['poolIdForRow'] = fn;
      this._recycler.poolIdForIndex = function (idx) {
        fn(idx);
      };
    }
  }, {
    key: 'poolIdForIndex',
    get: function get() {
      return this._props['poolIdForRow'];
    }
  }, {
    key: 'domForRow',
    set: function set(fn) {
      this._props['domForRow'] = fn;
      this._recycler.nodeForIndex = function (idx, container) {
        fn(idx, container);
      };
    },
    get: function get() {
      return this._props['domForRow'];
    }
  }, {
    key: 'numberOfRows',
    set: function set(size) {
      this._recycler.size = size;
    },
    get: function get() {
      return this._recycler.size;
    }
  }]);
  return ListView;
}(HTMLElement);

customElements.define('list-view', ListView);

return ListView;

})));
