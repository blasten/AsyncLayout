import { EMPTY, UNKNOWN_IDX, RENDER_START, RENDER_END, DEFAULT_POOL_ID } from './constants';
import { pushToPool, popFromPool, clamp, invariant } from './utils';
import { forNextTick, forIdleTime } from './Async';

export default class Recycler {
  constructor(container, pool, storage, meta) {
    invariant(pool instanceof Object, 'Invalid pool type');
    invariant(storage instanceof Object, 'Invalid storage type');
    invariant(meta instanceof WeakMap, 'Invalid meta type');
    this._container = container;
    this._storage = storage;
    this._meta = meta;
    this._pool = pool;
    this._jobId = 0;
    this._size = 0;
    this._nodes = [];
    this._keptNodes = {};
  }

  async recycle(excludedNodes) {
    if (excludedNodes) {
      let excludedSize = excludedNodes.length, 
          resetSet = new Array(excludedSize);
      excludedNodes.forEach((node, idx) => {
        let id = node.dataset.id;
        resetSet[idx] = this._keptNodes[id] ? null : id;
        this._keepNode(node);
      });
      if (excludedNodes === this._nodes) {
        this._nodes = [];
      }
      await this._executeJob(++this._jobId, RENDER_END, Math.max(1, excludedSize));
      resetSet.forEach(id => this.release(id));
    } else {
      await this._executeJob(++this._jobId, RENDER_START, 1);
      await this._executeJob(++this._jobId, RENDER_END, 1);
    }
  }

  async _executeJob(jobId, from, jobSize) {
    let now, cost = 0;
    while (
      jobId == this._jobId &&
      jobSize != 0 &&
      !this.$isClientFull(this.startMeta, this.endMeta, from)
    ) {
      now = performance.now();
      jobSize = this._populateClient(from, jobSize);
      cost = (performance.now() - now) / jobSize;
    }
  }

  _putInPool(node) {
    let dataset = node.dataset;
    if (!dataset.poolId) {
      dataset.poolId = DEFAULT_POOL_ID;
    }
    if (!this._keptNodes[dataset.id]) {
      this._hideNode(node);
      pushToPool(this._pool, dataset.poolId, node);
    }
  }

  _populateClient(from, increment) {
    let node, meta, updates = 0, nodes = this._nodes,
        metas = this._meta,
        shouldRecycle = this.$shouldRecycle,
        makeActive = this.$makeActive,
        layout = this.$layout;
    // Enqueue node available for recycling.
    while (
      from == RENDER_END &&
      (node = nodes[0]) &&
      (meta = this._meta.get(node)) &&
      shouldRecycle(node, meta)
    ) {
      this._putInPool(node);
      nodes.shift();
    }
    while (
      from == RENDER_START &&
      (node = nodes[nodes.length - 1]) &&
      (meta = this._meta.get(node)) &&
      shouldRecycle(node, meta)
    ) {
      this._putInPool(node);
      nodes.pop();
    }
    // Dequeue node or allocate a new one.
    while (
      updates < increment &&
      (node = this._getNode(from))
    ) {
      from == RENDER_START ? nodes.unshift(node) : nodes.push(node);
      this._append(node);
      updates++;
    }
    // Read.
    for (
      let i = updates - 1;
      from == RENDER_START && i >= 0;
      i--
    ) {
      makeActive(nodes[i], metas.get(nodes[i]), nodes, metas, i, from);
    }
    for (
      let i = nodes.length - updates;
      from == RENDER_END && i < nodes.length;
      i++
    ) {
      makeActive(nodes[i], metas.get(nodes[i]), nodes, metas, i, from);
    }
    // Write.
    for (
      let i = updates - 1;
      from == RENDER_START && i >= 0;
      i--
    ) {
      layout(nodes[i], metas.get(nodes[i]));
    }
    for (
      let i = nodes.length - updates;
      from == RENDER_END && i < nodes.length;
      i++
    ) {
      layout(nodes[i], metas.get(nodes[i]));
    }
    return updates;
  }

  _append(node) {
    let container = this._container;
    if (node.parentNode !== undefined && node.parentNode !== container) {
      container.appendChild(node);
    }
  }

  _getNode(from) {
    let idx, size = this.$size();
    if (size == 0) {
      return null;
    }
    if (this._nodes.length == 0) {
      idx = UNKNOWN_IDX;
    }
    else {
      idx = from == RENDER_START ? this.startMeta.idx - 1 : this.endMeta.idx + 1;
      if (idx < 0 || idx >= size) {
        return;
      }
    }
    return this._getNodeByIdx(idx);
  }

  _getNodeByIdx(idx) {
    let meta, node, id, poolId, size = this.$size();

    meta = this.$initMeta(this._storage[idx] || { idx, id: idx });
    invariant(meta.idx >= 0 && meta.idx < size, 'meta should contain a valid index');
    poolId = this.$poolIdForIndex(meta.idx, meta);
    node = this._keptNodes[meta.id] || popFromPool(this._pool, poolId) || this.$createNodeContainer();
    invariant(node.dataset && node.style, 'invalid node container');
    this._storage[meta.idx] = meta;
    this._meta.set(node, meta);
    node.dataset.id = meta.id;
    node.dataset.poolId = poolId;
    node.style.pointerEvents = '';
    this.$updateNode(node, meta.idx, meta);
    return node;
  }

  has(idx) {
    return idx >= this.startMeta.idx && idx <= this.endMeta.idx;
  }

  _keepNode(node) {
    invariant(node.dataset.id != '', 'Node should contain a data-id property');
    this._keptNodes[node.dataset.id] = node;
  }

  keep(idx) {
    let node, meta = this._storage[idx];
    if (meta && (node = this._keptNodes[meta.id])) {
      this.$layout(node, meta);
      return meta.id;
    }
    node = this.has(idx) ? this._nodes[idx - this.startMeta.idx] :
        this._getNodeByIdx(idx);
    this._keepNode(node, false);
    this._append(node, RENDER_END);
    this.$layout(node, this._meta.get(node));
    return node.dataset.id;
  }

  release(id) {
    let node = this._keptNodes[id];
    if (!node) {
      return;
    }
    let meta = this._meta.get(node);

    delete this._keptNodes[id];

    if (this._nodes[meta.idx-this.startMeta.idx] === node) {
      this.$layout(node, meta);
    } else {
      this._putInPool(node);
    }
  }

  _hideNode(node) {
    let style = node.style;
    style.position = 'absolute';
    style.pointerEvents = 'none';
    style.top = '-100000000px';
    style.bottom = '';
  }

  get startMeta() {
    return this._meta.get(this._nodes[0]) || EMPTY;
  }

  get endMeta() {
    return this._meta.get(this._nodes[this._nodes.length-1]) || EMPTY;
  }

  get nodes() {
    return this._nodes;
  }

  $createNodeContainer() {
    return null;
  }

  $shouldRecycle(node, meta) {
    return true;
  }

  $isClientFull(startMeta, endMeta, from) {
    return true;
  }

  $hasEnoughContent(startMeta, endMeta, from) {
    return true;
  }

  $size() {
    return 0;
  }

  $layout(node, meta) {

  }

  $makeActive(node, meta, nodes, metas, idx, from) {

  }

  $updateNode(node, idx, meta) {

  }

  $poolIdForIndex(idx, meta) {
    return DEFAULT_POOL_ID;
  }

  $initMeta(idx) {
    return EMPTY;
  }

}
