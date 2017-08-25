const show = require('./show')
const updateDisplay = require('./update-display')

module.exports = class {
  constructor(domId) {
    this.domId = domId

    // The set of hide sparqls. This has only spraqlCount
    this.hideSparqls = new Set()
  }

  progress(model) {
    show(this.domId, model, this.hideSparqls)
  }

  updateSparqlHideStatus(sparqlNumber, model, isHide) {
    if (isHide) {
      this.hideSparqls.add(sparqlNumber)
    } else {
      this.hideSparqls.delete(sparqlNumber)
    }

    updateDisplay(this.domId, model.answersMap, this.hideSparqls)
  }
}
