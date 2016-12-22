import { forIdleTime, forBeforePaint } from './Async';
import { clamp } from './utils';
import DomPool from './DomPool';

export default class Recycler {
  constructor(pool, props) {
    if (!(pool instanceof DomPool)) {
      throw new TypeError('Invalid pool type');
    }
    this._props = props;
    this._size = 0;
    this._pool = pool;
    this._jobId = 0;
    this._nodes = [];
    this._isMounted  = false;
    this.meta = new WeakMap();
  }

  get mounted() {
    return this._isMounted;
  }

  async mount() {
    this._isMounted = true;
    this._putNodesInPool(this._props.parentContainer.children);
  }

  async recycle() {
    this._jobId++;
    if (this._nodes.length > 0) {
      await this._recycle(Recycler.START, 1, this._jobId);
    }
    await this._recycle(Recycler.END, 1, this._jobId);
  }

  async _recycle(from, nextIncrement, jobId) {
    if (!this._isMounted || this._jobId != jobId) {
      return;
    }
    // Schedule onscreen work.
    while (!this._props.isClientFull(this._nodes, this.meta, from)) {
      let now = performance.now();
      nextIncrement = this._populateClient(from, nextIncrement);
      if (nextIncrement === 0) {
        break;
      }
      this._unitCost = (performance.now() - now) / nextIncrement;
      nextIncrement = nextIncrement * 2;
    }
    // Schedule offscreen work.
    if (nextIncrement > 0 && !this._props.hasEnoughContent(this._nodes, this.meta, from)) {
      let idle = await forIdleTime();
      nextIncrement = clamp(~~(idle.timeRemaining() / this._unitCost), 1, nextIncrement);
      await this._recycle(from, this._populateClient(from, nextIncrement) * 2, jobId);
    }
  }

  _putNodesInPool(nodes) {
    Array.from(nodes).forEach(node => this._putInPool(node));
  }

  _putInPool(node) {
    if (!node.dataset.poolId) {
      node.dataset.poolId = 0;
    }
    // Hide the node.
    node.style.transform = 'matrix(1, 0, 0, 1, -10000, -10000)';
    this._pool.push(node.dataset.poolId, node);
  }

  _shouldRecycle(node) {
    return this._props.shouldRecycle(node, this.meta.get(node));
  }

  _populateClient(from, nextIncrement) {
    const nodes = this._nodes;
    const meta = this.meta;
    while (
      from == Recycler.END &&
      nodes.length > 1 &&
      this._shouldRecycle(nodes[0])
    ) {
      this._putInPool(nodes[0]);
      this._removeFromActive(nodes[0], 0);
    }
    while (
      from == Recycler.START &&
      nodes.length > 1 &&
      this._shouldRecycle(nodes[nodes.length - 1])
    ) {
      this._putInPool(nodes[nodes.length - 1]);
      this._removeFromActive(nodes[nodes.length - 1], nodes.length - 1);
    }
    let updates = 0;
    let node;
    while (
      updates <= nextIncrement &&
      (node = this._popNodeFromPool(from) || this._allocateNode(from))
    ) {
      this._pushToClient(node, from);
      updates++;
    }
    // read
    for (
      let i = updates - 1;
      from == Recycler.START && i >= 0;
      i--
    ) {
      this._props.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes,meta);
    }
    for (
      let i = nodes.length - updates;
      from == Recycler.END && i < nodes.length;
      i++
    ) {
      this._props.makeActive(nodes[i], meta.get(nodes[i]), i, from, nodes, meta);
    }
    // write
    for (
      let i = updates - 1;
      from == Recycler.START && i >= 0;
      i--
    ) {
      this._props.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
    for (
      let i = nodes.length - updates;
      from == Recycler.END && i < nodes.length;
      i++
    ) {
      this._props.layout(nodes[i], meta.get(nodes[i]), i, from);
    }
    return updates;
  }

  _pushToClient(node, from) {
    const nodes = this._nodes;
    const parentContainer = this._props.parentContainer;
    from == Recycler.START ? nodes.unshift(node) : nodes.push(node);

    if (parentContainer && node.parentNode !== parentContainer) {
      parentContainer.appendChild(node);
    }
  }

  _popNodeFromPool(from) {
    let idx, poolId;
    const nodes = this._nodes;
    if (nodes.length === 0) {
      idx = 0;
      poolId = this._props.poolIdForIndex(0);
    }
    else if (from == Recycler.START) {
      idx = this.meta.get(this.startNode).idx - 1;
      poolId = idx >= 0 ? this._props.poolIdForIndex(idx) : null;
    }
    else {
      idx = this.meta.get(this.endNode).idx + 1;
      poolId = idx < this._props.size() ? this._props.poolIdForIndex(idx) : null;
    }
    const node = Recycler.START ? this._pool.shift(poolId) : this._pool.pop(poolId);
    if (node) {
      this._props.nodeForIndex(idx, node);
      this.meta.set(node, this._props.initMetaForIndex(idx, node));
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
      idx = this.meta.get(this.startNode).idx - 1;
    }
    else {
      idx = this.meta.get(this.endNode).idx + 1;
    }
    if (idx < 0 || idx >= this._props.size()) {
      return null;
    }
    const node = document.createElement('div');
    node.dataset.poolId = this._props.poolIdForIndex(idx);
    this._props.nodeForIndex(idx, node);
    this.meta.set(node, this._props.initMetaForIndex(idx, node));
    return node;
  }

  _removeFromActive(node, index) {
    this._nodes.splice(index, 1);
  }

  get startNode() {
    return this._nodes[0] || null;
  }

  get endNode() {
    return this._nodes.length === 0 ? null : this._nodes[this._nodes.length - 1];
  }

  static get START() {
    return 1;
  }

  static get END() {
    return 2;
  }
}
