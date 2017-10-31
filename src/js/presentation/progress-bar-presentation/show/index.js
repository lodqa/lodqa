const render = require('./render')

module.exports = function(dom, name, total, onChcekChange) {
  // Render all of the progress bar
  const viewModel = Array.from(Array(total))
    .map((val, index) => ({
      sparqlNumber: index + 1
    }))

  render(dom, name, viewModel, onChcekChange)
}
