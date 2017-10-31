const bindHandlerToCheckbox = require('./bind-handler-to-checkbox')
const show = require('./show')
const progressDetail = require('./progress-detail')
const progressSimple = require('./progress-simple')
const stop = require('./stop')

module.exports = class {
  constructor(name, parent, domSelector) {
    this.name = name
    this.dom = parent.querySelector(`${domSelector}`)
  }

  show(sparqls, onChcekChange) {
    show(this.dom, this.name, sparqls.length, onChcekChange)

    // To switch showing detail of progress
    bindHandlerToCheckbox(this.dom, '.show-detail-progress-bar', () => this.toggleDetail())
    // To switch appearance of sparqls
    bindHandlerToCheckbox(this.dom, '.show-only-has-answers', () => this.toggleShowOnlyHasAnswers())
  }

  progress(solutions, sparqlCount, focusNode, sparqlTimeout) {
    progressSimple(this.dom, sparqlCount)
    progressDetail(this.dom, solutions, sparqlCount, focusNode, sparqlTimeout)
  }

  stop(sparqlCount, errorMessage) {
    stop(this.dom, sparqlCount, errorMessage)
  }

  toggleShowOnlyHasAnswers() {
    this.dom.querySelector('.progress-bar__detail-progress-bar')
      .classList.toggle('progress-bar__detail-progress-bar--show-only-has-answers')
  }

  toggleDetail() {
    this.dom.querySelector('.progress-bar__detail-progress-bar')
      .classList.toggle('progress-bar__detail-progress-bar--hidden')
  }
}
