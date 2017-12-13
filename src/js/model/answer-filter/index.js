const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(answerSummary) {
    super()

    this._answerSummary = answerSummary
    this._hideSparqls = new Set()

    answerSummary.on('answer_summary_update_event', () => this.emit('answer_summary_update_event'))
  }

  hideSparql(dataset, number, show) {
    if (show) {
      this._hideSparqls.forEach((s) => {
        if (s.dataset === dataset && s.number === Number(number)) {
          this._hideSparqls.delete(s)
        }
      })
    } else {
      this._hideSparqls.add({
        dataset,
        number: Number(number)
      })
    }
    this.emit('answer_summary_update_event')
  }

  get snapshot() {
    const answers = this._answerSummary.snapshot

    return answers
      .map((a) => Object.assign({}, a, {
        sparqls: a.sparqls.filter((s) => {
          for (const hiddenSparql of this._hideSparqls.values()) {
            if (hiddenSparql.dataset === s.dataset && hiddenSparql.number === s.number) {
              return false
            }
          }

          return true
        })
      }))
      .filter((a) => a.sparqls.length > 0)
  }
}
