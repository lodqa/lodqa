const showAndBindSimpleProgeressBar = require('./show-and-bind-simple-progress-bar')

module.exports = function(dom, integratedDataset, dataset) {
  // Bind the Dataset's events
  const onSparqlReset = () => showAndBindSimpleProgeressBar(dom, integratedDataset, dataset)
  dataset.once('sparql_reset_event', onSparqlReset)
}
