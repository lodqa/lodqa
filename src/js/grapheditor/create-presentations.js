const LoadingPresentation = require('../presentation/loading-presentation')
const AnchoredPgpTablePresentation = require('../presentation/anchored-pgp-table-presentation')
const AnswersPresentation = require('../presentation/answers-presentation')
const SparqlPresentation = require('../presentation/sparql-presentation')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')

module.exports = function(dataset, {
  resultSelector,
  progressSelector,
  progressBarSelector
}, integratedDataset) {
  const resultDom = document.querySelector(resultSelector)
  new AnchoredPgpTablePresentation(resultDom, dataset)
  new SparqlPresentation(resultDom, dataset)
  new AnswersPresentation(resultDom, dataset)

  new LoadingPresentation(document.querySelector(progressSelector), dataset)
  new ProgressBarPresentation(document.querySelector(progressBarSelector), integratedDataset, 'static', dataset)
}
