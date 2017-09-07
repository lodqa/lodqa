const bindHandlerToCheckbox = require('./bind-handler-to-checkbox')
const show = require('./show')
const progressDetail = require('./progress-detail')
const progressSimple = require('./progress-simple')
const stop = require('./stop')

module.exports = class {
  constructor(progressBarDomId) {
    this.progressBarDomId = progressBarDomId
  }

  show(sparqls, onChcekChange) {
    show(this.progressBarDomId, sparqls.length, onChcekChange)

    // To switch showing detail of progress
    bindHandlerToCheckbox('show-detail-progress-bar', () => this.toggleDetail())
    // To switch appearance of sparqls
    bindHandlerToCheckbox('show-only-has-answers', () => this.toggleShowOnlyHasAnswers())
  }

  progress(solutions, sparqlCount, focusNode, sparqlTimeout) {
    progressSimple(this.progressBarDomId, sparqlCount)
    progressDetail(this.progressBarDomId, solutions, sparqlCount, focusNode, sparqlTimeout)
  }

  stop(sparqlCount, errorMessage) {
    stop(this.progressBarDomId, sparqlCount, errorMessage)
  }

  toggleShowOnlyHasAnswers() {
    document.querySelector(`#${this.progressBarDomId} .progress-bar__detail-progress-bar`)
      .classList.toggle('progress-bar__detail-progress-bar--show-only-has-answers')
  }

  toggleDetail() {
    document.querySelector(`#${this.progressBarDomId} .progress-bar__detail-progress-bar`)
      .classList.toggle('progress-bar__detail-progress-bar--hidden')
  }
}
