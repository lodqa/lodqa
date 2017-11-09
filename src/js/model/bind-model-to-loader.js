const bindResult = require('../controller/bind-result')

module.exports = function bindModelToLoader(loader, model) {
  // Bind self to loader
  bindResult(loader, {
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
