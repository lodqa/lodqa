const showSolution = require('./show-solution')

module.exports = class {
  constructor(resultDomId, model, findLabelOptions) {
    this.findLabelOptions = findLabelOptions

    // Maybe do no needed
    model.on('anchored_pgp_reset_event', () => this.setAnchoredPgp(model.anchoredPgp))

    model.on('solution_add_event', () => showSolution(document.querySelector(`#${resultDomId}`), model.anchoredPgp, model.currentSolution, findLabelOptions))
  }
}
