const Dataset = require('./dataset')

module.exports = class DatasetContainer {
  constructor() {
    this._dataset = new Map()
    this._datasetOrder = []
  }

  addDataset(dataset) {
    if (!this._dataset.has(dataset)) {
      const datasetNumber = this._getDatasetNumber(dataset)
      this._dataset.set(dataset, new Dataset(dataset, datasetNumber))
    }
  }

  addSparql(dataset, sparql) {
    if (this._dataset.has(dataset)) {
      dataset = this._dataset.get(dataset)
      dataset.addSparql(sparql)
    }
  }

  getSparqlNumer(dataset, sparql) {
    if (this._dataset.has(dataset)) {
      dataset = this._dataset.get(dataset)
      const sparqlNumber = dataset.getSparqlNumer(sparql)

      return {
        datasetName: dataset.name,
        datasetNumber: dataset.number,
        sparqlNumber
      }
    }
  }

  _getDatasetNumber(dataset) {
    if (this._datasetOrder.indexOf(dataset) - 1) {
      this._datasetOrder.push(dataset)
    }
    return this._datasetOrder.indexOf(dataset) + 1
  }
}
