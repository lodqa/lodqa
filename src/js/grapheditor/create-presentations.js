const LoadingPresentation = require('../presentation/loading-presentation')
const AnchoredPgpTablePresentation = require('../presentation/anchored-pgp-table-presentation')
const AnswersPresentation = require('../presentation/answers-presentation')
const SparqlPresentation = require('../presentation/sparql-presentation')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')

module.exports = function(model, {
  resultSelector,
  progressSelector,
  progressBarSelector
}) {
  const resultDom = document.querySelector(resultSelector)
  new AnchoredPgpTablePresentation(resultDom, model)
  new SparqlPresentation(resultDom, model)
  new AnswersPresentation(resultDom, model)

  new LoadingPresentation(document.querySelector(progressSelector), model)
  new ProgressBarPresentation(document.querySelector(progressBarSelector), model)
}
