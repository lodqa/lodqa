module.exports = class {
  constructor() {
    this._count = 0
  }
  reset() {
    this._count = 0
  }
  increment() {
    this._count++
  }
  get count() {
    return this._count
  }
}
