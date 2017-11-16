const showAndBindSimpleProgeressBar = require('./show-and-bind-simple-progress-bar')

module.exports = function(dom, integratedDataset, datasetName, dataset) {
  // Bind the Dataset's events
  const onSparqlReset = () => showAndBindSimpleProgeressBar(dom, integratedDataset, datasetName, dataset)
  dataset.on('sparql_reset_event', onSparqlReset)
}
