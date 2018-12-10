const getDataset = require('./get-dataset')
const setSparql = require('./set-sparql')

module.exports = function(datasets, datasetName, sparql, anchored_pgp) {
  console.assert(datasets, 'datasets is not set')
  console.assert(datasetName, 'datasetName is not set')
  console.assert(sparql, 'sparql is not set')
  console.assert(anchored_pgp, 'anchored_pgp is not set')

  // Supports out-of-order events
  setSparql(datasets, datasetName, sparql, anchored_pgp)
  return getDataset(datasets, datasetName)
    .get(sparql.number)
}
