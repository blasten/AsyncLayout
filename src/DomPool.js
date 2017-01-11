export default class DomPool {
  constructor() {
    this._pools = {};
  }

  push(poolId, node) {
    if (!this._pools[poolId]) {
      this._pools[poolId] = [];
    }
    this._pools[poolId].push(node);
  }

  pop(poolId) {
    if (!this._pools[poolId]) {
      return null;
    }
    return this._pools[poolId].pop();
  }

  getById(poolId) {
    return this._pools[poolId];
  }
}
