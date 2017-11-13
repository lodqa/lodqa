const SimpleProgressBar = require('./simple-progress-bar')
const DetailProgressBar = require('./detail-progress-bar')
const bindHandlerToCheckbox = require('./bind-handler-to-checkbox')

module.exports = class {
  constructor(dom, model, name = '') {
    this.dom = dom
    this.name = name

    // Bind Model's events
    const onSparqlReset = () => show(
      this,
      this.dom,
      model.sparqlsMax,
      (sparqlCount, isHide) => model.updateSparqlHideStatus(sparqlCount, isHide)
    )
    const onSolutionAdd = () => progress(
      this.simpleProgressBar,
      this.detailProgressBar,
      model.currentSolution.solutions,
      model.currentSolution.sparql_timeout,
      model.sparqlCount,
      model.focus
    )

    model.on('sparql_reset_event', onSparqlReset)
    model.on('solution_add_event', onSolutionAdd)
    model.on('error', (data) => this.stop(model.sparqlCount, data))
    model.on('ws_close', () => this.stop(model.sparqlCount))
  }

  stop(sparqlCount, errorMessage) {
    this.detailProgressBar.stop(sparqlCount, errorMessage)
  }
}

function show(progressBar, dom, max, onChcekChange) {
  // Clear old components.
  dom.innerHTML = ''

  // Append new components
  const simpleProgressBar = new SimpleProgressBar(dom, this.name, max)
  const detailProgressBar = new DetailProgressBar(dom, this.name, max, onChcekChange)

  // To switch showing detail of progress
  bindHandlerToCheckbox(simpleProgressBar.dom, '.show-detail-progress-bar', () => detailProgressBar.toggleDetail())

  progressBar.simpleProgressBar = simpleProgressBar
  progressBar.detailProgressBar = detailProgressBar
}

function progress(simpleProgressBar, detailProgressBar, solutions, sparqlTimeout, sparqlCount, focusNode) {
  simpleProgressBar.progress(sparqlCount)
  detailProgressBar.progress(solutions, sparqlCount, focusNode, sparqlTimeout)
}
