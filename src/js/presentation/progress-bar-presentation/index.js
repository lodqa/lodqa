const show = require('./show')

module.exports = class {
  constructor(dom, integratedDataset, datasetName, dataset) {
    this.dom = dom
    this._datasetName = datasetName

    // Bind the Integrated Dataset's event.
    integratedDataset.on('dataset_displaying_detail_update_event', (selectedName) => {
      // Uncheck the checkbox when a dataset other than mine is selected.
      if (selectedName !== datasetName && this._simpleProgressBar) {
        this._simpleProgressBar.checked = false
      }
    })

    // Bind the Dataset's events
    const onSparqlReset = () => {
      const toggleDetailProgressBar = (isShow) => {
        if (isShow) {
          integratedDataset.displayingDetail = datasetName
        } else {
          integratedDataset.displayingDetail = ''
        }
      }
      const simpleProgressBar = show(
        this.dom,
        this._datasetName,
        dataset.sparqlsMax,
        toggleDetailProgressBar
      )
      this._simpleProgressBar = simpleProgressBar
    }

    dataset.on('sparql_reset_event', onSparqlReset)

    // Progress the bar when solutions are added
    const progressOnSolutionAdd = () => this._simpleProgressBar.progress(dataset.sparqlCount)
    dataset.on('solution_add_event', progressOnSolutionAdd)
  }
}
