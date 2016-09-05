const createTable = require('./createTable')
const appendAnswers = require('./appendAnswers')

const privateData = {}

class SparqlTablePresentation {
  onAnchoredPgp(domId, anchored_pgp) {
    privateData.domId = domId
    privateData.focus = anchored_pgp.focus
  }

  onSolution(data) {
    const {sparql, solutions} = data

    if(solutions.length === 0 && !privateData.verbose) {
      return
    }
    const $resultTable = createTable(sparql)
    appendAnswers($resultTable, solutions, privateData.focus)

    // Add a table to the dom tree
    $('#' + privateData.domId)
      .append($resultTable)
  }

  setVerbose(value) {
    privateData.verbose = value
  }
}

module.exports = new SparqlTablePresentation
