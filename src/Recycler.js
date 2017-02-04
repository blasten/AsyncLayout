import {
  EMPTY,
  UNKNOWN_IDX,
  RENDER_START,
  RENDER_END,
  DEFAULT_POOL_ID,
  BY_ONE
} from './constants';
import { pushToPool, popFromPool, clamp, runJobs, invariant } from './utils';
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
    this._cost = 0;
    this._nodes = [];
    this._queue = [];
    this._keptNodes = {};
  }

  async recycle(excludedNodes) {
    let resetSet;
    if (excludedNodes) {
      resetSet = new Array(excludedNodes.length);
      excludedNodes.forEach((node, idx) => {
        let id = node.dataset.id;
        resetSet[idx] = this._keptNodes[id] ? null : id;
        this._keepNode(node);
      });
      if (excludedNodes === this._nodes) {
        this._nodes = [];
      }
      await this._scheduleRenderTask(
        RENDER_END,
        forNextTick,
        this.$isClientIncomplete,
        Math.max(1, excludedNodes.length)
      );
      resetSet && resetSet.forEach(id => this.release(id));
    } else {
      await this._scheduleRenderTask(
        RENDER_START,
        forNextTick,
        this.$isClientIncomplete,
        3
      );
      await this._scheduleRenderTask(
        RENDER_END,
        forNextTick,
        this.$isClientIncomplete,
        3
      );
    }
  }

  async fillBuffer() {
    await this._scheduleRenderTask(
      RENDER_START,
      forIdleTime,
      this.$isBufferIncomplete,
      3
    );
    await this._scheduleRenderTask(
      RENDER_END,
      forIdleTime,
      this.$isBufferIncomplete,
      3
    );
  }

  _scheduleRenderTask(from, awaitFor, isDone, jobSize) {
    return this._runLoop({
      _await: awaitFor,
      _preempt: false,
      _run: (currentJob, queue, async) => {
        if (!isDone(this.startMeta, this.endMeta, from)) {
          return;
        }
        let updateTask = this._write(from, jobSize);
        if (updateTask.size === 0) {
          return;
        }
        queue.push({
          _await: forNextAnimationFrame,
          _preempt: true,
          _run: _ => {
            this._layout(updateTask);
            this._nodes = updateTask.nodes;
          }
        });
        queue.push(currentJob);
      }
    });
  }

  async _runLoop(task) {
    let job, queue = this._queue;

    if (this._isRunning) {
      // Preempt the current tasks.
      while (job = queue.shift()) {
        if (job._preempt) {
          job._run();
        }
      }
    }
    queue.push(task);

    while (job = queue[0]) {
      let asyncMeta = await job._await();
      if (job === queue[0]) {
        queue.shift();
        job._run(job, queue, asyncMeta);
      } else {
        break;
      }
    }
  }

  _getJobSize(idle) {
    return clamp(~~(idle.timeRemaining() / this._cost), 1, this._nodes.length);
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

  _write(from, increment) {
    let node,
      meta,
      nodes = this._nodes,
      metas = this._meta,
      size = 0,
      shouldRecycle = this.$shouldRecycle;

    // Enqueue node available for recycling.
    while (
      from == RENDER_START &&
        (node = nodes[nodes.length - 1]) &&
        (meta = metas.get(node)) &&
        shouldRecycle(node, meta)
    ) {
      this._putInPool(node);
      nodes.pop();
    }
    while (
      from == RENDER_END &&
        (node = nodes[0]) &&
        (meta = metas.get(node)) &&
        shouldRecycle(node, meta)
    ) {
      this._putInPool(node);
      nodes.shift();
    }
    // Dequeue node or allocate a new one.
    while (size < increment && (node = this._getNode(from))) {
      from == RENDER_START ? nodes.unshift(node) : nodes.push(node);
      this._append(node);
      size++;
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
    if (size == 0) {
      return null;
    }
    if (this._nodes.length == 0) {
      idx = UNKNOWN_IDX;
    } else {
      idx = from == RENDER_START
        ? this.startMeta.idx - 1
        : this.endMeta.idx + 1;
      if (idx < 0 || idx >= size) {
        return;
      }
    }
    return this._getNodeByIdx(idx);
  }

  _getNodeByIdx(idx) {
    let meta, node, id, poolId, size = this.$size();

    meta = this.$initMeta(this._storage[idx] || { idx, id: idx });
    invariant(
      meta.idx >= 0 && meta.idx < size,
      'meta should contain a valid index'
    );
    poolId = this.$poolIdForIndex(meta.idx, meta);
    node = this._keptNodes[meta.id] ||
      popFromPool(this._pool, poolId) ||
      this.$createNodeContainer();
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
    let meta = this._meta.get(node);

    delete this._keptNodes[id];

    if (this._nodes[meta.idx - this.startMeta.idx] === node) {
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
    return this._meta.get(this._nodes[this._nodes.length - 1]) || EMPTY;
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
