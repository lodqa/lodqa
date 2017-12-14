const SparqlAndAnswersPresentation = require('../presentation/sparql-and-answers-presentation')

module.exports = function (parent, sparqlDomId, sparqlContainer) {
  // Create and bind a handler to show sparql presentation
  const sparqlAndAnswersPresentation = new SparqlAndAnswersPresentation(sparqlDomId, () => {})
  const eventHandler = (datasetName, sparqlNumber) => {
    const {
      anchoredPgp,
      sparql,
      solutions,
      answers,
      error
    } = sparqlContainer.getSparql(datasetName, sparqlNumber)
    sparqlAndAnswersPresentation.show2(sparqlNumber, datasetName, anchoredPgp, sparql, solutions, answers, error)
  }
  document.querySelector('.content')
    .addEventListener('click', ({target}) => {
      if (target.closest('.sparql-link')) {
        if (target.dataset.datasetName && target.dataset.sparqlNumber) {
          eventHandler(target.dataset.datasetName, target.dataset.sparqlNumber)
        }
      }
    })
}
