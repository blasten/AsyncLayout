import {
  EMPTY,
  UNKNOWN_IDX,
  RENDER_START,
  RENDER_END,
  DEFAULT_POOL_ID,
  BY_ONE,
  MIN_BATCH_SIZE
} from './constants';
import {
  addJob,
  pushToPool,
  popFromPool,
  clamp,
  runJobs,
  hide,
  invariant
} from './utils';
import { forNextTick, forIdleTime, forNextAnimationFrame } from './Async';

export default class Recycler {
  constructor(container, pool, storage, meta) {
    invariant(pool instanceof Object, 'Invalid pool type');
    invariant(storage instanceof Object, 'Invalid storage type');
    invariant(meta instanceof WeakMap, 'Invalid meta type');
    this._container = container;
    this._storage = storage;
    this._meta = meta;
    this._pool = pool;
    this._nodes = [];
    this._queue = [];
    this._keptNodes = {};
    this._startIdx = UNKNOWN_IDX;
  }

  refresh(nodes) {
    let resetSet = [];
    nodes.forEach((node, idx) => {
      let id = node.dataset.id;
      if (!this._keptNodes[id]) {
        resetSet.push(id);
        this._keepNode(node);
      }
    });
    if (nodes === this._nodes) {
      this._startIdx = this.startMeta.idx;
      this._nodes = [];
    }
    let batchSize = Math.max(MIN_BATCH_SIZE, nodes.length);
    this._schedule(
      RENDER_START,
      forNextTick,
      this.$isClientIncomplete,
      batchSize,
      false
    ).then(_ => this._schedule(
      RENDER_END,
      forNextTick,
      this.$isClientIncomplete,
      batchSize,
      false
    )).then(_ => {
      resetSet.forEach(id => this.release(id));
      this._startIdx = UNKNOWN_IDX;
    });
  }

  recycle(isBuffer) {
    let batchSize = isBuffer ? 3 : MIN_BATCH_SIZE,
      condition = isBuffer ? this.$isBufferIncomplete : this.$isClientIncomplete,
      waiter = isBuffer ? forIdleTime : forNextTick;
    
    return this._schedule(
      RENDER_START,
      waiter,
      condition,
      batchSize,
      true
    ).then(_=> this._schedule(
      RENDER_END,
      waiter,
      condition,
      batchSize,
      true
    ));
  }

  _schedule(from, awaitFor, isDone, jobSize, fastDOM) {
    let x = 0;
    return addJob({
      _waiter: awaitFor,
      _preempt: false,
      _run: (currentJob, queue, async) => {
        x++;
        if (x > 100) {
          console.error('fucked');
          return;
        }
        if (isDone(this.startMeta, this.endMeta, from)) {
          return;
        }
        let updateTask = this._write(from, jobSize);
        if (updateTask.size === 0) {
          return;
        }
        let nodes = this._nodes;
        queue.push({
          _waiter: fastDOM ? forNextAnimationFrame : forNextTick,
          _preempt: true,
          _run: _ => {
            this._layout(updateTask);
            this._nodes = updateTask.nodes;
          }
        });
        queue.push(currentJob);
      }
    }, this._queue);
  }

  _putInPool(node) {
    let dataset = node.dataset;
    if (!dataset.poolId) {
      dataset.poolId = DEFAULT_POOL_ID;
    }
    if (!this._keptNodes[dataset.id]) {
      pushToPool(this._pool, dataset.poolId, hide(node));
    }
  }

  _write(from, increment) {
    let node,
      meta,
      nodes = this._nodes,
      metas = this._meta,
      size = 0,
      shouldRecycle = this.$shouldRecycle,
      startIdx = this.startMeta.idx,
      endIdx = this.endMeta.idx;
    if (
      from == RENDER_START && startIdx !== 0 ||
      from == RENDER_END && endIdx !== this.$size() - 1
    ) {
      // Enqueue node available for recycling.
      while (
        from == RENDER_START &&
        (node = nodes[nodes.length - 1]) &&
        (meta = metas.get(node)) &&
        shouldRecycle(meta)
      ) {
        this._putInPool(node);
        nodes.pop();
      }
      while (
        from == RENDER_END &&
        (node = nodes[0]) &&
        (meta = metas.get(node)) &&
        shouldRecycle(meta)
      ) {
        this._putInPool(node);
        nodes.shift();
      }
      // Dequeue node or allocate a new one.
      while (
        size < increment &&
        (node = this._getNode(from))
      ) {
        from == RENDER_START ? nodes.unshift(node) : nodes.push(node);
        this._append(node);
        size++;
      }
    }
    return { from, nodes, size };
  }

  _layout(updateTask) {
    let nodes = updateTask.nodes,
      from = updateTask.from,
      size = updateTask.size,
      metas = this._meta,
      makeActive = this.$makeActive,
      layout = this.$layout;
    // Read.
    for (let i = size - 1; from == RENDER_START && i >= 0; i--) {
      makeActive(nodes[i], metas.get(nodes[i]), nodes, metas, i, from);
    }
    for (
      let i = nodes.length - size;
      from == RENDER_END && i < nodes.length;
      i++
    ) {
      makeActive(nodes[i], metas.get(nodes[i]), nodes, metas, i, from);
    }
    // Write.
    for (let i = size - 1; from == RENDER_START && i >= 0; i--) {
      layout(nodes[i], metas.get(nodes[i]));
    }
    for (
      let i = nodes.length - size;
      from == RENDER_END && i < nodes.length;
      i++
    ) {
      layout(nodes[i], metas.get(nodes[i]));
    }
  }

  _append(node) {
    let container = this._container;
    if (node.parentNode !== undefined && node.parentNode !== container) {
      container.appendChild(node);
    }
  }

  _getNode(from) {
    let idx, size = this.$size();
    if (this._nodes.length == 0) {
      idx = Math.min(this._startIdx, size-1);
    } else {
      idx = from == RENDER_START
        ? this.startMeta.idx - 1
        : this.endMeta.idx + 1;
      if (idx < 0) {
        return null;
      }
    }
    return idx < size && size > 0 ? this._getNodeByIdx(idx) : null;
  }

  _getNodeByIdx(idx) {
    let meta,
      node,
      id,
      poolId,
      keptNodes = this._keptNodes,
      size = this.$size();

    meta = this.$initMeta(this._storage[idx] || { idx, id: idx });

    invariant(
      meta.idx >= 0 && meta.idx < size,
      'meta should contain a valid index'
    );
    poolId = this.$poolIdForIndex(meta.idx, meta);
    // Assign a node from any source.
    node = keptNodes[meta.id] ||
      popFromPool(this._pool, poolId) ||
      hide(this.$createNodeContainer());
    invariant(node.dataset && node.style, 'invalid node container');
    node = this.$updateNode(node, meta.idx, meta);
    this._storage[meta.idx] = meta;
    this._meta.set(node, meta);
    node.dataset.id = meta.id;
    node.dataset.poolId = poolId;
    if (keptNodes[meta.id]) {
      keptNodes[meta.id] = node;
    }
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
    node = this.has(idx)
      ? this._nodes[idx - this.startMeta.idx]
      : this._getNodeByIdx(idx);
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
    let meta = this._meta.get(node) || EMPTY;

    delete this._keptNodes[id];

    if (this._nodes[meta.idx - this.startMeta.idx] == node) {
      this.$layout(node, meta);
    } else {
      this._putInPool(node);
    }
  }

  get startMeta() {
    return this._meta.get(this._nodes[0]) || EMPTY;
  }

  get endMeta() {
    return this._meta.get(this._nodes[this._nodes.length - 1]) || EMPTY;
  }

  get nodes() {
    return this._nodes;
  }

  $createNodeContainer() {
    return null;
  }

  $shouldRecycle(meta) {
    return true;
  }

  $isClientIncomplete(startMeta, endMeta, from) {
    return false;
  }

  $isBufferIncomplete(startMeta, endMeta, from) {
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