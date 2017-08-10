const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const bindSearchButton = require('./controller/bind-search-button')
const bindStopSearchButton = require('./controller/bind-stop-search-button')
const anchoredPgpTablePresentation = require('./presentation/anchored-pgp-table-Presentation')
const answersPresentation = require('./presentation/answers-presentation')
const sparqlPresentation = require('./presentation/sparql-presentation')
const SparqlCount = require('./sparql-count')
const ProgressPresentation = require('./presentation/progress-presentation')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const bindResult = new BindResult(loader.eventEmitter)
  const sparqlCount = new SparqlCount()
  const domId = 'lodqa-results'
  const progressPresentation = ProgressPresentation('lodqa-messages')

  bindResult({
    wsOpen: [
      progressPresentation.show
    ],
    wsClose: [
      progressPresentation.hide
    ],
    sparqlCount: [
      () => sparqlCount.reset(),
      progressPresentation.setTotal
    ],
    anchoredPgp: [
      (data) => anchoredPgpTablePresentation.showAnchoredPgp(domId, data),
      (data) => answersPresentation.setAnchoredPgp(domId, data)
    ],
    solution: [
      () => sparqlCount.increment(),
      (data) => sparqlPresentation.show(domId, data, sparqlCount.count),
      (data) => answersPresentation.showSolution(domId, data),
      progressPresentation.updateProgress
    ]
  })

  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => sparqlPresentation.setVerbose(event.target.checked))
}
