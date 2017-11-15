const SimpleProgressBar = require('./simple-progress-bar')
const DetailProgressBar = require('./detail-progress-bar')

module.exports = class {
  constructor(dom, dataset, name = '') {
    this._dom = dom
    this._name = name

    // Setup the DetailProgressBar
    const detailProgressBar = {
      instance: null,
      listener: null
    }
    const onAnswerButtonClick = (sparqlNumber, isHide) => dataset.updateSparqlHideStatus(sparqlNumber, isHide)
    const toggleDetailProgressBar = (isShow) => {
      if (isShow) {
        detailProgressBar.instance = new DetailProgressBar(name, onAnswerButtonClick)
        detailProgressBar.instance.showCurrentStatus(dataset.currentStatusOfSparqls)
        dom.appendChild(detailProgressBar.instance.dom)
        detailProgressBar.listner = () => detailProgressBar.instance.progress(dataset.currentUniqAnswersLength, dataset.sparqlCount, dataset.currentSolution.sparqlTimeout)
        dataset.on('solution_add_event', detailProgressBar.listner)
      } else {
        dom.removeChild(detailProgressBar.instance.dom)
        dataset.removeListener('solution_add_event', detailProgressBar.listner)
      }
    }

    // Bind Model's events
    const onSparqlReset = () => {
      const simpleProgressBar = show(
        this._dom,
        this._name,
        dataset.sparqlsMax,
        toggleDetailProgressBar
      )

      this._simpleProgressBar = simpleProgressBar
    }
    const onSolutionAdd = () => this._simpleProgressBar.progress(dataset.sparqlCount)

    dataset.on('sparql_reset_event', onSparqlReset)
    dataset.on('solution_add_event', onSolutionAdd)
    dataset.on('error', () => this.stop(dataset.sparqlCount, dataset.errorMessage))
    dataset.on('ws_close', () => this.stop(dataset.sparqlCount))
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
