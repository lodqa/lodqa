const render = require('./render')
const getUniqAnswers = require('../get-uniq-answers')

module.exports = {
  show(domId, total) {
    // Render all of the progress bar
    const viewModel = Array.from(Array(total)).map((val, index) => ({sparqlNumber: index + 1}))
    render(domId, viewModel)
  },
  progress(domId, solutions, sparqlCount, focusNode) {
    const current = getCurrentSparql(domId, sparqlCount)
    // Show number of answers of the solution that was just arrived.
    current.querySelector('.number-of-answers')
      .innerHTML = getUniqAnswers(solutions, focusNode)
        .length

    // Show the spinner icon for the next sparql
    const next = current.nextElementSibling
    if(next) {
      next.querySelector('.number-of-answers')
        .innerHTML = '<i class="fa fa-spinner fa-spin fa-fw"></i>'
    }
  },
  stop(domId, sparqlCount) {
    // The sparql count must be incremented because the next solution is not arrived yet.
    const current = getCurrentSparql(domId, sparqlCount + 1)

    // Hide the spinner icon
    if(current) {
      current.querySelector('.number-of-answers')
        .innerHTML = ''
    }
  }
}

function getCurrentSparql(domId, sparqlCount) {
  return document.querySelector(`#${domId} [data-sparql-number="${sparqlCount}"]`)
}
