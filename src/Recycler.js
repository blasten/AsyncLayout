import DomPool from './DomPool';
import {forIdleTime, forBeforePaint} from './Async';

export default class Recycler {
  constructor() {
    this._pool = null;
    this._jobId = 0;
    this._nodes = [];
    this._isMounted  = false;
    this.meta = new WeekMap();
  }

  async mount() {
    await forBeforePaint();
    this._isMounted = true;
    this.putNodesInPool(this.parentContainer.children);
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
    while (!this._isClientFull(from)) {
      this._populateClient(from, nextIncrement);
      nextIncrement = nextIncrement * 2;
    }
    if (!this._hasEnoughContent(from)) {
      let idle = await forIdleTime();
      this._populateClient(from, nextIncrement);
      await this._recycle(from, nextIncrement * 2, jobId);
    }
  }

  putNodesInPool(nodes) {
    Array.from(nodes).forEach(node => {
      this._pool.push(node.dataset.poolId || 0, node);
    });
  }

  _shouldRecycle(node) {
    return this.shouldRecycle(node, meta.get(node));
  }

  _populateClient(from, nextIncrement) {
    const nodes = this._nodes;
    const meta = this.meta;

    for (
      let i = 0;
      from == Recycler.END && i < nodes.length-1 && this._shouldRecycle(nodes[i]);
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

    let poolSize = nextIncrement;
    let node;

    while (
      poolSize > 0 &&
      (node = this._popNodeFromPool(from) || this._allocateNode(from))
    ) {
      this._pushToClient(node, from);
      poolSize--;
    }
    // read
    for (
      let i = 0;
      from == Recycler.START && i < nextIncrement;
      i++
    ) {
      this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes, meta);
    }
    for (
      let i = nodes.length - 1;
      from == Recycler.END && i >= nodes.length - nextIncrement;
      i--
    ) {
      this.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes,meta);
    }
    // write
    for (
      let i = 0;
      from == Recycler.START && i < nextIncrement;
      i++
    ) {
      this.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
    for (
      let i = nodes.length - 1;
      from == Recycler.END && i >= nodes.length - nextIncrement;
      i--
    ) {
      this.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
  }

  shouldRecycle(node) {
  }

  layout(node, idx, meta, from) {
  }

  makeActive(node, idx, meta, from) {
  }

  initMetaForIndex(idx) {
    return null;
  }

  get size() {
    return 0;
  }

  get parentContainer() {
    return null;
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
    this._pool.push(meta.poolId, node);
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
    const node = this._pool.pop(poolId);
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
    }
    else {
      idx = this.meta.get(nodes[nodes.length-1]).idx;
      if (idx >= this.size-1) {
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
    }
    else {
      throw new TypeError('Invalid pool type')
    }
  }

  get pool() {
    return this._pool;
  }

  static get START() {
    return 1;
  }

  static get END() {
    return 2;
  }
}
