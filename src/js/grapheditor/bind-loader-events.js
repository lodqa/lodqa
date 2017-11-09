const Model = require('../model')
const bindEvents = require('../controller/bind-events')
const LoadingPresentation = require('../presentation/loading-presentation')
const anchoredPgpTablePresentation = require('../presentation/anchored-pgp-table-presentation')
const answersPresentation = require('../presentation/answers-presentation')
const sparqlPresentation = require('../presentation/sparql-presentation')

module.exports = function(loader, resultDomId, progressDomId, isVerbose, progressBarPresentation) {
  const model = new Model(loader)
  const loadingPresentation = LoadingPresentation(progressDomId)

  model.on('sparql_reset_event', (sparqls) => loadingPresentation.setTotal(sparqls.length))
  model.on('sparql_reset_event', (sparqls) => progressBarPresentation.show(
    sparqls,
    (sparqlCount, isHide) => model.updateSparqlHideStatus(sparqlCount, isHide)
  ))
  model.on('anchored_pgp_reset_event', (anchoredPgp) => anchoredPgpTablePresentation.showAnchoredPgp(resultDomId, anchoredPgp))
  model.on('anchored_pgp_reset_event', (anchoredPgp) => answersPresentation.setAnchoredPgp(anchoredPgp))
  model.on('solution_add_event', (solution) => {
    if (solution.solutions.length !== 0 || isVerbose.value) {
      sparqlPresentation.show(document.querySelector(`#${resultDomId}`), model.sparqlCount, solution.sparql, solution.sparql_timeout)
    }
  })
  model.on('solution_add_event', (solution) => answersPresentation.showSolution(document.querySelector(`#${resultDomId}`), solution))
  model.on('solution_add_event', loadingPresentation.updateProgress)
  model.on('solution_add_event', (solution) => progressBarPresentation.progress(solution.solutions, model.sparqlCount, model.focus, solution.sparql_timeout))

  bindEvents(loader, {
    ws_open: [
      loadingPresentation.show
    ],
    ws_close: [
      loadingPresentation.hide,
      () => progressBarPresentation.stop(model.sparqlCount)
    ],
    error: [
      (data) => progressBarPresentation.stop(model.sparqlCount, data)
    ]
  })
}
