const show = require('./show')

module.exports = class {
  constructor(dom, dataset) {
    dataset.on('solution_add_event',
      () => {
        if (dataset.currentSolution.solutions.length !== 0 || dataset.isVerbose) {
          show(dom, dataset.sparqlCount, dataset.currentSolution.sparql, dataset.currentSolution.sparql_timeout)
        }
      }
    )
  }
}
