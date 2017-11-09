const bindEvents = require('../controller/bind-events')

module.exports = function bindModelToLoader(loader, model) {
  // Bind self to loader
  bindEvents(loader, {
    sparqls: [
      (sparqls) => model.sparqls = sparqls,
    ],
    anchored_pgp: [
      (data) => model.anchoredPgp = data
    ],
    solution: [
      (newSolution) => model.addSolution(newSolution)
    ],
  })
}
