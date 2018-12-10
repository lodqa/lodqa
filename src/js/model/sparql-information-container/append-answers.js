const getDataset = require('./get-dataset')
const Sparql = require('./sparql')

module.exports = function(datasets, datasetName, sparql, anchoredPgp, answers) {
  const dataset = getDataset(datasets, datasetName)
  if (dataset.has(sparql.number)) {
    // Update an existing sparql.
    dataset.get(sparql.number)
      .append(answers)
  } else {
    const s = new Sparql(anchoredPgp, sparql.query)
      .append(answers)
    dataset.set(sparql.number, s)
  }
}
