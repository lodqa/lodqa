module.exports = function bindModelToLoader(loader, dataset) {
  // Bind self to loader
  loader.on('sparqls', (sparqls) => dataset.sparqls = sparqls)
  loader.on('anchored_pgp', (anchoredPgp) => dataset.anchoredPgp = anchoredPgp)
  loader.on('solution',(newSolution) => dataset.addSolution(newSolution))
  loader.on('error', (data) => dataset.errorMessage = data)

  relay(loader, dataset, ['ws_open', 'ws_close', 'error'])
}

function relay(loader, dataset, events) {
  for (const event of events) {
    loader.on(event, () => dataset.emit(event))
  }
}
