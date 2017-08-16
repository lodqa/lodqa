const show = require('./show')
const updateDisplay = require('./update-display')

module.exports = class {
  constructor(domId) {
    this.domId = domId

    // The answers is a map that has url as key and answer as value.
    // The answer is an object that has a url, a label and an array of sparql.
    this.answers = new Map()

    // The set of hide sparqls. This has only spraqlCount
    this.hideSparqls = new Set()
  }

  show(data, sparqlNumber, focusNode) {
    show(this.domId, this.answers, data, sparqlNumber, focusNode, this.hideSparqls)
  }

  updateSparqlHideStatus(sparqlNumber, isHide) {
    if (isHide) {
      this.hideSparqls.add(sparqlNumber)
    } else {
      this.hideSparqls.delete(sparqlNumber)
    }

    updateDisplay(this.domId, this.answers, this.hideSparqls)
  }
}
