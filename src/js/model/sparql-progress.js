const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(dataset) {
    super()

    this._dataset = dataset

    // Listen dataset
    dataset.on('sparql_reset_event', () => this.emit('sparql_progress_change_event'))
    dataset.on('sparql_add_event', () => this.emit('sparql_progress_change_event'))
    dataset.on('solution_add_event', () => this.emit('sparql_progress_change_event'))
  }

  get snapshot() {
    return {
      value: this._dataset.sparqlCount,
      max: this._dataset.sparqlsMax,
      percentage: this._dataset.sparqlsMax === 0 ? 0 : Math.floor(this._dataset.sparqlCount / this._dataset.sparqlsMax * 1000) / 10,
      showDetail: this._showDetail
    }
  }

  get currentStatusOfSparqls() {
    if(this._showDetail) {
      return this._dataset.currentStatusOfSparqls
    }
  }

  set showDetail(isShow) {
    this._showDetail = isShow
    this.emit('sparql_progress_show_detail_event')
  }
}
