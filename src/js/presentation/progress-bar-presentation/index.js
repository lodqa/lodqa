const SimpleProgressBar = require('./simple-progress-bar')
const DetailProgressBar = require('./detail-progress-bar')
const bindHandlerToCheckbox = require('./bind-handler-to-checkbox')

module.exports = class {
  constructor(dom, name = '') {
    this.dom = dom
    this.name = name
  }

  show(sparqls, onChcekChange) {
    // Clear old components.
    this.dom.innerHTML = ''

    // Append new components
    const simpleProgressBar = new SimpleProgressBar(this.dom, this.name, sparqls.length)
    const detailProgressBar = new DetailProgressBar(this.dom, this.name, sparqls.length, onChcekChange)

    // To switch showing detail of progress
    bindHandlerToCheckbox(simpleProgressBar.dom, '.show-detail-progress-bar', () => detailProgressBar.toggleDetail())

    this.simpleProgressBar = simpleProgressBar
    this.detailProgressBar = detailProgressBar
  }

  progress(solutions, sparqlCount, focusNode, sparqlTimeout) {
    this.simpleProgressBar.progress(sparqlCount)
    this.detailProgressBar.progress(solutions, sparqlCount, focusNode, sparqlTimeout)
  }

  stop(sparqlCount, errorMessage) {
    this.detailProgressBar.stop(sparqlCount, errorMessage)
  }
}
