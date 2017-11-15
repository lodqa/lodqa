const SimpleProgressBar = require('./simple-progress-bar')
const DetailProgressBar = require('./detail-progress-bar')

module.exports = class {
  constructor(dom, integratedDataset, name, dataset, detailProgressBarDom) {
    this._dom = dom
    this._name = name

    const detailProgressBarHolder = detailProgressBarDom || dom

    // Setup the DetailProgressBar
    const detailProgressBar = {
      instance: null
    }
    const onAnswerButtonClick = (sparqlNumber, isHide) => dataset.updateSparqlHideStatus(sparqlNumber, isHide)
    integratedDataset.on('dataset_displaying_detail_update_event', (selectedName, selectedDataset) => {
      if (selectedName === name) {
        detailProgressBar.instance = new DetailProgressBar(name, onAnswerButtonClick)
        detailProgressBar.instance.showCurrentStatus(selectedDataset.currentStatusOfSparqls)
        detailProgressBarHolder.appendChild(detailProgressBar.instance.dom)
        detailProgressBar.instance.dataset = selectedDataset
      } else {
        if (detailProgressBar.instance && detailProgressBar.instance.dom.parentElement) {
          detailProgressBarHolder.removeChild(detailProgressBar.instance.dom)
          detailProgressBar.instance.dataset = null
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
