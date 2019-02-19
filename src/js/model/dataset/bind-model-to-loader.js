module.exports = function bindModelToLoader(loader, dataset) {
  // Bind self to loader
  loader.on('expert:start', () => dataset.reset())
  loader.on('expert:sparql_count', ({
    count
  }) => dataset.sparqlsMax = count)
  loader.on('expert:anchored_pgp', (anchoredPgp) => dataset.anchoredPgp = anchoredPgp)
  loader.on('expert:solution', (newSolution) => dataset.addSolution(newSolution))

  loader.on('expert:ws_open', () => dataset.progress = true)
  loader.on('expert:ws_close', () => dataset.progress = false)
  loader.on('expert:error', (data) => {
    dataset.progress = false
    dataset.errorMessage = data
  })
}
