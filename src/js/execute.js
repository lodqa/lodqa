const Loader = require('./loader/loadSolution')
const BindResult = require('./controller/bindResult')
const anchoredPgpTablePresentation = require('./presentation/anchoredPgpTablePresentation')
const sparqlPresentation = require('./presentation/sparqlPresentation')
const answerListPresentation = require('./presentation/answerListPresentation')

const pgp = JSON.parse(document.querySelector('#pgp').innerHTML)
const mappings = JSON.parse(document.querySelector('#mappings').innerHTML)
const config = document.querySelector('#target').innerHTML
const loader = new Loader()
const bindResult = new BindResult('lodqa-results')

bindResult.anchoredPgp(loader, anchoredPgpTablePresentation)
bindResult.sparqlCount(loader, sparqlPresentation)
bindResult.solution(loader, sparqlPresentation)
bindResult.all(loader, answerListPresentation)

loader.beginSearch(pgp, mappings, '/solutions', config)

// const ws = new WebSocket(`ws://${location.host}/solutions?target=${config}`)
// ws.onopen = (event) => {
//   event.target.send(JSON.stringify({
//     pgp,
//     mappings
//   }))
// }
// ws.onmessage = (message) => {
//   console.log(message)
// }
