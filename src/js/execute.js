const Loader = require('./loader/loadSolution')
const BindResult = require('./controller/bindResult')
const sparqlPresentation = require('./presentation/sparqlPresentation')
const answerListPresentation = require('./presentation/answerListPresentation')
const LabelFinder = require('./label-finder')

const loader = new Loader()
const bindResult = new BindResult(loader, 'lodqa-results')
const labelFinder = new LabelFinder(answerListPresentation)

bindResult({
  anchoredPgp: [
    answerListPresentation.onAnchoredPgp,
    labelFinder.onAnchoredPgp
  ],
  sparqlCount: [
    sparqlPresentation.onSparqlCount
  ],
  solution: [
    answerListPresentation.onSolution,
    (data, domId) => labelFinder.onSolution(data, domId),
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
