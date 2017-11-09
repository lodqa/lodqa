const bindEvents = require('../controller/bind-events')
const LoadingPresentation = require('../presentation/loading-presentation')
const AnchoredPgpTablePresentation = require('../presentation/anchored-pgp-table-presentation')
const AnswersPresentation = require('../presentation/answers-presentation')
const SparqlPresentation = require('../presentation/sparql-presentation')

module.exports = function(loader, resultDomId, progressDomId, isVerbose, model, progressBarPresentation) {
  new AnchoredPgpTablePresentation(resultDomId, model)
  new AnswersPresentation(resultDomId, model)
  new SparqlPresentation(resultDomId, isVerbose, model)

  const loadingPresentation = new LoadingPresentation(progressDomId, model)

  bindEvents(loader, {
    ws_open: [
      () => loadingPresentation.show()
    ],
    ws_close: [
      () => loadingPresentation.hide(),
      () => progressBarPresentation.stop(model.sparqlCount)
    ],
    error: [
      (data) => progressBarPresentation.stop(model.sparqlCount, data)
    ]
  })
}
