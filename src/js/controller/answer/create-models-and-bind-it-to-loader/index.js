const prepareMessage = require('./prepare-message')
const prepareAnswerSummary = require('./prepare-answer-summary')
const prepareAnswerMedia = require('./prepare-answer-media')
const prepareProgressbars = require('./prepare-progressbars')
const SparqlInformatianContainer = require('../../../model/sparql-information-container')
const FooterPresentation = require('../../../presentation/footer-presentation')
const Footer = require('../../../model/footer')

module.exports = function(loader) {
  // Message
  prepareMessage(loader)

  // Answer Summary
  const answerSummary = prepareAnswerSummary(loader)

  // Answer Media
  prepareAnswerMedia(loader)

  // Progress Bars
  const {
    summaryProgress,
    datasetsProgress,
    filterSparqlWithAnswer
  } = prepareProgressbars(loader)

  // SPARQL information container for the SPARQL links
  const sparqlInformatianContainer = new SparqlInformatianContainer(loader)

  new FooterPresentation(document.querySelector('#footer'), new Footer(loader))

  return {
    answerSummary,
    summaryProgress,
    datasetsProgress,
    filterSparqlWithAnswer,
    sparqlInformatianContainer
  }
}
