const show = require('./show')

module.exports = class {
  constructor(resultDomId, model) {
    model.on('solution_add_event',
      (solution) => {
        if (solution.solutions.length !== 0 || this._isVerbose) {
          show(document.querySelector(`#${resultDomId}`), model.sparqlCount, solution.sparql, solution.sparql_timeout)
        }
      }
    )
    model.on('is_verbose_update_event', (newValue) => this._isVerbose = newValue)
  }
}
