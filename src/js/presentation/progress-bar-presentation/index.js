const show = require('./show')
const progress = require('./progress')
const stop = require('./stop')

module.exports = class {
  constructor(progressBarDomId) {
    this.progressBarDomId = progressBarDomId
  }

  show(total, onSparqlClick, onChcekChange) {
    show(this.progressBarDomId, total, onSparqlClick, onChcekChange)
  }

  progress(solutions, sparqlCount, focusNode, sparqlTimeout) {
    progress(this.progressBarDomId, solutions, sparqlCount, focusNode, sparqlTimeout)
  }

  stop(sparqlCount, errorMessage) {
    stop(this.progressBarDomId, sparqlCount, errorMessage)
  }

  toggleShowOnlyHasAnswers() {
    document.querySelector(`#${this.progressBarDomId}`)
      .classList.toggle('show-only-has-answers')
  }
}
