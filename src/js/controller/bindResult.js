var bindAnchoredPgpPresentation = function(loader, presentation) {
    var domId = 'lodqa-results'

    loader
      .on('anchored_pgp', (anchoredPgp) => presentation.onAnchoredPgp(domId, anchoredPgp))
  },
  bindResultPresentation = function(loader, presentation) {
    bindAnchoredPgpPresentation(loader, presentation)
    loader
      .on('sparql', presentation.onSparql)
      .on('solution', presentation.onSolution)
  },
  bindResult = {
    all: bindResultPresentation,
    anchoredPgp: bindAnchoredPgpPresentation
  }

module.exports = bindResult
