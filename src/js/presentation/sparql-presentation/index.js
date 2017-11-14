const show = require('./show')

module.exports = class {
  constructor(dom, model) {
    model.on('solution_add_event',
      () => {
        if (model.currentSolution.solutions.length !== 0 || model.isVerbose) {
          show(dom, model.sparqlCount, model.currentSolution.sparql, model.currentSolution.sparql_timeout)
        }
      }
    )
  }
}
