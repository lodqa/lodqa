const LoadingPresentation = require('../presentation/loading-presentation')
const AnchoredPgpTablePresentation = require('../presentation/anchored-pgp-table-presentation')
const AnswersPresentation = require('../presentation/answers-presentation')
const SparqlPresentation = require('../presentation/sparql-presentation')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')

module.exports = function(loader, resultDomId, progressDomId, isVerbose, model) {
  new AnchoredPgpTablePresentation(resultDomId, model)
  new AnswersPresentation(resultDomId, model)
  new SparqlPresentation(resultDomId, isVerbose, model)
  new LoadingPresentation(progressDomId, model, loader)
  new ProgressBarPresentation(
    document.querySelector('#progress-bar'),
    model,
    loader
  )
}
