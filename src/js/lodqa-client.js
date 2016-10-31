const Loader = require('./loader/loadSolution')
const bindResult = require('./controller/bindResult')
const bindWebsocketPresentation = require('./controller/bindWebsocketPresentation')
const bindParseRenderingPresentation = require('./controller/bindParseRenderingPresentation')
const bindSearchButton = require('./controller/bindSearchButton')
const bindStopSearchButton = require('./controller/bindStopSearchButton')
const anchoredPgpTablePresentation = require('./presentation/anchoredPgpTablePresentation')
const answerListPresentation = require('./presentation/answerListPresentation')
const sparqlPresentation = require('./presentation/sparqlPresentation')
const LabelFinder = require('./label-finder')

document.addEventListener('DOMContentLoaded', init)

function init() {
  const loader = new Loader()

  bindResult.anchoredPgp(loader, anchoredPgpTablePresentation)
  bindResult.sparqlCount(loader, sparqlPresentation)
  bindResult.solution(loader, sparqlPresentation)
  bindResult.all(loader, answerListPresentation)
  bindResult.all(loader, new LabelFinder(answerListPresentation))

  bindWebsocketPresentation(loader)
  bindParseRenderingPresentation(loader)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => sparqlPresentation.setVerbose(event.target.checked))
}
