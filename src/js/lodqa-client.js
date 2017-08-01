const Loader = require('./loader/loadSolution')
const BindResult = require('./controller/bindResult')
const bindWebsocketPresentation = require('./controller/bindWebsocketPresentation')
const bindParseRenderingPresentation = require('./controller/bindParseRenderingPresentation')
const bindSearchButton = require('./controller/bindSearchButton')
const bindStopSearchButton = require('./controller/bindStopSearchButton')
const anchoredPgpTablePresentation = require('./presentation/anchoredPgpTablePresentation')
const answersPresentation = require('./presentation/answers-presentation')
const sparqlPresentation = require('./presentation/sparqlPresentation')
const LabelFinder = require('./label-finder')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const bindResult = new BindResult(loader, 'lodqa-results')
  const labelFinder = new LabelFinder(answersPresentation)

  bindResult({
    sparqlCount: [
      sparqlPresentation.setSparqlCount
    ],
    anchoredPgp: [
      anchoredPgpTablePresentation.onAnchoredPgp,
      answersPresentation.onAnchoredPgp,
      labelFinder.onAnchoredPgp
    ],
    solution: [
      sparqlPresentation.onSolution,
      answersPresentation.onSolution,
      (domId, data) => labelFinder.onSolution(data)
    ]
  })

  bindWebsocketPresentation(loader)
  bindParseRenderingPresentation(loader)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => sparqlPresentation.setVerbose(event.target.checked))
}
