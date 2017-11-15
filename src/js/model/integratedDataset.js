const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor() {
    super()

    this._datasets = new Map()
  }

  addDataset(name, dataset) {
    this._datasets.set(name, dataset)
  }

  set displayingDetail(name) {
    this.emit('dataset_displaying_detail_update_event', name, this._datasets.get(name))
  }
}
