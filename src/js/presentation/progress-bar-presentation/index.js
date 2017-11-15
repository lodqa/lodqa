const SimpleProgressBar = require('./simple-progress-bar')
const DetailProgressBar = require('./detail-progress-bar')

module.exports = class {
  constructor(dom, integratedDataset, name, dataset, detailProgressBarDom) {
    this._dom = dom
    this._name = name

    const detailProgressBarHolder = detailProgressBarDom || dom

    // Setup the DetailProgressBar
    const detailProgressBar = {
      instance: null,
      listener: null
    }
    const onAnswerButtonClick = (sparqlNumber, isHide) => dataset.updateSparqlHideStatus(sparqlNumber, isHide)
    integratedDataset.on('dataset_displaying_detail_update_event', (selectedName, selectedDataset) => {
      if (selectedName === name) {
        detailProgressBar.instance = new DetailProgressBar(name, onAnswerButtonClick)
        detailProgressBar.instance.showCurrentStatus(selectedDataset.currentStatusOfSparqls)
        detailProgressBarHolder.appendChild(detailProgressBar.instance.dom)
        detailProgressBar.listner = () => detailProgressBar.instance.progress(selectedDataset.currentUniqAnswersLength, selectedDataset.sparqlCount, selectedDataset.currentSolution.sparqlTimeout)
        selectedDataset.on('solution_add_event', detailProgressBar.listner)
      } else {
        if (detailProgressBar.instance && detailProgressBar.instance.dom.parentElement) {
          detailProgressBarHolder.removeChild(detailProgressBar.instance.dom)
          dataset.removeListener('solution_add_event', detailProgressBar.listner)
        }

        if (this._simpleProgressBar) {
          this._simpleProgressBar.checked = false
        }
      }
    })

    // Bind Model's events
    const toggleDetailProgressBar = (isShow) => {
      if (isShow) {
        integratedDataset.displayingDetail = name
      } else {
        integratedDataset.displayingDetail = ''
      }
    }
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
