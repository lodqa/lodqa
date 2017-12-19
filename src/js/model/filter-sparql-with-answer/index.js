const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(datasetsProgress) {
    super()

    this._datasetsProgress = datasetsProgress
    this._showOnlyWithAnswer = false

    datasetsProgress.on('progress_selected_dataset_update_event', () => this.emit('progress_selected_dataset_update_event'))
  }

  set showOnlyWithAnswer(show) {
    this._showOnlyWithAnswer = show
    this.emit('progress_selected_dataset_update_event')
  }

  get stateOfSparqlsOfSelectedDataset() {
    const state = this._datasetsProgress.stateOfSparqlsOfSelectedDataset
    if (!this._showOnlyWithAnswer) {
      return state
    }

    return Object.assign(state, {
      showOnlyWithAnswer: true,
      sparqls: state.sparqls.filter((s) => s.uniqAnswersLength > 0)
    })
  }
}
