const showSolution = require('./show-solution')

module.exports = class {
  constructor(resultDomId, model, findLabelOptions) {
    this.findLabelOptions = findLabelOptions

    model.on('solution_add_event', () => showSolution(document.querySelector(`#${resultDomId}`), model.anchoredPgp, model.currentSolution, findLabelOptions))
  }
}
