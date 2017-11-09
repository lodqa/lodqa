const Model = require('../model')
const bindEvents = require('../controller/bind-events')
const LoadingPresentation = require('../presentation/loading-presentation')
const anchoredPgpTablePresentation = require('../presentation/anchored-pgp-table-presentation')
const answersPresentation = require('../presentation/answers-presentation')
const sparqlPresentation = require('../presentation/sparql-presentation')

module.exports = function(loader, resultDomId, progressDomId, isVerbose, progressBarPresentation) {
  const model = new Model(loader)
  const loadingPresentation = LoadingPresentation(progressDomId)

  bindEvents(model, {
    'sparql_reset_event': [
      (sparqls) => loadingPresentation.setTotal(sparqls.length),
      (sparqls) => progressBarPresentation.show(
        sparqls,
        (sparqlCount, isHide) => model.updateSparqlHideStatus(sparqlCount, isHide)
      )
    ],
    'anchored_pgp_reset_event': [
      (anchoredPgp) => anchoredPgpTablePresentation.showAnchoredPgp(resultDomId, anchoredPgp),
      (anchoredPgp) => answersPresentation.setAnchoredPgp(anchoredPgp)
    ],
    'solution_add_event': [
      (solution) => {
        if (solution.solutions.length !== 0 || isVerbose.value) {
          sparqlPresentation.show(document.querySelector(`#${resultDomId}`), model.sparqlCount, solution.sparql, solution.sparql_timeout)
        }
      },
      (solution) => answersPresentation.showSolution(document.querySelector(`#${resultDomId}`), solution),
      loadingPresentation.updateProgress,
      (solution) => progressBarPresentation.progress(solution.solutions, model.sparqlCount, model.focus, solution.sparql_timeout)
    ]
  })

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
