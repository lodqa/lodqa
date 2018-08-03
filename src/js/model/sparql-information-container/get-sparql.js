const getDataset = require('./get-dataset')
const setSparql = require('./set-sparql')

module.exports = function(datasets, datasetName, sparql, anchored_pgp) {
  // Supports out-of-order events
  setSparql(datasets, datasetName, sparql, anchored_pgp)
  return getDataset(datasets, datasetName)
    .get(sparql.number)
}
