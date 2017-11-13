const SimpleProgressBar = require('./simple-progress-bar')
const DetailProgressBar = require('./detail-progress-bar')
const bindHandlerToCheckbox = require('./bind-handler-to-checkbox')

module.exports = class {
  constructor(dom, model, name = '') {
    this.dom = dom
    this.name = name

    const onSparqlReset = (sparqls) => show(
      this,
      this.dom,
      sparqls,
      (sparqlCount, isHide) => model.updateSparqlHideStatus(sparqlCount, isHide)
    )
    const onSolutionAdd = (currentSolution) => progress(
      this.simpleProgressBar,
      this.detailProgressBar,
      currentSolution.solutions,
      currentSolution.sparql_timeout,
      model.sparqlCount,
      model.focus
    )

    model.on('sparql_reset_event', onSparqlReset)
    model.on('solution_add_event', onSolutionAdd)
  }

  stop(sparqlCount, errorMessage) {
    this.detailProgressBar.stop(sparqlCount, errorMessage)
  }
}

function show(progressBar, dom, sparqls, onChcekChange) {
  // Clear old components.
  dom.innerHTML = ''

  // Append new components
  const simpleProgressBar = new SimpleProgressBar(dom, this.name, sparqls.length)
  const detailProgressBar = new DetailProgressBar(dom, this.name, sparqls.length, onChcekChange)

  // To switch showing detail of progress
  bindHandlerToCheckbox(simpleProgressBar.dom, '.show-detail-progress-bar', () => detailProgressBar.toggleDetail())

  progressBar.simpleProgressBar = simpleProgressBar
  progressBar.detailProgressBar = detailProgressBar
}

function progress(simpleProgressBar, detailProgressBar, solutions, sparqlTimeout, sparqlCount, focusNode) {
  simpleProgressBar.progress(sparqlCount)
  detailProgressBar.progress(solutions, sparqlCount, focusNode, sparqlTimeout)
}
