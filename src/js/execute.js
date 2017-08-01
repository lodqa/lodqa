const Loader = require('./loader/loadSolution')
const BindResult = require('./controller/bindResult')
const sparqlPresentation = require('./presentation/sparqlPresentation')
const answerListPresentation = require('./presentation/answerListPresentation')
const LabelFinder = require('./label-finder')

const loader = new Loader()
const bindResult = new BindResult(loader, 'lodqa-results')
const labelFinder = new LabelFinder(answerListPresentation)

bindResult({
  sparqlCount: [
    sparqlPresentation.setSparqlCount
  ],
  anchoredPgp: [
    answerListPresentation.onAnchoredPgp,
    labelFinder.onAnchoredPgp
  ],
  solution: [
    answerListPresentation.onSolution,
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
