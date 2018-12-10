const getDataset = require('./get-dataset')

module.exports = function(datasets, datasetName, sparql) {
  console.assert(datasets, 'datasets is not set')
  console.assert(datasetName, 'datasetName is not set')
  console.assert(sparql, 'sparql is not set')

  return getDataset(datasets, datasetName)
    .get(sparql.number)
}
