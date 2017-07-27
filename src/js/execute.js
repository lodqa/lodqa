const Loader = require('./loader/loadSolution')
const BindResult = require('./controller/bindResult')
const anchoredPgpTablePresentation = require('./presentation/anchoredPgpTablePresentation')
const sparqlPresentation = require('./presentation/sparqlPresentation')
const answerListPresentation = require('./presentation/answerListPresentation')
const LabelFinder = require('./label-finder')

const pgp = JSON.parse(document.querySelector('#pgp').innerHTML)
const mappings = JSON.parse(document.querySelector('#mappings').innerHTML)
const config = document.querySelector('#target').innerHTML
const loader = new Loader()
const bindResult = new BindResult('lodqa-results')

// bindResult.anchoredPgp(loader, anchoredPgpTablePresentation)
bindResult.all(loader, answerListPresentation)
bindResult.all(loader, new LabelFinder(answerListPresentation))

bindResult.sparqlCount(loader, sparqlPresentation)
bindResult.solution(loader, sparqlPresentation)

loader.beginSearch(pgp, mappings, '/solutions', config)
