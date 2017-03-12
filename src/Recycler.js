import {
  EMPTY,
  UNKNOWN_IDX,
  RENDER_START,
  RENDER_END,
  DEFAULT_POOL_ID,
  BY_ONE,
  MIN_BATCH_SIZE,
  NOOP,
} from './constants';
import {
  addJob,
  pushToPool,
  popFromPool,
  clamp,
  runJobs,
  hide,
  invariant,
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
    this._keyNodeMap = {};
  }

  refresh(nodes) {
    let resetSet = [], startIdx = UNKNOWN_IDX;
    nodes.forEach((node, idx) => {
      let key = node.dataset.key;
      if (!this._keyNodeMap[key]) {
        resetSet.push(key);
        this._keepNode(node);
      }
    });
    if (nodes === this._nodes) {
      startIdx = this.startMeta.idx;
      this._nodes = [];
    }
    this
      ._schedule(
        RENDER_END,
        forNextTick,
        this.$isClientIncomplete,
        Math.max(MIN_BATCH_SIZE, nodes.length),
        true,
        startIdx
      )
      .then(_ => {
        resetSet.forEach(key => {
          let meta = this._meta.get(this._keyNodeMap[key]);
          if (!meta || this.has(meta.idx)) {
            this.release(key);
          }
        });
      });
  }

  recycle(isBuffer, recalcs) {
    let batchSize = isBuffer ? 3 : MIN_BATCH_SIZE,
      isJobDone = isBuffer
        ? this.$isBufferIncomplete
        : this.$isClientIncomplete,
      waiter = isBuffer ? forIdleTime : forNextTick;
    return this
      ._schedule(RENDER_START, waiter, isJobDone, batchSize, recalcs)
      .then(_ =>
        this._schedule(RENDER_END, waiter, isJobDone, batchSize, recalcs));
  }

  _schedule(dir, awaitFor, isDone, jobSize, recalcs, startIdx = UNKNOWN_IDX) {
    return addJob(
      {
        _waiter: awaitFor,
        _preempt: false,
        _run: (currentJob, queue, async) => {
          if (isDone(this.startMeta, this.endMeta, dir)) {
            return;
          }
          let updateTask = this._updateTree(dir, jobSize, startIdx);
          if (updateTask.size === 0) {
            return;
          }
          let nodes = this._nodes;
          queue.push({
            _waiter: recalcs ? forNextTick : forNextAnimationFrame,
            _preempt: true,
            _run: _ => {
              this._layout(updateTask);
              this._nodes = updateTask.nodes;
            },
          });
          queue.push(currentJob);
        },
      },
      this._queue,
    );
  }

  _putInPool(node) {
    let dataset = node.dataset;
    if (!dataset.pool) {
      dataset.pool = DEFAULT_POOL_ID;
    }
    if (!this._keyNodeMap[dataset.key]) {
      pushToPool(this._pool, dataset.pool, hide(node));
    }
  }

  _updateTree(dir, increment, startIdx) {
    let node,
      meta,
      nodes = this._nodes,
      metas = this._meta,
      size = 0,
      startMeta = this.startMeta,
      endMeta = this.endMeta;

    if (startMeta && dir == RENDER_START && startMeta.idx === 0) {
      return { dir, nodes, size };
    }
    if (endMeta && dir == RENDER_END && endMeta.idx === this.$size() - 1) {
      return { dir, nodes, size };
    }
    // Enqueue node available for recycling.
    while (
      dir == RENDER_START &&
      (node = nodes[nodes.length - 1]) &&
      (meta = metas.get(node)) &&
      this.$shouldRecycle(meta)
    ) {
      this._putInPool(node);
      nodes.pop();
    }
    while (
      dir == RENDER_END &&
      (node = nodes[0]) &&
      (meta = metas.get(node)) &&
      this.$shouldRecycle(meta)
    ) {
      this._putInPool(node);
      nodes.shift();
    }
    // Dequeue node or allocate a new one.
    while (size < increment && (node = this._getNode(dir, startIdx))) {
      dir == RENDER_START ? nodes.unshift(node) : nodes.push(node);
      this._append(node);
      size++;
    }
    return { dir, nodes, size };
  }

  _layout(updateTask) {
    let nodes = updateTask.nodes,
      dir = updateTask.dir,
      size = updateTask.size,
      metas = this._meta,
      makeActive = this.$makeActive,
      layout = this.$layout;
    // Read.
    for (let i = size - 1; dir == RENDER_START && i >= 0; i--) {
      makeActive(nodes[i], metas.get(nodes[i]), nodes, metas, i, dir);
    }
    for (
      let i = nodes.length - size;
      dir == RENDER_END && i < nodes.length;
      i++
    ) {
      makeActive(nodes[i], metas.get(nodes[i]), nodes, metas, i, dir);
    }
    // Write.
    for (let i = size - 1; dir == RENDER_START && i >= 0; i--) {
      layout(nodes[i], metas.get(nodes[i]));
    }
    for (
      let i = nodes.length - size;
      dir == RENDER_END && i < nodes.length;
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

  _getNode(dir, startIdx = UNKNOWN_IDX) {
    let idx, size = this.$size();
    if (this._nodes.length == 0) {
      idx = Math.min(startIdx, size - 1);
    } else {
      idx = dir == RENDER_START ? this.startMeta.idx - 1 : this.endMeta.idx + 1;
      if (idx < 0) {
        return null;
      }
    }
    return idx < size && size > 0 ? this._getNodeByIdx(idx) : null;
  }

  _getNodeByIdx(idx) {
    let meta, node, key, pool, keptNodes = this._keyNodeMap, size = this.$size();

    meta = this.$initMeta(this._storage[idx] || { idx, key: idx });

    invariant(
      meta.idx >= 0 && meta.idx < size,
      'meta should contain a valid index',
    );
    pool = this.$poolForIndex(meta.idx, meta);
    // Assign a node from any source.
    node = keptNodes[meta.key] ||
      popFromPool(this._pool, pool) ||
      hide(this.$createNodeContainer());
    invariant(node.dataset && node.style, 'invalid node container');
    node = this.$updateNode(node, meta.idx, meta);
    this._storage[meta.idx] = meta;
    this._meta.set(node, meta);
    node.dataset.key = meta.key;
    node.dataset.pool = pool;
    if (keptNodes[meta.key]) {
      keptNodes[meta.key] = node;
    }
    return node;
  }

  has(idx) {
    return idx >= this.startMeta.idx && idx <= this.endMeta.idx;
  }

  _keepNode(node) {
    invariant(
      node.dataset.key != '',
      'Node should contain a `dataset.key` property',
    );
    this._keyNodeMap[node.dataset.key] = node;
  }

  keep(idx) {
    let node, meta = this._storage[idx];
    if (meta && (node = this._keyNodeMap[meta.key])) {
      this.$layout(node, meta);
      return meta.key;
    }
    node = this.has(idx)
      ? this._nodes[idx - this.startMeta.idx]
      : this._getNodeByIdx(idx);
    this._keepNode(node, false);
    this._append(node, RENDER_END);
    this.$layout(node, this._meta.get(node));
    return node.dataset.key;
  }

  release(key) {
    let node = this._keyNodeMap[key];
    if (!node) {
      return;
    }
    let meta = this._meta.get(node) || EMPTY;

    delete this._keyNodeMap[key];

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

  $isClientIncomplete(startMeta, endMeta, dir) {
    return false;
  }

  $isBufferIncomplete(startMeta, endMeta, dir) {
    return true;
  }

  $size() {
    return 0;
  }

  $layout(node, meta) {
  }

  $makeActive(node, meta, nodes, metas, idx, dir) {
  }

  $updateNode(node, idx, meta) {
  }

  $poolForIndex(idx, meta) {
    return DEFAULT_POOL_ID;
  }

  $initMeta(idx) {
    return EMPTY;
  }
}
