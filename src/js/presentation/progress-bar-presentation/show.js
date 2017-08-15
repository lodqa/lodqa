const render = require('./render')

module.exports = function(domId, total, onSparqlClick) {
  // Render all of the progress bar
  const viewModel = Array.from(Array(total))
    .map((val, index) => ({
      sparqlNumber: index + 1
    }))

  render(domId, viewModel, onSparqlClick)
}
