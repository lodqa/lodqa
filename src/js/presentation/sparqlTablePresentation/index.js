const createTable = require('./createTable')

const privateData = {}

class SparqlTablePresentation {
  onSolution(data, domId) {
    const {
      sparql,
      solutions
    } = data

    if (solutions.length === 0 && !privateData.verbose) {
      return
    }

    // Add a table to the dom tree
    $(`#${domId}`)
      .append(createTable(sparql))
  }

  setVerbose(value) {
    privateData.verbose = value
  }
}

module.exports = new SparqlTablePresentation
