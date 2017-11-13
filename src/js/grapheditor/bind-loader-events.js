const LoadingPresentation = require('../presentation/loading-presentation')
const AnchoredPgpTablePresentation = require('../presentation/anchored-pgp-table-presentation')
const AnswersPresentation = require('../presentation/answers-presentation')
const SparqlPresentation = require('../presentation/sparql-presentation')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')
const getEndpointInformationFromDom = require('../grapheditor/get-endpoint-information-from-dom')

module.exports = function(resultDomId, progressDomId, isVerbose, model) {
  new AnchoredPgpTablePresentation(resultDomId, model)
  new AnswersPresentation(resultDomId, model, getEndpointInformationFromDom())
  new SparqlPresentation(resultDomId, isVerbose, model)
  new LoadingPresentation(progressDomId, model)
  new ProgressBarPresentation(document.querySelector('#progress-bar'), model)
}
