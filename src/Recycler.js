import { forIdleTime, forBeforePaint } from './Async';
import { invariant, clamp } from './utils';
import DomPool from './DomPool';

export default class Recycler {
  constructor(container, pool) {
    invariant(pool instanceof DomPool, 'Invalid pool type');
    this._container = container;
    this._size = 0;
    this._pool = pool;
    this._jobId = 0;
    this._nodes = [];
  }

  async recycle() {
    this._jobId++;
    if (this._nodes.length > 0) {
      await this._recycle(Recycler.START, 1, this._jobId);
    }
    await this._recycle(Recycler.END, 1, this._jobId);
  }

  async _recycle(from, increment, jobId) {
    if (this._jobId != jobId) {
      return;
    }
    var x = 0;
    // Schedule onscreen work.
    while (!this.isClientFull(this.startMeta, this.endMeta, from)) {
      let now = performance.now();
      if ((increment = this._populateClient(from, increment)) === 0) {
        break;
      }
      this._unitCost = (performance.now() - now) / increment;
      if (++x > 100) {
        console.error('inf');
        break;
      }
      //increment = ~~(increment*1.5);
    }
    // Schedule offscreen work.
    // if (increment > 0 && !this.hasEnoughContent(this.startMeta, this.endMeta, from)) {
    //   let idle = await forIdleTime();
    //   increment = clamp(~~(idle.timeRemaining() / this._unitCost), 1, this._nodes.length);
    //   await this._recycle(from, this._populateClient(from, increment) * 2, jobId);
    // }
  }

  enqueuePrerendered() {
    Array.from(this._container.children)
      .filter(node => !this._pool.meta.has(node))
      .forEach(node => this._putInPool(node));
  }

  enqueueRendered() {
    this._nodes.forEach(node => this._putInPool(node));
    this._nodes = [];
  }

  _putInPool(node) {
    if (!node.dataset.poolId) {
      node.dataset.poolId = 0;
    }
    // Hide the node.
    node.style.display = 'none';
    this._pool.push(node.dataset.poolId, node);
  }

  _shouldRecycle(node) {
    return this.shouldRecycle(node, this._pool.meta.get(node));
  }

  _populateClient(from, nextIncrement) {
    const nodes = this._nodes;
    const metas = this._pool.meta;
    // Enqueue node available for recycling.
    while (
      from == Recycler.END &&
      nodes.length > 0 &&
      this._shouldRecycle(nodes[0])
    ) {
      this._putInPool(nodes[0]);
      nodes.shift();
    }
    while (
      from == Recycler.START &&
      nodes.length > 0 &&
      this._shouldRecycle(nodes[nodes.length - 1])
    ) {
      this._putInPool(nodes[nodes.length - 1]);
      nodes.pop();
    }
    // Dequeue node or allocate a new one.
    let updates = 0;
    let node;
    while (
      updates < nextIncrement &&
      (node = this._popNodeFromPool(from) || this._allocateNode(from))
    ) {
      this._pushToClient(node, from);
      updates++;
    }
    // Read.
    for (
      let i = updates - 1;
      from == Recycler.START && i >= 0;
      i--
    ) {
      this.makeActive(nodes[i], metas.get(nodes[i]), nodes, metas, i, from);
    }
    for (
      let i = nodes.length - updates;
      from == Recycler.END && i < nodes.length;
      i++
    ) {
      this.makeActive(nodes[i], metas.get(nodes[i]), nodes, metas, i, from);
    }
    // Write.
    for (
      let i = updates - 1;
      from == Recycler.START && i >= 0;
      i--
    ) {
      this.layout(nodes[i], metas.get(nodes[i]), nodes, metas, i, from);
    }
    for (
      let i = nodes.length - updates;
      from == Recycler.END && i < nodes.length;
      i++
    ) {
      this.layout(nodes[i], metas.get(nodes[i]), nodes, metas, i, from);
    }
    return updates;
  }

  _pushToClient(node, from) {
    const nodes = this._nodes;
    const container = this._container;
    from == Recycler.START ? nodes.unshift(node) : nodes.push(node);

    if (node.parentNode !== undefined && node.parentNode !== container) {
      container.appendChild(node);
    }
  }

  _popNodeFromPool(from) {
    let idx, poolId;
    const nodes = this._nodes;
    const metas = this._pool.meta;

    if (nodes.length === 0) {
      idx = this.initIndex();
      poolId = this.poolIdForIndex(idx);
    }
    else if (from == Recycler.START) {
      idx = metas.get(this.startNode).idx - 1;
      poolId = idx >= 0 ? this.poolIdForIndex(idx) : null;
    }
    else {
      idx = metas.get(this.endNode).idx + 1;
      poolId = idx < this.size() ? this.poolIdForIndex(idx) : null;
    }
    const node = Recycler.START ? this._pool.shift(poolId) : this._pool.pop(poolId);
    if (node) {
      const metaForNode = metas.hasIndex(idx) ?
          metas.getByIndex(idx) :
          metas.setByIndex(Object.assign({ idx: idx }, this.initMetaForIndex(idx)));
      metas.set(node, metaForNode);
      this.nodeForIndex(idx, node, metaForNode);
    }
    return node;
  }

  _allocateNode(from) {
    let idx;
    const nodes = this._nodes;
    const metas = this._pool.meta;

    if (nodes.length == 0) {
      idx = this.initIndex();
    }
    else if (from == Recycler.START) {
      idx = metas.get(this.startNode).idx - 1;
    }
    else {
      idx = metas.get(this.endNode).idx + 1;
    }
    if (idx < 0 || idx >= this.size()) {
      return;
    }
    const node = this.createNodeContainer();
    invariant(node.dataset && node.style, 'invalid node container');
    node.dataset.poolId = this.poolIdForIndex(idx);
    const metaForNode = metas.hasIndex(idx) ?
        metas.getByIndex(idx) :
        metas.setByIndex(Object.assign({ idx: idx }, this.initMetaForIndex(idx)));
    metas.set(node, metaForNode);
    this.nodeForIndex(idx, node, metaForNode);
    return node;
  }

  createNodeContainer() {
    return null;
  }

  shouldRecycle(node, meta) {
    return true;
  }

  isClientFull(startMeta, endMeta, from) {
    return true;
  }

  hasEnoughContent(startMeta, endMeta, from) {
    return true;
  }

  size() {
    return 0;
  }

  layout(node, meta, nodes, metas) {

  }

  makeActive(node, meta, nodes, metas, idx, from) {

  }

  nodeForIndex(idx, node, meta) {

  }

  poolIdForIndex(idx) {
    return 0;
  }

  initMetaForIndex(idx) {
    return { idx: idx };
  }

  initIndex() {
    return 0;
  }

  get startNode() {
    return this._nodes[0];
  }

  get endNode() {
    return this._nodes[this._nodes.length - 1];
  }

  get startMeta() {
    return this._pool.meta.get(this.startNode) || {};
  }

  get endMeta() {
    return this._pool.meta.get(this.endNode) || {};
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
