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

  getDatasetNumer(dataset) {
    if (this._dataset.has(dataset)) {
      dataset = this._dataset.get(dataset)

      return {
        datasetName: dataset.name,
        datasetNumber: dataset.number
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
