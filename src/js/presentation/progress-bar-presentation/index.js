const SimpleProgressBar = require('./simple-progress-bar')
const DetailProgressBar = require('./detail-progress-bar')

module.exports = class {
  constructor(dom, model, name = '') {
    this._dom = dom
    this._name = name

    // Setup the DetailProgressBar
    const detailProgressBar = {
      instance: null,
      listener: null
    }
    const onAnswerButtonClick = (sparqlNumber, isHide) => model.updateSparqlHideStatus(sparqlNumber, isHide)
    const toggleDetailProgressBar = (isShow) => {
      if (isShow) {
        detailProgressBar.instance = new DetailProgressBar(name, onAnswerButtonClick, model.currentStatusOfSparqls)
        dom.appendChild(detailProgressBar.instance.dom)
        detailProgressBar.listner = () => detailProgressBar.instance.progress(model.currentSolution.solutions, model.sparqlCount, model.focus, model.currentSolution.sparqlTimeout)
        model.on('solution_add_event', detailProgressBar.listner)
      } else {
        dom.removeChild(detailProgressBar.instance.dom)
        model.removeListener('solution_add_event', detailProgressBar.listner)
      }
    }

    // Bind Model's events
    const onSparqlReset = () => {
      const simpleProgressBar = show(
        this._dom,
        this._name,
        model.sparqlsMax,
        toggleDetailProgressBar
      )

      this._simpleProgressBar = simpleProgressBar
    }
    const onSolutionAdd = () => this._simpleProgressBar.progress(model.sparqlCount)

    model.on('sparql_reset_event', onSparqlReset)
    model.on('solution_add_event', onSolutionAdd)
    model.on('error', () => this.stop(model.sparqlCount, model.errorMessage))
    model.on('ws_close', () => this.stop(model.sparqlCount))
  }

  stop(sparqlCount, errorMessage) {
    // The _detailProgressBar does not exist when an error occurs before returning SPARQLs.
    if (this._detailProgressBar) {
      this._detailProgressBar.stop(sparqlCount, errorMessage)
    }
  }
}

function show(dom, name, max, onClickDetailCheckbox) {
  // Clear old components.
  dom.innerHTML = ''

  // Append new components
  const simpleProgressBar = new SimpleProgressBar(name, max, onClickDetailCheckbox)
  dom.appendChild(simpleProgressBar.dom)

  return simpleProgressBar
}
