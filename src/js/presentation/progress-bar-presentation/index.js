const show = require('./show')
const progress = require('./progress')
const stop = require('./stop')

module.exports = class {
  constructor(progressBarDomId) {
    this.progressBarDomId = progressBarDomId
  }

  show(sparqls, onSparqlClick, onChcekChange) {
    show(this.progressBarDomId, sparqls.length, (sparqlCount) => onSparqlClick(sparqlCount, sparqls[sparqlCount - 1]), onChcekChange)
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
