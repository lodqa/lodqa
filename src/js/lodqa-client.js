const Loader = require('./loader/loadSolution')
const bindResult = require('./controller/bindResult')
const bindWebsocketPresentation = require('./controller/bindWebsocketPresentation')
const bindParseRenderingPresentation = require('./controller/bindParseRenderingPresentation')
const bindSearchButton = require('./controller/bindSearchButton')
const anchoredPgpTablePresentation = require('./presentation/anchoredPgpTablePresentation')
const sparqlTablePresentation = require('./presentation/sparqlTablePresentation')
const solutionTablePresentation = require('./presentation/solutionTablePresentation')
const graphPresentation = require('./presentation/graphPresentation')

document.addEventListener('DOMContentLoaded', init)

function init() {
  const loader = new Loader()

  bindResult.anchoredPgp(loader, anchoredPgpTablePresentation)
  bindResult.all(loader, sparqlTablePresentation)
  bindResult.all(loader, solutionTablePresentation)
  bindResult.all(loader, graphPresentation)

  bindWebsocketPresentation(loader)
  bindParseRenderingPresentation(loader)
  bindSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => sparqlTablePresentation.setVerbose(event.target.checked))
}
