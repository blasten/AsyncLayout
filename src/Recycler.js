import DomPool from './DomPool';
import {forIdleTime, forBeforePaint} from './Async';

export default class Recycler {
  constructor() {
    this._size = 0;
    this._pool = null;
    this._parentContainer = null;
    this._jobId = 0;
    this._nodes = [];
    this._isMounted  = false;
    this.meta = new WeakMap();
  }

  async mount() {
    await forBeforePaint();
    this._isMounted = true;
    this._putNodesInPool(this.parentContainer.children);
    await this.recycle();
  }

  async recycle() {
    if (!this._isMounted) {
      return;
    }
    this._jobId++;
    await this._recycle(Recycler.START, 1, this._jobId);
    await this._recycle(Recycler.END, 1, this._jobId);
  }

  async _recycle(from, nextIncrement, jobId) {
    if (this._jobId != jobId) {
      return;
    }
    while (nextIncrement > 0 && !this.isClientFull(this._nodes, this._metas, from)) {
      nextIncrement = this._populateClient(from, nextIncrement) * 2;
    }
    if (nextIncrement > 0 && !this.hasEnoughContent(this._nodes, this._metas, from)) {
      let idle = await forIdleTime();
      await this._recycle(from, this._populateClient(from, nextIncrement) * 2, jobId);
    }
  }

  _putNodesInPool(nodes) {
    Array.from(nodes).forEach(node => {
      this.pool.push(node.dataset.poolId || 0, node);
    });
  }

  _shouldRecycle(node) {
    return this.shouldRecycle(node, this.meta.get(node));
  }

  _populateClient(from, nextIncrement) {
    const nodes = this._nodes;
    const meta = this.meta;
    for (
      let i = 0;
      from == Recycler.END && i < nodes.length - 1 && this._shouldRecycle(nodes[i]);
      i++
    ) {
      this._putInPool(nodes[i]);
      this._removeFromActive(nodes[i], i);
    }
    for (
      let i = nodes.length - 1;
      from == Recycler.START && i > 0 && this._shouldRecycle(nodes[i]);
      i--
    ) {
      this._putInPool(nodes[i]);
      this._removeFromActive(nodes[i], i);
    }

    let poolIncrease = 0;
    let node;
    while (
      poolIncrease <= nextIncrement &&
      (node = this._popNodeFromPool(from) || this._allocateNode(from))
    ) {
      this._pushToClient(node, from);
      poolIncrease++;
    }
    // read
    for (
      let i = poolIncrease - 1;
      from == Recycler.START && i >= 0;
      i--
    ) {
      this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes,meta);
    }
    for (
      let i = nodes.length - poolIncrease;
      from == Recycler.END && i < nodes.length;
      i++
    ) {
      this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes, meta);
    }
    // write
    for (
      let i = poolIncrease - 1;
      from == Recycler.START && i >= 0;
      i--
    ) {
      this.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
    for (
      let i = nodes.length - poolIncrease;
      from == Recycler.END && i < nodes.length;
      i++
    ) {
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

  _putInPool(node) {
    let meta = this.meta.get(node);
    this.pool.push(meta.poolId, node);
  }

  _popNodeFromPool(from) {
    let idx, poolId;
    const nodes = this._nodes;

    if (nodes.length === 0) {
      poolId = this.poolIdForIndex(0);
    }
    else if (from == Recycler.START) {
      idx = this.meta.get(nodes[0]).idx - 1;
      poolId = idx >= 0 ? this.poolIdForIndex(idx) : null;
    }
    else {
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
    }
    else if (from == Recycler.START) {
      idx = this.meta.get(nodes[0]).idx-1;
    }
    else {
      idx = this.meta.get(nodes[nodes.length-1]).idx+1;
    }
    if (idx < 0 || idx >= this.size) {
      return null;
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

  shouldRecycle(node) {
    return false;
  }

  layout(node, idx, meta, from) {
  }

  makeActive(node, idx, meta, from) {
  }

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
    }
    else {
      throw new TypeError('Invalid pool type')
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