const Model = require('../model')
const BindResult = require('../controller/bind-result')
const LoadingPresentation = require('../presentation/loading-presentation')
const anchoredPgpTablePresentation = require('../presentation/anchored-pgp-table-presentation')
const answersPresentation = require('../presentation/answers-presentation')
const sparqlPresentation = require('../presentation/sparql-presentation')

module.exports = function(loader, resultDomId, progressDomId, isVerbose) {
  const model = new Model()
  const bindResult = new BindResult(loader.eventEmitter)
  const loadingPresentation = LoadingPresentation(progressDomId)


  bindResult({
    ws_open: [
      loadingPresentation.show
    ],
    ws_close: [
      loadingPresentation.hide
    ],
    sparqls: [
      () => model.resetSpraqlCount(),
      (sparqls) => loadingPresentation.setTotal(sparqls.length)
    ],
    anchored_pgp: [
      (data) => anchoredPgpTablePresentation.showAnchoredPgp(resultDomId, data),
      (data) => answersPresentation.setAnchoredPgp(data)
    ],
    solution: [
      () => model.incrementSparqlCount(),
      (data) => {
        if (data.solutions.length !== 0 || isVerbose.value) {
          sparqlPresentation.show(document.querySelector(`#${resultDomId}`), model.sparqlCount, data.sparql, data.sparql_timeout)
        }
      },
      (data) => answersPresentation.showSolution(document.querySelector(`#${resultDomId}`), data),
      loadingPresentation.updateProgress
    ]
  })
}
