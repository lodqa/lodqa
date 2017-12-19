const prepareMessage = require('./prepare-message')
const prepareAnswerSummary = require('./prepare-answer-summary')
const prepareProgressbars = require('./prepare-progressbars')
const SparqlInformatianContainer = require('../../model/sparql-information-container')

module.exports = function(loader) {
  // Message
  prepareMessage(loader)

  // Answer Summary
  const answerSummary = prepareAnswerSummary(loader)

  // Progress Bars
  const {
    summaryProgress,
    datasetsProgress,
    filterSparqlWithAnswer
  } = prepareProgressbars(loader)

  // SPARQL information container for the SPARQL links
  const sparqlInformatianContainer = new SparqlInformatianContainer(loader)

  return {
    answerSummary,
    summaryProgress,
    datasetsProgress,
    filterSparqlWithAnswer,
    sparqlInformatianContainer
  }
}
