const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const answerIndexPresentation = require('./presentation/answer-index-presentation')
const SparqlCount = require('./sparql-count')

const loader = new Loader()
const bindResult = new BindResult(loader.eventEmitter)
const sparqlCount = new SparqlCount()
const domId = 'answer-index'
const anchoredPgp = {}

bindResult({
  sparqlCount: [
    () => sparqlCount.reset()
  ],
  anchoredPgp: [
    (data) => anchoredPgp.focus = data.focus
  ],
  solution: [
    () => sparqlCount.increment(),
    (data) => answerIndexPresentation(domId, data, sparqlCount.count, anchoredPgp.focus)
  ]
})

const pgp = JSON.parse(document.querySelector('#pgp')
  .innerHTML)
const mappings = JSON.parse(document.querySelector('#mappings')
  .innerHTML)
const config = document.querySelector('#target')
  .value

loader.beginSearch(pgp, mappings, '/solutions', config)
