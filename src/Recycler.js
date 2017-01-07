import { forIdleTime } from './Async';
import { clamp, invariant } from './utils';
import DomPool from './DomPool';
import MetaStorage from './MetaStorage';

export default class Recycler {
  constructor(container, pool, meta) {
    invariant(pool instanceof DomPool, 'Invalid pool type');
    invariant(meta instanceof MetaStorage, 'Invalid meta storage');
    this._container = container;
    this._meta = meta;
    this._pool = pool;
    this._jobId = 0;
    this._size = 0;
    this._nodes = [];
    this._preservedNodes = {};
  }

  async recycle() {
    this._jobId++;
    if (this._nodes.length > 0) {
      await this._recycle(Recycler.START, 1, this._jobId);
    }
    await this._recycle(Recycler.END, 1, this._jobId);
    this._layoutPreservedNodes();
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
      //increment = increment * 2;
    }
    // Schedule offscreen work.
    // if (increment > 0 && !this.hasEnoughContent(this.startMeta, this.endMeta, from)) {
    //   let idle = await forIdleTime();
    //   increment = clamp(~~(idle.timeRemaining() / this._unitCost), 1, this._nodes.length);
    //   await this._recycle(from, this._populateClient(from, increment) * 2, jobId);
    // }
  }

  enqueuePrerendered() {
    const empty = {};
    Array.from(this._container.children)
      .filter(node => !this._meta.has(node))
      .forEach(node => this._putInPool(node, empty));
  }

  enqueueRendered() {
    this._nodes.forEach(node => this._putInPool(node, this._meta.get(node)));
    this._nodes = [];
  }

  _putInPool(node, meta) {
    if (!node.dataset.poolId) {
      node.dataset.poolId = Recycler.DEFAULT_PID;
    }
    if (!this._preservedNodes[meta.id]) {
      node.style.visibility = 'hidden';
      this._pool.push(node.dataset.poolId, node);
    }
  }

  _populateClient(from, nextIncrement) {
    const nodes = this._nodes;
    const metas = this._meta;
    let node, meta, updates = 0;
    // Enqueue node available for recycling.
    while (
      from == Recycler.END &&
      (node = nodes[0]) &&
      (meta = this._meta.get(node)) &&
      this.shouldRecycle(node, meta)
    ) {
      this._putInPool(node, meta);
      nodes.shift();
    }
    while (
      from == Recycler.START &&
      (node = nodes[nodes.length - 1]) &&
      (meta = this._meta.get(node)) &&
      this.shouldRecycle(node, meta)
    ) {
      this._putInPool(node, meta);
      nodes.pop();
    }
    // Dequeue node or allocate a new one.
    while (
      updates < nextIncrement &&
      (node = this._getNode(from))
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
      this.layout(nodes[i], metas.get(nodes[i]));
    }
    for (
      let i = nodes.length - updates;
      from == Recycler.END && i < nodes.length;
      i++
    ) {
      this.layout(nodes[i], metas.get(nodes[i]));
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

  _getNode(from) {
    let idx, meta, node, poolId;
    const nodes = this._nodes;
    const metas = this._meta;
    const size = this.size();

    if (size == 0) {
      return null;
    }
    if (nodes.length == 0) {
      idx = Recycler.UNKNOWN_IDX;
    }
    else {
      idx = from == Recycler.START ? this.startMeta.idx - 1 : this.endMeta.idx + 1;
      if (idx < 0 || idx >= size) {
        return;
      }
    }
    meta = this.initMetaForIndex(metas.getByIndex(idx) || { idx: idx });
    invariant(meta.idx >= 0 && meta.idx < size, 'meta should contain a valid index');
    poolId = this.poolIdForIndex(meta.idx, meta);
    if (node = this._preservedNodes[meta.id]) {
      delete this._preservedNodes[meta.id];
    }
    if (!node) {
      node = Recycler.START ? this._pool.shift(poolId) : this._pool.pop(poolId);
    }
    if (!node) {
      node = this.createNodeContainer();
    }
    invariant(node.dataset && node.style, 'invalid node container');
    metas.setByIndex(meta);
    metas.set(node, meta);
    node.dataset.poolId = poolId;
    this.nodeForIndex(node, meta.idx, meta);
    node.style.visibility = '';
    return node;
  }

  preserve(node, yes) {
    if (!node || node.__preserved === yes) {
      return;
    }
    let meta = this._meta.get(node);
    if (yes) {
      this._preservedNodes[meta.id] = node;
    }
    else if (this._preservedNodes[meta.id] === node) {
      delete this._preservedNodes[meta.id];
      if (this.shouldRecycle(node, meta)) {
        this._putInPool(node, meta);
      }
    }
  }

  _layoutPreservedNodes() {
    Object.keys(this._preservedNodes).forEach(id => {
      let node = this._preservedNodes[id];
      this.layout(node, this._meta.get(node));
    });
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

  layout(node, meta) {

  }

  makeActive(node, meta, nodes, metas, idx, from) {

  }

  nodeForIndex(node, idx, meta) {

  }

  poolIdForIndex(idx, meta) {
    return Recycler.DEFAULT_PID;
  }

  initMetaForIndex(idx) {
    return { idx: idx };
  }

  initIndex() {
    return 0;
  }

  get meta() {
    return this._meta;
  }

  get startNode() {
    return this._nodes[0];
  }

  get endNode() {
    return this._nodes[this._nodes.length - 1];
  }

  get startMeta() {
    return this._meta.get(this.startNode) || {};
  }

  get endMeta() {
    return this._meta.get(this.endNode) || {};
  }

  get pool() {
    return this._pool;
  }

  static get UNKNOWN_IDX() {
    return -1;
  }

  static get START() {
    return 1;
  }

  static get END() {
    return 2;
  }

  static get DEFAULT_PID() {
    return 0;
  }

  static get PRESERVED_PID() {
    return -1;
  }
}
