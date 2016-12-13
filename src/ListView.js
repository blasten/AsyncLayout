import Recycler from './Recycler';
import DomPool from './DomPool';
import styles from './list-view-styles';

export default class ListView extends HTMLElement {
  constructor() {
      super();
    this._props = {};
    const r = new Recycler();

    this.attachShadow({mode: 'open'})
      .innerHTML = `
      <div id="scrollingElement" style="${styles.yScrollable}">
        <div id="parentContainer" style="${styles.parentContainer}">
          <slot></slot>
        </div>
      </div>`;

    this._$scrollingElement = this.shadowRoot.getElementById('scrollingElement');
    this._$parentContainer = this.shadowRoot.getElementById('parentContainer');
    r.pool = new DomPool();
    r.parentElement = this._$parentContainer;
    r.initMetaForIndex = this._initMetaForIndex;
    r.shouldRecycle = this._shouldRecycle;
    r.layout = this._layout;
    r.makeActive = this._makeActive;
    this._recycler = r;
  }

  connectedCallback() {
    this._recycler.mount();
  }

  disconnectedCallback() {
    this._recycler.unmount();
  }

  set poolIdForRow(fn) {
    this._props['poolIdForRow'] = fn;
    this._recycler.poolIdForIndex = (idx) => {
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

    return meta.y + meta.h < se.scrollTop - clientHeight ||
      meta.y + meta.h > se.scrollTop + clientHeight * 2;
  }

  _layout(node, meta) {
    // Set initial styles.
    if (node.style.position != 'absolute') {
      node.style.position = 'absolute';
      node.style.top = '0px';
      node.style.willChange = 'transform';
    }
    transform(node, `translateY(${meta.y}px)`);
  }

  _makeActive(node, meta, idx, from, nodes, metas) {
    meta.h = node.offsetHeight;

    if (from == Recycler.START && idx + 1 < nodes.length) {
      let nextM = metas.get(nodes[idx + 1]);
      meta.y = nextM.y - meta.h;
    }
    else if (from == Recycler.END && idx > 0) {
      let prevM = metas.get(nodes[idx - 1]);
      meta.y = prevM.y + prevM.h;
    }
    else {
      meta.y = 0;
    }
  }
}

customElements.define('list-view', ListView);
