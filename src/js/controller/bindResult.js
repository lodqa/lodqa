module.exports = function(loader, domId) {
  const events = {
    sparqlCount: (callback) => sparqlCount(domId, loader, callback),
    anchoredPgp: (callback) => anchoredPgp(domId, loader, callback),
    solution: (callback) => solution(domId, loader, callback),
  }

  return (map) => {
    for (const [event, callbacks] of Object.entries(map)) {
      for (const callback of callbacks) {
        events[event](callback)
      }
    }
  }
}

function sparqlCount(domId, loader, onSparqlCount) {
  loader.on('sparql_count', (total) => onSparqlCount(total))
}

function anchoredPgp(domId, loader, onAnchoredPgp) {
  loader.on('anchored_pgp', (anchoredPgp) => onAnchoredPgp(domId, anchoredPgp))
}

function solution(domId, loader, onSolution) {
  loader.on('solution', (data) => onSolution(data, domId))
}
