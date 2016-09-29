const Loader = require('./loader/loadSolution')
const bindResult = require('./controller/bindResult')
const bindWebsocketPresentation = require('./controller/bindWebsocketPresentation')
const bindParseRenderingPresentation = require('./controller/bindParseRenderingPresentation')
const bindSearchButton = require('./controller/bindSearchButton')
const bindStopSearchButton = require('./controller/bindStopSearchButton')
const anchoredPgpTablePresentation = require('./presentation/anchoredPgpTablePresentation')
const answerListPresentation = require('./presentation/answerListPresentation')
const sparqlPresentation = require('./presentation/sparqlPresentation')
const solutionTablePresentation = require('./presentation/solutionTablePresentation')
const graphPresentation = require('./presentation/graphPresentation')

document.addEventListener('DOMContentLoaded', init)

function init() {
  const loader = new Loader()

  bindResult.anchoredPgp(loader, anchoredPgpTablePresentation)
  bindResult.solution(loader, sparqlPresentation)
  bindResult.all(loader, answerListPresentation)
  bindResult.solution(loader, solutionTablePresentation)
  bindResult.all(loader, graphPresentation)

  bindWebsocketPresentation(loader)
  bindParseRenderingPresentation(loader)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => sparqlPresentation.setVerbose(event.target.checked))
}
