import { RENDER_START, RENDER_END, GLOBAL } from './constants';

let rootTaskQueue = [];
let subtaskQueue = [];

export function addTask(promiseHandler, cb, isRoot) {
  let queue = subtaskQueue;
  if (isRoot) {
    // Fast way to empty an array.
    rootTaskQueue.length = 0;
    let subtask;
    while (subtask = subtaskQueue.shift()) {
      subtask();
    }
    queue = rootTaskQueue;
  }
  queue.push(cb);
  return promiseHandler().then(_ => {
    if (queue.shift() === cb) {
      return cb();
    }
  });
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function checkThreshold(start, end, offset, size, dir, oversee) {
  return dir == RENDER_START
    ? start <= offset - oversee
    : end >= offset + size + oversee;
}

export function getRowOffset(meta, idx, dir, nodes, metas) {
  if (dir == RENDER_START && idx + 1 < nodes.length) {
    let nextM = metas.get(nodes[idx + 1]);
    return nextM._offsetTop - meta._height;
  } else if (dir == RENDER_END && idx > 0) {
    let prevM = metas.get(nodes[idx - 1]);
    return prevM._offsetTop + prevM._height;
  }
  return meta._offsetTop;
}

export function getColumnOffset(meta, idx, dir, nodes, metas) {
  if (dir == RENDER_START && idx + 1 < nodes.length) {
    let nextM = metas.get(nodes[idx + 1]);
    return nextM.x - meta.w;
  } else if (dir == RENDER_END && idx > 0) {
    let prevM = metas.get(nodes[idx - 1]);
    return prevM.x + prevM.w;
  }
  return meta.x;
}

export function shouldRecycleColumn(node, meta, offset, size) {
  return meta.x + meta.w < offset || meta.x > offset + size;
}

export function setProps(self, props) {
  props.forEach(prop => {
    if (self.hasOwnProperty(prop)) {
      let propVal = self[prop];
      delete self[prop];
      self[prop] = propVal;
    }
  });
}

export function setInstanceProps(self) {
  if (self.hasOwnProperty('props')) {
    let userProps = self.props;
    delete self.props;
    self.props = userProps;
  }
}

export function vnode() {
  return { dataset: {}, style: {} };
}

export function invariant(condition, errorMsg) {
  if (!condition) {
    throw new Error(errorMsg);
  }
}

export function eventTarget(se) {
  const d = document;
  return se === d.body ||
    se === d.documentElement ||
    !(se instanceof HTMLElement)
    ? window
    : se;
}

export function getScrollTop(scrollingElement) {
  return eventTarget(scrollingElement) == GLOBAL
    ? GLOBAL.pageYOffset
    : scrollingElement.scrollTop;
}

export function setScrollTop(scrollingElement, top) {
  eventTarget(scrollingElement) == GLOBAL
    ? GLOBAL.scrollTo(0, top)
    : scrollingElement.scrollTop = top;
}

export function getHeightForElement(element) {
  return element.getBoundingClientRect().height;
}

export function getIntervals(sections, rowsInSection) {
  if (sections == 0) {
    return [];
  }
  let intervals = new Array(sections);
  intervals[0] = [0, rowsInSection(0)];
  for (let i = 1; i < sections; i++) {
    let start = intervals[i - 1][1] + 1;
    let end = start + rowsInSection(i);
    intervals[i] = [start, end];
  }
  return intervals;
}

export function findIntervalIdx(idx, intervals) {
  let l = 0, r = intervals.length - 1;
  while (l <= r) {
    let mid = l + r >> 1;
    if (idx < intervals[mid][0]) {
      r = mid - 1;
    } else if (idx > intervals[mid][1]) {
      l = mid + 1;
    } else {
      return mid;
    }
  }
  return null;
}

export function findInObject(obj, value) {
  return Object.keys(obj).reduce(
    (current, key) => {
      let meta = obj[key];
      return meta._height > 0 &&
        meta._offsetTop <= value &&
        (!current || value - meta._offsetTop < value - current._offsetTop)
        ? meta
        : current;
    },
    null,
  );
}

export function pushToPool(pool, poolId, node) {
  if (!pool[poolId]) {
    pool[poolId] = [];
  }
  pool[poolId].push(node);
}

export function popFromPool(pool, poolId) {
  if (!pool[poolId]) {
    return null;
  }
  return pool[poolId].pop();
}

export function getDiv() {
  return document.createElement('div');
}

export function hide(node) {
  let style = node.style;
  style.position = 'absolute';
  style.top = '-10000px';
  style.height = '';
  style.bottom = '';
  style.left = '0';
  style.right = '0';
  return node;
}
