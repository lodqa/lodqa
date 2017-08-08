const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const answerIndexPresentation = require('./presentation/answer-index-presentation')
const SparqlCount = require('./sparql-count')

const loader = new Loader()
const bindResult = new BindResult(loader.eventEmitter, 'answer-index')
const sparqlCount = new SparqlCount()

bindResult({
  sparqlCount: [
    () => sparqlCount.reset()
  ],
  anchoredPgp: [
    answerIndexPresentation.setAnchoredPgp
  ],
  solution: [
    () => sparqlCount.increment(),
    (domId, data) => answerIndexPresentation.show(domId, data, sparqlCount.count)
  ]
})

const pgp = JSON.parse(document.querySelector('#pgp')
  .innerHTML)
const mappings = JSON.parse(document.querySelector('#mappings')
  .innerHTML)
const config = document.querySelector('#target')
  .value

loader.beginSearch(pgp, mappings, '/solutions', config)
