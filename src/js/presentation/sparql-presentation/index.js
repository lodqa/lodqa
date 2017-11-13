const show = require('./show')

module.exports = class {
  constructor(resultDomId, model) {
    model.on('solution_add_event',
      () => {
        if (model.currentSolution.solutions.length !== 0 || model.isVerbose) {
          show(document.querySelector(`#${resultDomId}`), model.sparqlCount, model.currentSolution.sparql, model.currentSolution.sparql_timeout)
        }
      }
    )
  }
}
