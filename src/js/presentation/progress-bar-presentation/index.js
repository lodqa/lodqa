const show = require('./show')
const progress = require('./progress')
const stop = require('./stop')

module.exports = class {
  constructor(progressBarDomId) {
    this.progressBarDomId = progressBarDomId
  }

  show(total, onSparqlClick) {
    show(this.progressBarDomId, total, onSparqlClick)
  }

  progress(solutions, sparqlCount, focusNode) {
    progress(this.progressBarDomId, solutions, sparqlCount, focusNode)
  }

  stop(sparqlCount, errorMessage) {
    stop(this.progressBarDomId, sparqlCount, errorMessage)
  }

  toggleShowOnlyHasAnswers() {
    document.querySelector(`#${this.progressBarDomId}`)
      .classList.toggle('show-only-has-answers')
  }
}