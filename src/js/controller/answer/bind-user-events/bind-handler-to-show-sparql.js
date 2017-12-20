const SparqlAndAnswersPresentation = require('../../../presentation/sparql-and-answers-presentation')

module.exports = function (parent, displayAreaDomId, model) {
  // Create and bind a handler to show sparql presentation
  const sparqlAndAnswersPresentation = new SparqlAndAnswersPresentation(displayAreaDomId, () => {})
  const eventHandler = (datasetName, sparqlNumber) => {
    const {
      anchoredPgp,
      sparql,
      solutions,
      answers,
      error
    } = model.getSparql(datasetName, sparqlNumber)
    sparqlAndAnswersPresentation.show(sparqlNumber, datasetName, anchoredPgp, sparql, solutions, answers, error)
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
