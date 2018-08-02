module.exports = class Dataset {
  constructor(name, number) {
    this._name = name
    this._number = number
  }

  get name() {
    return this._name
  }

  get number() {
    return this._number
  }
}
