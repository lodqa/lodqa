module.exports = {
  all,
  anchoredPgp,
  solution
}

const domId = 'lodqa-results'

function anchoredPgp(loader, presentation) {
  loader.on('anchored_pgp', (anchoredPgp) => presentation.onAnchoredPgp(domId, anchoredPgp))
}

function solution(loader, presentation) {
  loader.on('solution', (data) => presentation.onSolution(data, domId))
}

function all(loader, presentation) {
  anchoredPgp(loader, presentation)
  solution(loader, presentation)
}
