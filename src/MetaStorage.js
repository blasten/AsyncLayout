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

  find(prop, value) {
    // Could be binary, but that would require an interval tree...
    return Object.keys(this._storage).reduce((current, key) => {
      let meta = this._storage[key];
      return (meta[prop] <= value && (!current || value-meta[prop] < value-current[prop])) ?
          meta : current;
    }, null);
  }
}
