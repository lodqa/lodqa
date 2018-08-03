const getDataset = require('./get-dataset')

module.exports = function(datasets, datasetName, sparql, anchored_pgp) {
  const dataset = getDataset(datasets, datasetName)
  if (!dataset.has(sparql.number)) {
    dataset.set(sparql.number, {
      anchoredPgp: anchored_pgp,
      sparql: sparql.query
    })
  }
}
