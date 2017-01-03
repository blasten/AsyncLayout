export default class DomPool {
  constructor() {
    this._pools = {};
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
