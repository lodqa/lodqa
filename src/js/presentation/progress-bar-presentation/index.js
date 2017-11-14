const SimpleProgressBar = require('./simple-progress-bar')
const DetailProgressBar = require('./detail-progress-bar')

module.exports = class {
  constructor(dom, model, name = '') {
    this._dom = dom
    this._name = name

    // Bind Model's events
    const onSparqlReset = () => {
      const [simpleProgressBar, detailProgressBar] = show(
        this._dom,
        this._name,
        model.sparqlsMax,
        (sparqlCount, isHide) => model.updateSparqlHideStatus(sparqlCount, isHide)
      )

      this._simpleProgressBar = simpleProgressBar
      this._detailProgressBar = detailProgressBar
    }
    const onSolutionAdd = () => progress(
      this._simpleProgressBar,
      this._detailProgressBar,
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
    this._detailProgressBar.stop(sparqlCount, errorMessage)
  }
}

function show(dom, name, max, onChcekChange) {
  // Clear old components.
  dom.innerHTML = ''

  // Append new components
  const detailProgressBar = new DetailProgressBar(name, max, onChcekChange)
  const simpleProgressBar = new SimpleProgressBar(name, max, detailProgressBar)
  dom.appendChild(simpleProgressBar.dom)
  dom.appendChild(detailProgressBar.dom)

  return [simpleProgressBar, detailProgressBar]
}

function progress(simpleProgressBar, detailProgressBar, solutions, sparqlTimeout, sparqlCount, focusNode) {
  simpleProgressBar.progress(sparqlCount)
  detailProgressBar.progress(solutions, sparqlCount, focusNode, sparqlTimeout)
}
