const {
  EventEmitter
} = require('events')

module.exports = class extends EventEmitter {
  constructor(answerSummary) {
    super()

    this._answerSummary = answerSummary
    this._selected = null

    answerSummary.on('answer_summary_update_event', () => {
      this._updateAnswers(answerSummary.snapshot)
      this.emit('answer_summary_update_event')
    })
  }

  _updateAnswers(answers) {
    if (!this._selected) {
      this._setDefault(answers)
    }
  }

  _setDefault(answers) {
    const withRendering = answers
      .filter((answer) => answer.urls)
      .find((answer) => answer.urls.filter((u) => u.rendering))

    if (withRendering) {
      this._selected = {
        uri: withRendering.uri,
        index: withRendering.urls.findIndex((u) => u.rendering)
      }
      this.emit('media_select_update_event')
    }
  }

  select(uri, index) {
    this._selected = {
      uri,
      index
    }
    this.emit('media_select_update_event')
    this.emit('answer_summary_update_event')
  }

  get selected() {
    return this._selected
  }

  get snapshot() {
    // Mark the seletced media if a media is selected.
    if (this._selected) {
      const {
        uri,
        index
      } = this._selected

      const answers = this._answerSummary.snapshot
      return answers.map((answer) => {
        if (answer.uri === uri) {
          return Object.assign({}, answer, {
            urls: answer.urls.map((u, i) => {
              if (i === index) {
                return Object.assign({}, u, {
                  rendering: Object.assign({}, u.rendering, {
                    selected: true
                  })
                })
              }

              return u
            })
          })
        }

        return answer
      })
    } else {
      return this._answerSummary.snapshot
    }
  }
}
