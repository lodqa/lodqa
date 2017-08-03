module.exports = function(eventEmitter, domId) {
  const events = {
    sparqlCount: (callback) => sparqlCount(domId, eventEmitter, callback),
    anchoredPgp: (callback) => anchoredPgp(domId, eventEmitter, callback),
    solution: (callback) => solution(domId, eventEmitter, callback),
  }

  return (map) => {
    for (const [event, callbacks] of Object.entries(map)) {
      for (const callback of callbacks) {
        events[event](callback)
      }
    }
  }
}

function sparqlCount(domId, eventEmitter, onSparqlCount) {
  eventEmitter.on('sparql_count', () => onSparqlCount(0))
}

function anchoredPgp(domId, eventEmitter, onAnchoredPgp) {
  eventEmitter.on('anchored_pgp', (anchoredPgp) => onAnchoredPgp(domId, anchoredPgp))
}

function solution(domId, eventEmitter, onSolution) {
  eventEmitter.on('solution', (data) => onSolution(domId, data))
}
