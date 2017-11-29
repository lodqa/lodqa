module.exports = function bindModelToLoader(loader, dataset) {
  // Bind self to loader
  loader.on('sparqls', (sparqls) => dataset.sparqls = sparqls)
  loader.on('anchored_pgp', (anchoredPgp) => dataset.anchoredPgp = anchoredPgp)
  loader.on('solution', (newSolution) => dataset.addSolution(newSolution))

  loader.on('ws_open', () => dataset.progress = true)
  loader.on('ws_close', () => dataset.progress = false)
  loader.on('error', (data) => {
    dataset.progress = false
    dataset.errorMessage = data
  })
}
