const SparqlAndAnswersPresentation = require('../presentation/sparql-and-answers-presentation')
const createHandlerForKeyEvents = require('./create-handler-for-key-events')
const bindOneKeyupHandler = require('./bind-one-keyup-handler')
const bindSparqlLinkClick = require('./bind-sparql-link-click')

module.exports = function bindHandlerToShowSparql(parent, linkContainerDomSelectors, sparqlDomId, dataset, loaders) {
  const stopSearchIfEsc = createHandlerForKeyEvents(loaders)

  // Create and bind a handler to show sparql presentation
  const sparqlAndAnswersPresentation = new SparqlAndAnswersPresentation(sparqlDomId, () => bindOneKeyupHandler(stopSearchIfEsc))
  bindSparqlLinkClick(parent, linkContainerDomSelectors, (sparqlCount) => sparqlAndAnswersPresentation.show(sparqlCount, dataset.getSparql(sparqlCount), dataset.getSolution(sparqlCount)))
}
