export default class MetaStorage extends WeakMap {
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
