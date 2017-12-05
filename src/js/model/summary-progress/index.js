const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._max = 0
    this._value = 0
    this._showDatasets = false

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

  showDatasets(isShow) {
    this._showDatasets = isShow
    this.emit('progress_summary_update_event')
    console.log('show', isShow)
  }

  get snapshot() {
    return {
      max: this._max,
      value: this._value,
      showDatasets: this._showDatasets
    }
  }
}
