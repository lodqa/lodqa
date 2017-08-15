const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const answerIndexPresentation = require('./presentation/answer-index-presentation')
const SparqlCount = require('./sparql-count')
const progressBarPresentation = require('./presentation/progress-bar-presentation')
const sparqlPresentation = require('./presentation/sparql-presentation')

const loader = new Loader()
const bindResult = new BindResult(loader.eventEmitter)
const sparqlCount = new SparqlCount()
const answerIndexnDomId = 'answer-index'
const progressBarDomId = 'progress-bar'
let anchoredPgp = null
const solution = new Map()

bindResult({
  sparql_count: [
    () => sparqlCount.reset(),
    (total) => progressBarPresentation.show(progressBarDomId, total, (sparqlCount) => sparqlPresentation(sparqlCount, anchoredPgp, solution.get(sparqlCount)))
  ],
  anchored_pgp: [
    (data) => anchoredPgp = data
  ],
  solution: [
    () => sparqlCount.increment(),
    (data) => solution.set(`${sparqlCount.count}`, data),
    (data) => answerIndexPresentation(answerIndexnDomId, data, sparqlCount.count, anchoredPgp.focus),
    (data) => progressBarPresentation.progress(progressBarDomId, data.solutions, sparqlCount.count, anchoredPgp.focus)
  ],
  error: [
    (data) => progressBarPresentation.stop(progressBarDomId, sparqlCount.count, data),
    (data) => console.error(data)
  ],
  ws_close: [
    () => progressBarPresentation.stop(progressBarDomId, sparqlCount.count)
  ]
})

const pgp = JSON.parse(document.querySelector('#pgp')
  .innerHTML)
const mappings = JSON.parse(document.querySelector('#mappings')
  .innerHTML)
const config = document.querySelector('#target')
  .value

loader.beginSearch(pgp, mappings, '/solutions', config)

document.body.addEventListener('keyup', (e) => {
  if(e.key === 'Escape') {
    loader.stopSearch()
  }
})

document.querySelector('#lightbox').addEventListener('click', (e) => {
  if(e.target.closest('#sparql')) {
    return
  }
  e.target.closest('#lightbox').classList.add('hidden')
})
