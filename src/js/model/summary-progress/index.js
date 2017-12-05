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

    // A Dataset with bgps will have SPARQLs
    loader.on('bgps', ({
      bgps
    }) => {
      this._max += bgps.length
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
