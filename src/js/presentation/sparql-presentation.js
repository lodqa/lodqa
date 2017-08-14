const sparqlPresentation = require('./sparql-presentation')
const answersPresentation = require('./answers-presentation')

module.exports = function(sparqlCount, anchoredPgp, solution){
  if(solution && solution.solutions.length) {
    document.querySelector('#lightbox').classList.remove('hidden')
    document.querySelector('#sparql').innerHTML = ''
    sparqlPresentation.show('sparql', solution, sparqlCount)
    answersPresentation.setAnchoredPgp('sparql', anchoredPgp)
    answersPresentation.showSolution('sparql', solution)
  }
}
