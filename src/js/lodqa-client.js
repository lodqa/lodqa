const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const bindSearchButton = require('./controller/bind-search-button')
const bindStopSearchButton = require('./controller/bind-stop-search-button')
const anchoredPgpTablePresentation = require('./presentation/anchored-pgp-table-presentation')
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
  let isVerbose = false

  bindResult({
    ws_open: [
      progressPresentation.show
    ],
    ws_close: [
      progressPresentation.hide
    ],
    sparqls: [
      () => sparqlCount.reset(),
      (sparqls) => progressPresentation.setTotal(sparqls.length)
    ],
    anchored_pgp: [
      (data) => anchoredPgpTablePresentation.showAnchoredPgp(domId, data),
      (data) => answersPresentation.setAnchoredPgp(data)
    ],
    solution: [
      () => sparqlCount.increment(),
      (data) => {
        if(data.solutions.length !== 0 || isVerbose){
          sparqlPresentation.show(document.querySelector(`#${domId}`), sparqlCount.count, data.sparql, data.sparql_timeout)
        }
      },
      (data) => answersPresentation.showSolution(document.querySelector(`#${domId}`), data),
      progressPresentation.updateProgress
    ]
  })

  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => isVerbose = event.target.checked)
}
