module.exports = function(domId){
  return {
    sparqlCount,
    anchoredPgp: (loader, presentation) => anchoredPgp(domId, loader, presentation),
    solution: (loader, presentation) => solution(domId, loader, presentation)
  }
}

function sparqlCount(loader, presentation) {
  loader.on('sparql_count', (total) => presentation.onSparqlCount(total))
}

function anchoredPgp(domId, loader, presentation) {
  loader.on('anchored_pgp', (anchoredPgp) => presentation.onAnchoredPgp(domId, anchoredPgp))
}

function solution(domId, loader, presentation) {
  loader.on('solution', (data) => presentation.onSolution(data, domId))
}
