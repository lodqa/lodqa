const bindCheckboxToToggleShowOnlyHasAnswers = require('../../answer/bind-checkbox-to-toggle-show-only-has-answers')
const show = require('./show')
const progress = require('./progress')
const stop = require('./stop')

module.exports = class {
  constructor(progressBarDomId) {
    this.progressBarDomId = progressBarDomId
  }

  show(sparqls, onChcekChange) {
    show(this.progressBarDomId, sparqls.length, onChcekChange)

    // Bind a handler to switch appearance of sparqls
    bindCheckboxToToggleShowOnlyHasAnswers('show-only-has-answers', this)
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
