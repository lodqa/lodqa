const toTerm = require('./to-term')
const toLabel = require('./to-label')

module.exports = function(solution, edgeId) {
  const [edge] = Object.keys(solution)
    .filter((id) => id === edgeId)
    .map((id) => toTerm(solution, id))
    .map(toLabel)

  return edge
}
