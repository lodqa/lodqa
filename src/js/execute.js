const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const sparqlPresentation = require('./presentation/sparql-presentation')
const answersPresentation = require('./presentation/answers-presentation')

const loader = new Loader()
const bindResult = new BindResult(loader.eventEmitter, 'lodqa-results')

bindResult({
  sparqlCount: [
    sparqlPresentation.setSparqlCount
  ],
  anchoredPgp: [
    answersPresentation.onAnchoredPgp
  ],
  solution: [
    (domId, data) => answersPresentation.onSolution(domId, data),
    sparqlPresentation.onSolution
  ]
})

const pgp = JSON.parse(document.querySelector('#pgp')
  .innerHTML)
const mappings = JSON.parse(document.querySelector('#mappings')
  .innerHTML)
const config = document.querySelector('#target')
  .innerHTML

loader.beginSearch(pgp, mappings, '/solutions', config)
