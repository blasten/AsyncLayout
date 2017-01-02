class MetaStorage extends WeakMap {
  constructor() {
    super();
    this._storage = {};
  }

  getByIndex(idx) {
    return this._storage[idx];
  }

  setByIndex(meta) {
    this._storage[meta.idx] = meta;
    return meta;
  }

  hasIndex(idx) {
    return idx in this._storage;
  }
}

export default class DomPool {
  constructor() {
    this._pools = {};
    this._meta = new MetaStorage();
  }

  get meta() {
    return this._meta;
  }

  push(poolId, obj) {
    if (!this._pools[poolId]) {
      this._pools[poolId] = [];
    }
    this._pools[poolId].push(obj);
  }

  pop(poolId) {
    if (!this._pools[poolId]) {
      return null;
    }
    return this._pools[poolId].pop();
  }

  shift(poolId) {
    if (!this._pools[poolId]) {
      return null;
    }
    return this._pools[poolId].shift();
  }

  getById(poolId) {
    return this._pools[poolId] || [];
  }
}
