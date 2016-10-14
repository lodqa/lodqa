const toTerm = require('./toTerm')
const toLabel = require('./toLabel')

module.exports = function(solution, edgeId) {
  const edge = Object.keys(solution)
    .filter((id) => id === edgeId)
    .map((id) => toTerm(solution, id))
    .map(toLabel)[0]

  return edge
}
