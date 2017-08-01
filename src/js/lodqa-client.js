const Loader = require('./loader/loadSolution')
const BindResult = require('./controller/bindResult')
const bindWebsocketPresentation = require('./controller/bindWebsocketPresentation')
const bindParseRenderingPresentation = require('./controller/bindParseRenderingPresentation')
const bindSearchButton = require('./controller/bindSearchButton')
const bindStopSearchButton = require('./controller/bindStopSearchButton')
const anchoredPgpTablePresentation = require('./presentation/anchoredPgpTablePresentation')
const answerListPresentation = require('./presentation/answerListPresentation')
const sparqlPresentation = require('./presentation/sparqlPresentation')
const LabelFinder = require('./label-finder')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const bindResult = new BindResult(loader, 'lodqa-results')
  const labelFinder = new LabelFinder(answerListPresentation)

  bindResult({
    sparqlCount: [
      sparqlPresentation.onSparqlCount
    ],
    anchoredPgp: [
      anchoredPgpTablePresentation.onAnchoredPgp,
      answerListPresentation.onAnchoredPgp,
      labelFinder.onAnchoredPgp
    ],
    solution: [
      sparqlPresentation.onSolution,
      answerListPresentation.onSolution,
      (data, domId) => labelFinder.onSolution(data, domId)
    ]
  })

  bindWebsocketPresentation(loader)
  bindParseRenderingPresentation(loader)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => sparqlPresentation.setVerbose(event.target.checked))
}
