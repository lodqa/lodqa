const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const sparqlPresentation = require('./presentation/sparql-presentation')
const answersPresentation = require('./presentation/answers-presentation')
const LabelFinder = require('./label-finder')

const loader = new Loader()
const bindResult = new BindResult(loader.eventEmitter, 'lodqa-results')
const labelFinder = new LabelFinder(answersPresentation)

bindResult({
  sparqlCount: [
    sparqlPresentation.setSparqlCount
  ],
  anchoredPgp: [
    answersPresentation.onAnchoredPgp,
    labelFinder.onAnchoredPgp
  ],
  solution: [
    answersPresentation.onSolution,
    (domId, data) => labelFinder.onSolution(data),
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
