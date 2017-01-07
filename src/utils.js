import Recycler from './Recycler';

export const NOOP = _ => {};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getApproxSize(renderedSize, renderedNumber, totalNumber) {
  return ~~(renderedSize + (totalNumber - renderedNumber) * (renderedSize / renderedNumber));
}

export function checkThreshold(start, end, offset, size, from, oversee) {
  return from == Recycler.START ? (start <= offset - oversee) : (end >= offset + size + oversee);
}

export function getRowOffset(meta, idx, from, nodes, metas) {
  if (from == Recycler.START && idx + 1 < nodes.length) {
    let nextM = metas.get(nodes[idx + 1]);
    return nextM.y - meta.h;
  }
  else if (from == Recycler.END && idx > 0) {
    let prevM = metas.get(nodes[idx - 1]);
    return prevM.y + prevM.h;
  }
  return meta.y;
}

export function getColumnOffset(meta, idx, from, nodes, metas) {
  if (from == Recycler.START && idx + 1 < nodes.length) {
    let nextM = metas.get(nodes[idx + 1]);
    return nextM.x - meta.w;
  }
  else if (from == Recycler.END && idx > 0) {
    let prevM = metas.get(nodes[idx - 1]);
    return prevM.x + prevM.w;
  }
  return meta.x;
}

export function shouldRecycleRow(node, meta, offset, size) {
  return meta.y + meta.h < offset || meta.y > offset + size
}

export function shouldRecycleColumn(node, meta, offset, size) {
  return meta.x + meta.w < offset || meta.x > offset + size
}

export function setProps(self, props) {
  props.forEach((prop) => {
    if (self.hasOwnProperty(prop)) {
      let propVal = self[prop];
      delete self[prop];
      self[prop] = propVal;
    }
  });
}

export function setInstanceProps(props, self) {
  if (self.hasOwnProperty('props')) {
    let userProps = self.props;
    delete self.props;
    self.props = props;
    self.props = userProps;
  } else {
    self.props = props;
  }
}

export function vnode() {
  return { dataset: {}, style: {} }
}

export function invariant(condition, errorMsg) {
  if (!condition) {
    throw new Error(errorMsg);
  }
}

export function eventTarget(se) {
  const d = document;
  return se === d.body || se === d.documentElement || !(se instanceof HTMLElement) ? window : se;
}

export function getScrollTop(scrollingElement) {
  return scrollingElement === window ? window.pageYOffset : scrollingElement.scrollTop;
}

export function setScrollTop(scrollingElement, top) {
  if (scrollingElement === window) {
    window.scrollTo(0, top);
  } else {
    scrollingElement.scrollTop = top;
  }
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
    let start = intervals[i-1][1] + 1;
    let end = start + rowsInSection(i);
    intervals[i] = [start, end];
  }
  return intervals;
}

export function findIntervalIdx(idx, intervals) {
  let l = 0, r = intervals.length - 1;
  while (l <= r) {
    let mid = (l + r) >> 1;
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