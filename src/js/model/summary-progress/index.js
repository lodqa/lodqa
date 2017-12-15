const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(loader, datasetsProgress) {
    super()

    this._max = 0
    this._value = 0
    this._showDatasets = false
    this._datasetsProgress = datasetsProgress

    // The number of bpgs is same the number of SPARQLs.
    loader.on('bgp', () => {
      this._max += 1
      this.emit('progress_summary_update_event')
    })
    loader.on('solutions', () => {
      this._value += 1
      this.emit('progress_summary_update_event')
    })
  }

  showDatasets(visible) {
    this._showDatasets = visible
    this._datasetsProgress.visible = visible
    this.emit('progress_summary_update_event')
  }

  get snapshot() {
    return {
      max: this._max,
      value: this._value,
      showDatasets: this._showDatasets
    }
  }
}
