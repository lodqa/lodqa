module.exports = function(domId){
  return {
    sparqlCount,
    anchoredPgp: (loader, presentation) => anchoredPgp(domId, loader, presentation),
    solution: (loader, presentation) => solution(domId, loader, presentation)
  }
}

function sparqlCount(loader, onSparqlCount) {
  loader.on('sparql_count', (total) => onSparqlCount(total))
}

function anchoredPgp(domId, loader, onAnchoredPgp) {
  loader.on('anchored_pgp', (anchoredPgp) => onAnchoredPgp(domId, anchoredPgp))
}

function solution(domId, loader, onSolution) {
  loader.on('solution', (data) => onSolution(data, domId))
}
