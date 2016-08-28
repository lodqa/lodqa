module.exports = {
  all,
  anchoredPgp
}

function anchoredPgp(loader, presentation) {
  var domId = 'lodqa-results'

  loader
    .on('anchored_pgp', (anchoredPgp) => presentation.onAnchoredPgp(domId, anchoredPgp))
}

function all(loader, presentation) {
  anchoredPgp(loader, presentation)
  loader
    .on('solution', presentation.onSolution)
}
