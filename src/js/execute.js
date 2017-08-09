const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const answerIndexPresentation = require('./presentation/answer-index-presentation')
const SparqlCount = require('./sparql-count')
const progressBarPresentation = require('./presentation/progress-bar-presentation')

const loader = new Loader()
const bindResult = new BindResult(loader.eventEmitter)
const sparqlCount = new SparqlCount()
const answerIndexnDomId = 'answer-index'
const progressBarDomId = 'progress-bar'
const anchoredPgp = {}

bindResult({
  sparqlCount: [
    () => sparqlCount.reset(),
    (total) => progressBarPresentation.setTotalSparqlCount(progressBarDomId, total)
  ],
  anchoredPgp: [
    (data) => anchoredPgp.focus = data.focus
  ],
  solution: [
    () => sparqlCount.increment(),
    (data) => answerIndexPresentation(answerIndexnDomId, data, sparqlCount.count, anchoredPgp.focus),
    (data) => progressBarPresentation.progress(progressBarDomId, data.solutions, sparqlCount.count, anchoredPgp.focus)
  ],
  error: [
    () => progressBarPresentation.stop(progressBarDomId, sparqlCount.count),
    (data) => console.error(data)
  ]
})

const pgp = JSON.parse(document.querySelector('#pgp')
  .innerHTML)
const mappings = JSON.parse(document.querySelector('#mappings')
  .innerHTML)
const config = document.querySelector('#target')
  .value

loader.beginSearch(pgp, mappings, '/solutions', config)
